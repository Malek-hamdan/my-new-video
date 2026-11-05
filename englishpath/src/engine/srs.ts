import { DefaultScheduler, Rating } from "ts-fsrs";
import type { Lesson } from "@/content/schema";
import type { SrsRow, Store } from "@/db/types";

/** FSRS scheduler (ts-fsrs, FSRS-7 preset). Created once, lazily. */
type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
let scheduler: Promise<Scheduler> | null = null;
const getScheduler = () =>
  (scheduler ??= DefaultScheduler({ desiredRetention: 0.9, enableFuzz: true, maximumInterval: 3650 }));

export { Rating };
export type Grade = (typeof Rating)["Again" | "Hard" | "Good" | "Easy"];

type CardJson = Record<string, unknown> & { dueAt: string; lastReviewAt: string | null };

/** Revives Date fields after JSON storage (ts-fsrs validates real Date objects). */
function revive(card: Record<string, unknown>) {
  const c = card as CardJson;
  return { ...c, dueAt: new Date(c.dueAt), lastReviewAt: c.lastReviewAt ? new Date(c.lastReviewAt) : null };
}
const toJson = (card: object) => JSON.parse(JSON.stringify(card)) as Record<string, unknown>;

/** Adds every word and the grammar point of a lesson to the review deck (idempotent). */
export async function addLessonToDeck(store: Store, lesson: Lesson, now = new Date()): Promise<number> {
  const s = await getScheduler();
  let added = 0;
  const items: Omit<SrsRow, "due" | "card">[] = [
    ...lesson.vocab.map((w) => ({
      id: `w:${w.word.toLowerCase()}`,
      kind: "word" as const,
      ref: lesson.id,
      front: w.word,
      back: w.meaning,
      data: { example: w.example, emoji: w.emoji, ipa: w.ipa ?? null, pos: w.pos },
    })),
    {
      id: `g:${lesson.grammar.id}`,
      kind: "grammar" as const,
      ref: lesson.id,
      front: lesson.grammar.title,
      back: lesson.grammar.explanation.join("\n"),
      data: {
        examples: lesson.grammar.examples.map((e) => e.en),
        mistake: lesson.grammar.mistakes[0] ?? null,
        practice: lesson.grammar.practice,
      },
    },
  ];
  for (const item of items) {
    if (await store.getCard(item.id)) continue;
    const card = s.newCard({ now });
    await store.upsertCard({ ...item, card: toJson(card), due: now.getTime() });
    added++;
  }
  return added;
}

/** Applies a review grade and stores the next due date. */
export async function reviewCard(store: Store, row: SrsRow, grade: Grade, now = new Date()): Promise<SrsRow> {
  const s = await getScheduler();
  const result = s.review({ card: revive(row.card) as never, grade, now });
  const next: SrsRow = { ...row, card: toJson(result.card), due: new Date(result.card.dueAt).getTime() };
  await store.upsertCard(next);
  return next;
}

/** Human-readable preview of the next interval for each grade (for the review buttons). */
export async function previewIntervals(row: SrsRow, now = new Date()): Promise<Record<Grade, string>> {
  const s = await getScheduler();
  const out = {} as Record<Grade, string>;
  for (const { grade, card } of s.preview({ card: revive(row.card) as never, now })) {
    out[grade as Grade] = formatInterval(new Date(card.dueAt).getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min}m`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d}d`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo}mo` : `${(d / 365).toFixed(1)}y`;
}

/** A card is "learned" once it has been reviewed successfully at least once. */
export const isLearned = (row: SrsRow) => Number((row.card as { reps?: number }).reps ?? 0) > 0;
