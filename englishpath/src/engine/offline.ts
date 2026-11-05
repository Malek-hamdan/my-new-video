import type { Lesson, Question } from "@/content/schema";
import type { WritingFeedback } from "./ai/schemas";
import { buildQuiz, type QuizItem } from "./quiz";
import { canonical, countWords, hashString, normalize, rng, sentenceSimilarity, shuffle } from "./text";

/**
 * Offline writing check (used without an API key or connection). Rule-based, so it
 * is honest about its limits: it checks length, target words, capitals, end
 * punctuation and a list of very common beginner errors.
 */
const COMMON: { re: RegExp; fix: (m: string) => string; why: string }[] = [
  { re: /\bi\b(?!')/g, fix: () => "I", why: "The pronoun I is always a capital letter." },
  { re: /\bI is\b/gi, fix: () => "I am", why: "Use am with I." },
  { re: /\b(he|she|it) are\b/gi, fix: (m) => m.replace(/are/i, "is"), why: "Use is with he, she and it." },
  { re: /\b(you|we|they) is\b/gi, fix: (m) => m.replace(/is/i, "are"), why: "Use are with you, we and they." },
  { re: /\b(he|she|it) (don't)\b/gi, fix: (m) => m.replace(/don't/i, "doesn't"), why: "Use doesn't with he, she and it." },
  { re: /\b(he|she|it) have\b/gi, fix: (m) => m.replace(/have/i, "has"), why: "Use has with he, she and it." },
  { re: /\bI have (\d+) years\b/gi, fix: (m) => m.replace(/have (\d+) years/i, "am $1 years old"), why: "Use be for age: I am … years old." },
  { re: /\ba ([aeiou]\w*)/gi, fix: (m) => m.replace(/^a /i, "an "), why: "Use an before a vowel sound." },
  { re: /\bcan to (\w+)/gi, fix: (m) => m.replace(/can to /i, "can "), why: "No to after can." },
  { re: /\benjoy to (\w+)/gi, fix: (m) => m.replace(/enjoy to (\w+)/i, (_x, v: string) => `enjoy ${v}ing`), why: "Enjoy is followed by -ing." },
  { re: /\bdoesn't (\w+)s\b/gi, fix: (m) => m.replace(/s$/i, ""), why: "After doesn't use the base verb (no -s)." },
];

const EXCEPTIONS_A_AN = /\ba (uni|use|user|euro|one|uniform|university|useful|usual)/i;

export function offlineWritingCheck(text: string, task: { minWords: number; targetWords: string[] }): WritingFeedback {
  const issues: WritingFeedback["issues"] = [];
  let corrected = text.trim();

  for (const rule of COMMON) {
    corrected = corrected.replace(rule.re, (m) => {
      if (rule.why.startsWith("Use an") && EXCEPTIONS_A_AN.test(m)) return m;
      const fixed = rule.fix(m);
      if (fixed !== m && issues.length < 10) issues.push({ original: m, correction: fixed, explanation: rule.why, type: "grammar" });
      return fixed;
    });
  }
  // Capital letter at the start of each sentence.
  corrected = corrected.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => {
    issues.push({ original: c, correction: c.toUpperCase(), explanation: "Start every sentence with a capital letter.", type: "punctuation" });
    return p + c.toUpperCase();
  });
  if (corrected && !/[.!?]$/.test(corrected)) {
    issues.push({ original: corrected.slice(-12), correction: `${corrected.slice(-12)}.`, explanation: "End the sentence with a full stop, question mark or exclamation mark.", type: "punctuation" });
    corrected += ".";
  }

  const n = countWords(text);
  const lower = canonical(text);
  const missing = task.targetWords.filter((w) => !lower.includes(canonical(w.replace(/^-/, ""))));
  const lengthScore = Math.min(1, n / Math.max(1, task.minWords));
  const targetScore = task.targetWords.length ? 1 - missing.length / task.targetWords.length : 1;
  const accuracy = Math.max(0, 1 - issues.length / Math.max(3, n / 4));
  const score = Math.round(100 * (0.35 * lengthScore + 0.3 * targetScore + 0.35 * accuracy));

  const tips: string[] = [];
  if (n < task.minWords) tips.push(`Write at least ${task.minWords} words (you wrote ${n}).`);
  if (missing.length) tips.push(`Try to use: ${missing.join(", ")}.`);
  return {
    score,
    corrected,
    issues,
    strengths: n >= task.minWords ? "Good length — you completed the task." : "Good start! Keep adding detail.",
    nextTip: tips[0] ?? "Read your text aloud once before you finish — it helps you find mistakes.",
  };
}

/** Offline role-play check: compares the learner's line with the expected line. */
export function offlineTurnCheck(expected: string, said: string) {
  const sim = sentenceSimilarity(expected, said);
  return {
    similarity: sim,
    ok: sim >= 0.7,
    feedback:
      sim >= 0.9
        ? "Excellent — that's exactly right."
        : sim >= 0.7
          ? "Good! Small differences — compare with the model line."
          : "Not quite. Listen to the model line and try again.",
  };
}

/**
 * Endless offline practice: a fresh 10-question set every time, remixed from every
 * lesson the learner has passed and weighted toward weak tags. Never runs out —
 * each seed produces a different combination.
 */
export function buildPractice(lessons: Lesson[], weakTags: string[], seed: number): QuizItem[] {
  if (!lessons.length) return [];
  const rand = rng(hashString(`practice#${seed}`));
  const pool: QuizItem[] = [];
  lessons.forEach((l, i) => pool.push(...buildQuiz(l, seed + i)));
  const weak = new Set(weakTags);
  const weighted = pool.flatMap((q) => (weak.has(q.tag) ? [q, q, q] : [q]));
  const picked: QuizItem[] = [];
  const seen = new Set<string>();
  for (const q of shuffle(weighted, rand)) {
    const k = `${q.tag}|${normalize(q.type === "mc" ? q.prompt : q.answer)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push({ ...q, id: `${q.id}-${picked.length}` });
    if (picked.length === 10) break;
  }
  return picked;
}

export const questionText = (q: Question) => (q.type === "order" ? q.prompt ?? "Put the words in order." : q.prompt);
