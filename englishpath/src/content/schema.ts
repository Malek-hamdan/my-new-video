import { z } from "zod";

/** CEFR levels in strict order. */
export const LEVELS = ["PreA1", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const LevelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof LevelSchema>;

export const LEVEL_LABEL: Record<Level, string> = {
  PreA1: "Pre-A1",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1: "C1",
  C2: "C2",
};

export const LEVEL_NAME: Record<Level, string> = {
  PreA1: "First Steps",
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Mastery",
};

const id = z.string().min(1).max(80);
const text = (max: number) => z.string().min(1).max(max);

export const McQuestionSchema = z.object({
  id,
  type: z.literal("mc"),
  prompt: text(400),
  options: z.array(text(160)).min(2).max(5),
  answer: z.number().int().min(0).max(4),
  explanation: z.string().max(400).optional(),
  skill: z.enum(["vocabulary", "grammar", "reading", "listening"]).optional(),
});

export const ClozeQuestionSchema = z.object({
  id,
  type: z.literal("cloze"),
  /** Sentence containing exactly one "___" gap. */
  prompt: text(400).refine((s) => s.includes("___"), "cloze prompt needs ___"),
  answer: text(80),
  alternatives: z.array(text(80)).max(6).optional(),
  explanation: z.string().max(400).optional(),
  skill: z.enum(["vocabulary", "grammar", "reading", "listening"]).optional(),
});

export const OrderQuestionSchema = z.object({
  id,
  type: z.literal("order"),
  /** Correct sentence; tiles are produced by shuffling its words. */
  answer: text(200),
  prompt: z.string().max(200).optional(),
  explanation: z.string().max(400).optional(),
  skill: z.enum(["vocabulary", "grammar", "reading", "listening"]).optional(),
});

export const QuestionSchema = z
  .discriminatedUnion("type", [McQuestionSchema, ClozeQuestionSchema, OrderQuestionSchema])
  .superRefine((q, ctx) => {
    if (q.type === "mc" && q.answer >= q.options.length) {
      ctx.addIssue({ code: "custom", message: "mc answer index out of range" });
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

export const VocabSchema = z.object({
  id,
  word: text(60),
  pos: z.enum(["noun", "verb", "adjective", "adverb", "phrase", "pronoun", "preposition", "number", "determiner", "conjunction", "interjection"]),
  /** Simple English definition (the app is English-only). */
  meaning: text(200),
  example: text(240),
  /** Offline illustration: a single emoji. */
  emoji: z.string().min(1).max(16),
  ipa: z.string().max(80).optional(),
});
export type Vocab = z.infer<typeof VocabSchema>;

export const GrammarSchema = z.object({
  id,
  title: text(120),
  explanation: z.array(text(600)).min(1).max(6),
  examples: z.array(z.object({ en: text(240), note: z.string().max(200).optional() })).min(2).max(8),
  mistakes: z.array(z.object({ wrong: text(200), right: text(200), why: text(300) })).min(1).max(5),
  practice: z.array(QuestionSchema).min(2).max(6),
});
export type Grammar = z.infer<typeof GrammarSchema>;

export const ReadingSchema = z.object({
  title: text(120),
  text: text(3000),
  questions: z.array(QuestionSchema).min(1).max(5),
});

export const ListeningSchema = z.object({
  title: text(120),
  script: z.array(z.object({ speaker: z.string().max(40).optional(), text: text(400) })).min(1).max(16),
  questions: z.array(QuestionSchema).min(1).max(5),
});

export const SpeakingSchema = z.object({
  prompts: z.array(text(200)).min(2).max(6),
});

export const WritingSchema = z.object({
  prompt: text(400),
  minWords: z.number().int().min(3).max(300),
  targetWords: z.array(text(40)).max(8),
  model: text(1200),
});

export const LessonSchema = z.object({
  id,
  unitId: id,
  title: text(120),
  goal: text(200),
  vocab: z.array(VocabSchema).min(3).max(12),
  grammar: GrammarSchema,
  reading: ReadingSchema,
  listening: ListeningSchema,
  speaking: SpeakingSchema,
  writing: WritingSchema,
  /** Extra quiz items; the final quiz is assembled by engine/quiz.ts. */
  quizExtra: z.array(QuestionSchema).max(6).default([]),
  source: z.enum(["builtin", "ai", "offline"]).default("builtin"),
});
export type Lesson = z.infer<typeof LessonSchema>;
export type LessonInput = z.input<typeof LessonSchema>;

export interface UnitOutline {
  id: string;
  level: Level;
  index: number;
  title: string;
  canDo: string;
  grammarFocus: string[];
  vocabTopics: string[];
  lessonTitles: [string, string, string];
}

export const LESSON_STEPS = ["vocabulary", "grammar", "reading", "listening", "speaking", "writing", "quiz"] as const;
export type LessonStep = (typeof LESSON_STEPS)[number];

export const SKILLS = ["vocabulary", "grammar", "reading", "listening", "speaking", "writing"] as const;
export type Skill = (typeof SKILLS)[number];

export const PASS_MARK = 0.8;

export const DIALOGUE_TOPICS = [
  "greetings", "shopping", "restaurant", "travel", "doctor",
  "job interview", "workplace", "phone calls", "negotiation", "small talk",
] as const;
export const DialogueTopicSchema = z.enum(DIALOGUE_TOPICS);
export type DialogueTopic = z.infer<typeof DialogueTopicSchema>;

export const DialogueSchema = z.object({
  id,
  level: LevelSchema,
  topic: DialogueTopicSchema,
  title: text(120),
  setting: text(300),
  /** Display names for speaker A and B. The learner plays B in role-play. */
  roles: z.object({ A: text(40), B: text(40) }),
  lines: z.array(z.object({ speaker: z.enum(["A", "B"]), text: text(400) })).min(4).max(20),
  phrases: z.array(z.object({ phrase: text(120), meaning: text(200) })).min(1).max(8),
  source: z.enum(["builtin", "ai"]).default("builtin"),
});
export type Dialogue = z.infer<typeof DialogueSchema>;
export type DialogueInput = z.input<typeof DialogueSchema>;
