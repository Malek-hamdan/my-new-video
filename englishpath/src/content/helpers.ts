import type { LessonInput, Vocab } from "./schema";

type Skill = "vocabulary" | "grammar" | "reading" | "listening";

export const mc = (id: string, prompt: string, options: string[], answer: number, explanation?: string, skill?: Skill) => ({
  id,
  type: "mc" as const,
  prompt,
  options,
  answer,
  ...(explanation ? { explanation } : {}),
  ...(skill ? { skill } : {}),
});

export const cloze = (id: string, prompt: string, answer: string, explanation?: string, alternatives?: string[], skill?: Skill) => ({
  id,
  type: "cloze" as const,
  prompt,
  answer,
  ...(alternatives ? { alternatives } : {}),
  ...(explanation ? { explanation } : {}),
  ...(skill ? { skill } : {}),
});

export const order = (id: string, answer: string, prompt?: string, explanation?: string) => ({
  id,
  type: "order" as const,
  answer,
  ...(prompt ? { prompt } : {}),
  ...(explanation ? { explanation } : {}),
  skill: "grammar" as const,
});

export const v = (id: string, word: string, pos: Vocab["pos"], meaning: string, example: string, emoji: string): Vocab => ({
  id,
  word,
  pos,
  meaning,
  example,
  emoji,
});

export const lesson = (l: LessonInput): LessonInput => l;
