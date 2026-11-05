import { BUILTIN_LESSONS } from "@/content";
import { SKILLS, type Skill } from "@/content/schema";
import type { Attempt, SrsRow } from "@/db/types";

export interface WeakPoint {
  tag: string;
  label: string;
  accuracy: number;
  attempts: number;
}

const grammarTitles: Record<string, string> = Object.fromEntries(
  Object.values(BUILTIN_LESSONS).map((l) => [l.grammar.id, l.grammar.title]),
);

/** Turns an attempt tag into a readable label for the dashboard and AI prompts. */
export function labelForTag(tag: string, cards: SrsRow[] = []): string {
  const [kind, ref = ""] = tag.split(":");
  if (kind === "grammar") return `Grammar: ${grammarTitles[ref] ?? cards.find((c) => c.id === `g:${ref}`)?.front ?? ref.replace(/^g-/, "").replace(/-/g, " ")}`;
  if (kind === "word") return `Word: ${ref.replace(/-/g, " ")}`;
  if (kind === "reading") return "Reading comprehension";
  if (kind === "listening") return "Listening comprehension";
  if (kind === "speaking") return `Pronunciation: “${ref}”`;
  if (kind === "writing") return "Writing accuracy";
  if (kind === "dialogue") return `Conversation: ${ref}`;
  return tag;
}

/** Items answered < 70% correct with at least 3 tries in the window, worst first. */
export function computeWeakPoints(attempts: Attempt[], cards: SrsRow[] = [], limit = 8): WeakPoint[] {
  const by = new Map<string, { c: number; t: number }>();
  for (const a of attempts) {
    if (!a.tag) continue;
    const agg = by.get(a.tag) ?? { c: 0, t: 0 };
    agg.c += a.correct;
    agg.t += a.total;
    by.set(a.tag, agg);
  }
  // Lapsed review cards are weak points too.
  for (const card of cards) {
    const lapses = Number((card.card as { lapses?: number }).lapses ?? 0);
    if (lapses >= 2) {
      const tag = card.kind === "grammar" ? `grammar:${card.id.slice(2)}` : `word:${card.front.toLowerCase().replace(/\s+/g, "-")}`;
      const agg = by.get(tag) ?? { c: 0, t: 0 };
      agg.t += lapses + 1;
      agg.c += 1;
      by.set(tag, agg);
    }
  }
  return [...by.entries()]
    .filter(([, v]) => v.t >= 3 && v.c / v.t < 0.7)
    .map(([tag, v]) => ({
      tag,
      label: labelForTag(tag, cards),
      accuracy: v.c / v.t,
      attempts: v.t,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}

/** Accuracy per skill (0..1, or null when there is no data). */
export function skillAccuracy(attempts: Attempt[]): Record<Skill, number | null> {
  const out = Object.fromEntries(SKILLS.map((s) => [s, null])) as Record<Skill, number | null>;
  for (const s of SKILLS) {
    const xs = attempts.filter((a) => a.skill === s);
    const t = xs.reduce((n, a) => n + a.total, 0);
    if (t > 0) out[s] = xs.reduce((n, a) => n + a.correct, 0) / t;
  }
  return out;
}

/** XP-like activity per day for the last n days (attempt counts). */
export function activityByDay(attempts: Attempt[], days = 7, now = new Date()): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const start = d.getTime();
    const end = start + 864e5;
    out.push({
      day: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: attempts.filter((a) => a.ts >= start && a.ts < end).reduce((n, a) => n + a.total, 0),
    });
  }
  return out;
}
