import ipa from "./ipa.json";
import { A1_LESSONS } from "./lessons/a1";
import { PRE_A1_LESSONS } from "./lessons/preA1";
import { BUILTIN_DIALOGUES } from "./dialogues";
import { DialogueSchema, LessonSchema, type Dialogue, type Lesson } from "./schema";

const IPA = ipa as Record<string, string>;

/** All fully written lessons, validated with Zod and enriched with IPA. */
export const BUILTIN_LESSONS: Record<string, Lesson> = Object.fromEntries(
  [...PRE_A1_LESSONS, ...A1_LESSONS].map((raw) => {
    const l = LessonSchema.parse(raw);
    l.vocab = l.vocab.map((w) => ({ ...w, ipa: w.ipa ?? IPA[w.word] }));
    return [l.id, l];
  }),
);

export const BUILTIN_DIALOGUE_LIST: Dialogue[] = BUILTIN_DIALOGUES.map((d) => DialogueSchema.parse(d));

export { OUTLINE, ENDLESS_THEMES, unitsForLevel, lessonId } from "./outline";
export { PLACEMENT } from "./placement";
export * from "./schema";
