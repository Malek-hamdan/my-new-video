import { z } from "zod";
import { DialogueSchema, LessonSchema } from "@/content/schema";

/** What the model returns for a lesson (ids and unit are assigned locally). */
export const GenLessonSchema = LessonSchema.omit({ id: true, unitId: true, source: true });
export type GenLesson = z.infer<typeof GenLessonSchema>;

export const GenDialogueSchema = DialogueSchema.omit({ id: true, source: true });
export type GenDialogue = z.infer<typeof GenDialogueSchema>;

export const WritingFeedbackSchema = z.object({
  score: z.number().int().min(0).max(100),
  corrected: z.string().min(1).max(3000),
  issues: z
    .array(
      z.object({
        original: z.string().min(1).max(300),
        correction: z.string().min(1).max(300),
        explanation: z.string().min(1).max(400),
        type: z.enum(["grammar", "vocabulary", "spelling", "punctuation", "style"]),
      }),
    )
    .max(12),
  strengths: z.string().min(1).max(400),
  nextTip: z.string().min(1).max(300),
});
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;

export const RoleplayTurnSchema = z.object({
  reply: z.string().min(1).max(600),
  correction: z.object({
    needed: z.boolean(),
    original: z.string().max(400),
    corrected: z.string().max(400),
    explanation: z.string().max(400),
  }),
  suggestion: z.string().max(300),
  finished: z.boolean(),
});
export type RoleplayTurn = z.infer<typeof RoleplayTurnSchema>;

export const UnitPlanSchema = z.object({
  title: z.string().min(1).max(120),
  canDo: z.string().min(1).max(200),
  grammarFocus: z.array(z.string().min(1).max(120)).length(3),
  vocabTopics: z.array(z.string().min(1).max(80)).min(1).max(4),
  lessonTitles: z.array(z.string().min(1).max(120)).length(3),
});
export type UnitPlan = z.infer<typeof UnitPlanSchema>;
