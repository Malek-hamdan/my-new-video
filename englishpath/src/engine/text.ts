/** Text helpers shared by grading, speaking scores and offline checks. */

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "he's": "he is", "she's": "she is", "it's": "it is",
  "we're": "we are", "they're": "they are", "don't": "do not", "doesn't": "does not",
  "can't": "cannot", "won't": "will not", "isn't": "is not", "aren't": "are not",
  "what's": "what is", "there's": "there is", "i'd": "i would", "let's": "let us",
  "didn't": "did not", "wasn't": "was not", "weren't": "were not", "haven't": "have not",
  "hasn't": "has not", "i've": "i have", "i'll": "i will", "that's": "that is",
};

/** Lowercase, unify apostrophes, strip punctuation, collapse spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise and expand contractions so "I'm" == "I am". */
export function canonical(s: string): string {
  return normalize(s)
    .split(" ")
    .map((w) => CONTRACTIONS[w] ?? w)
    .join(" ")
    .replace(/\bcan not\b/g, "cannot");
}

export const words = (s: string): string[] => normalize(s).split(" ").filter(Boolean);

export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

const charSim = (a: string, b: string) => {
  const max = Math.max(a.length, b.length) || 1;
  return 1 - levenshtein([...a], [...b]) / max;
};

export interface WordResult {
  word: string;
  status: "correct" | "close" | "missed";
  heard?: string;
}

/**
 * Word-by-word speaking accuracy. Aligns the target sentence with the recognised
 * transcript (edit-distance alignment on words) and marks every target word as
 * correct, close (similar spelling, e.g. "work"/"works") or missed.
 */
export function scoreSpeech(target: string, heard: string): { words: WordResult[]; score: number } {
  const t = words(target);
  const h = words(heard);
  const n = t.length;
  const m = h.length;
  const cost = (i: number, j: number) => {
    const s = charSim(t[i]!, h[j]!);
    return s === 1 ? 0 : s >= 0.6 ? 0.5 : 1;
  };
  const dp: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i]![j] = Math.min(dp[i - 1]![j - 1]! + cost(i - 1, j - 1), dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1);

  const result: WordResult[] = new Array(n);
  let i = n;
  let j = m;
  while (i > 0) {
    if (j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + cost(i - 1, j - 1)) {
      const c = cost(i - 1, j - 1);
      result[i - 1] = { word: t[i - 1]!, status: c === 0 ? "correct" : c === 0.5 ? "close" : "missed", heard: h[j - 1] };
      i--;
      j--;
    } else if (j > 0 && dp[i]![j] === dp[i]![j - 1]! + 1) {
      j--;
    } else {
      result[i - 1] = { word: t[i - 1]!, status: "missed" };
      i--;
    }
  }
  const points = result.reduce((acc, r) => acc + (r.status === "correct" ? 1 : r.status === "close" ? 0.5 : 0), 0);
  return { words: result, score: n === 0 ? 0 : Math.round((points / n) * 100) };
}

/** Similarity 0..1 between two sentences on canonical words. */
export function sentenceSimilarity(a: string, b: string): number {
  const x = canonical(a).split(" ").filter(Boolean);
  const y = canonical(b).split(" ").filter(Boolean);
  const max = Math.max(x.length, y.length) || 1;
  return 1 - levenshtein(x, y) / max;
}

export const countWords = (s: string) => words(s).length;

/** Deterministic PRNG (mulberry32) so quizzes are stable per attempt seed. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
