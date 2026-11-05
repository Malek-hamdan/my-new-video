import type { Lesson, Question } from "@/content/schema";
import { canonical, hashString, rng, shuffle } from "./text";

export type QuizItem = Question & { skill: NonNullable<Question["skill"]>; tag: string };

/**
 * Builds the 10-question end-of-lesson quiz: 4 vocabulary, grammar practice (up to 3),
 * 1 reading, 1 listening, plus lesson extras — always exactly 10 items.
 * Same lesson + same attempt number → same quiz; a retry gets a fresh shuffle.
 */
export function buildQuiz(lesson: Lesson, attempt = 0): QuizItem[] {
  const rand = rng(hashString(`${lesson.id}#${attempt}`));
  const items: QuizItem[] = [];

  const vocab = shuffle(lesson.vocab, rand);
  for (const w of vocab.slice(0, 4)) {
    const distractors = shuffle(lesson.vocab.filter((x) => x.id !== w.id), rand).slice(0, 2).map((x) => x.word);
    const options = shuffle([w.word, ...distractors], rand);
    items.push({
      id: `qv-${w.id}`,
      type: "mc",
      prompt: `${w.emoji}  ${w.meaning}`,
      options,
      answer: options.indexOf(w.word),
      explanation: `${w.word} — ${w.example}`,
      skill: "vocabulary",
      tag: `word:${w.id}`,
    });
  }

  for (const q of shuffle(lesson.grammar.practice, rand).slice(0, 3)) {
    items.push({ ...q, id: `qg-${q.id}`, skill: "grammar", tag: `grammar:${lesson.grammar.id}` } as QuizItem);
  }
  const r = lesson.reading.questions[Math.floor(rand() * lesson.reading.questions.length)];
  if (r) items.push({ ...r, id: `qr-${r.id}`, skill: "reading", tag: `reading:${lesson.id}` } as QuizItem);
  const l = lesson.listening.questions[Math.floor(rand() * lesson.listening.questions.length)];
  if (l) items.push({ ...l, id: `ql-${l.id}`, prompt: `🎧 ${l.prompt ?? ""}`.trim(), skill: "listening", tag: `listening:${lesson.id}` } as QuizItem);

  const pool = shuffle(
    [
      ...lesson.quizExtra.map((q) => ({ ...q, skill: q.skill ?? "vocabulary", tag: `lesson:${lesson.id}` }) as QuizItem),
      ...lesson.vocab.slice(4).map((w) => ({
        id: `qv2-${w.id}`,
        type: "cloze" as const,
        prompt: w.example.replace(new RegExp(`\\b${escapeRe(w.word)}\\b`, "i"), "___"),
        answer: w.word,
        skill: "vocabulary" as const,
        tag: `word:${w.id}`,
      })).filter((q) => q.prompt.includes("___")),
      ...lesson.grammar.practice.slice(3).map((q) => ({ ...q, skill: "grammar", tag: `grammar:${lesson.grammar.id}` }) as QuizItem),
    ],
    rand,
  );
  for (const q of pool) {
    if (items.length >= 10) break;
    if (!items.some((x) => x.id === q.id)) items.push(q);
  }
  // Pad with reading/listening questions not yet used.
  for (const q of [...lesson.reading.questions, ...lesson.listening.questions]) {
    if (items.length >= 10) break;
    const qid = `qx-${q.id}`;
    if (!items.some((x) => x.id.endsWith(q.id))) items.push({ ...q, id: qid, skill: q.skill ?? "reading", tag: `lesson:${lesson.id}` } as QuizItem);
  }
  return shuffle(items.slice(0, 10), rand);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type Answer = number | string;

/** Grades one answer. Cloze accepts alternatives and contraction variants; order compares canonical text. */
export function isCorrect(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  switch (q.type) {
    case "mc":
      return a === q.answer;
    case "cloze": {
      const given = canonical(String(a));
      return [q.answer, ...(q.alternatives ?? [])].some((x) => canonical(x) === given);
    }
    case "order":
      return canonical(String(a)) === canonical(q.answer);
  }
}

export const correctText = (q: Question): string =>
  q.type === "mc" ? (q.options[q.answer] ?? "") : q.answer;

/** Tiles for an order question (shuffled words of the answer). */
export function orderTiles(q: Extract<Question, { type: "order" }>, seed = 1): string[] {
  const tiles = q.answer.replace(/[.?!]$/, "").split(/\s+/);
  let out = shuffle(tiles, rng(hashString(q.id) + seed));
  if (out.join(" ") === tiles.join(" ") && tiles.length > 1) out = [...out.slice(1), out[0]!];
  return out;
}

export function scoreQuiz(items: Question[], answers: Record<string, Answer>) {
  const correct = items.filter((q) => isCorrect(q, answers[q.id])).length;
  return { correct, total: items.length, ratio: items.length ? correct / items.length : 0 };
}
