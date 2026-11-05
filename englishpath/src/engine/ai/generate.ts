import { LEVEL_LABEL, type Dialogue, type DialogueTopic, type Lesson, type Level, type UnitOutline } from "@/content/schema";
import { ENDLESS_THEMES, OUTLINE } from "@/content/outline";
import type { Store } from "@/db/types";
import { hashString } from "../text";
import { generateJson, type ModelId } from "./client";
import {
  GenDialogueSchema,
  GenLessonSchema,
  RoleplayTurnSchema,
  UnitPlanSchema,
  WritingFeedbackSchema,
  type RoleplayTurn,
  type UnitPlan,
  type WritingFeedback,
} from "./schemas";

const LEVEL_GUIDE: Record<Level, string> = {
  PreA1: "absolute beginner: very short sentences (3–6 words), present tense of be, the most common 300 words, no idioms",
  A1: "beginner: short simple sentences, present simple/continuous, can/can't, past of be, everyday words (top 1,000)",
  A2: "elementary: simple past, going to, comparatives, present perfect basics, common phrasal verbs, top 2,000 words",
  B1: "intermediate: all main tenses, conditionals 1–2, passive, reported speech, opinions and short arguments",
  B2: "upper intermediate: mixed conditionals, modals of deduction, nuance, abstract topics, varied collocations",
  C1: "advanced: inversion, hedging, nominalisation, idioms, register control, complex arguments",
  C2: "mastery: subtle connotation, stylistic and rhetorical control, idiomatic precision, any topic",
};

const SYSTEM = `You are EnglishPath's curriculum writer: an expert ESL teacher and CEFR materials designer.
Everything is written in clear English only (the learner's interface is English-only).
Write original material — never reproduce published course books or copyrighted texts.
Keep content inclusive, friendly and culturally neutral. Use **double asterisks** to bold key forms in grammar explanations.
Return only data that matches the requested JSON schema.`;

export interface LearnerContext {
  level: Level;
  weakPoints: string[];
  knownWords: string[];
  model: ModelId;
}

const weakLine = (ctx: LearnerContext) =>
  ctx.weakPoints.length
    ? `The learner is weak at: ${ctx.weakPoints.slice(0, 6).join("; ")}. Recycle and practise these where it fits naturally.`
    : "No weak points recorded yet.";

// ───────────────────────── Lessons ─────────────────────────

/** Plans an endless unit (after the fixed C2 outline). Cached forever once made. */
export async function getEndlessUnit(store: Store, unitId: string, n: number, ctx: LearnerContext): Promise<UnitOutline> {
  const cached = await store.getCache("unit", unitId);
  if (cached) return JSON.parse(cached.json) as UnitOutline;
  const theme = ENDLESS_THEMES[(n - 1) % ENDLESS_THEMES.length]!;
  const plan: UnitPlan = await generateJson({
    schema: UnitPlanSchema,
    model: ctx.model,
    maxTokens: 2000,
    system: SYSTEM,
    prompt: `Plan mastery unit #${n} of an endless C2 English course. Theme: "${theme}" (cycle ${Math.ceil(n / ENDLESS_THEMES.length)}; make it different from earlier cycles).
${weakLine(ctx)}
Give a title, a one-sentence can-do goal, exactly 3 grammar/discourse focuses (one per lesson), up to 4 vocabulary topics and exactly 3 lesson titles.`,
  });
  const unit: UnitOutline = {
    id: unitId,
    level: "C2",
    index: OUTLINE.length + n,
    title: plan.title,
    canDo: plan.canDo,
    grammarFocus: plan.grammarFocus,
    vocabTopics: plan.vocabTopics,
    lessonTitles: [plan.lessonTitles[0]!, plan.lessonTitles[1]!, plan.lessonTitles[2]!],
  };
  await store.putCache({ kind: "unit", key: unitId, level: "C2", json: JSON.stringify(unit), created: Date.now() });
  return unit;
}

/** Generates (or loads from cache) one full lesson for a unit outline. */
export async function generateLesson(
  store: Store,
  unit: UnitOutline,
  lessonNo: 1 | 2 | 3,
  ctx: LearnerContext,
): Promise<Lesson> {
  const id = `${unit.id}-l${lessonNo}`;
  const cached = await store.getCache("lesson", id);
  if (cached) return JSON.parse(cached.json) as Lesson;

  const title = unit.lessonTitles[lessonNo - 1]!;
  const grammar = unit.grammarFocus[lessonNo - 1] ?? unit.grammarFocus[0]!;
  const avoid = ctx.knownWords.slice(-150).join(", ");
  const gen = await generateJson({
    schema: GenLessonSchema,
    model: ctx.model,
    maxTokens: 16000,
    system: SYSTEM,
    prompt: `Write lesson ${lessonNo} of 3 in the unit "${unit.title}" (CEFR ${LEVEL_LABEL[unit.level]}).
Unit goal: ${unit.canDo}
Lesson title: "${title}". Grammar focus: ${grammar}. Vocabulary topics: ${unit.vocabTopics.join(", ")}.
Level guide: ${LEVEL_GUIDE[unit.level]}.
${weakLine(ctx)}
Words the learner already knows (do not teach them again as new vocabulary): ${avoid || "none yet"}.

Requirements:
- title and goal (one sentence).
- vocab: 6–8 NEW items. Each: id (kebab-case), word, pos, a simple English meaning at or below the level, a natural example sentence, ONE emoji that illustrates it, and ipa in General American IPA between slashes.
- grammar: id (kebab-case), title, 2–4 short explanation paragraphs, 3–5 examples (en + optional note), 2–3 common mistakes (wrong/right/why), and 3–5 practice questions.
- reading: an original text of ${unit.level === "PreA1" || unit.level === "A1" ? "60–120" : unit.level === "A2" || unit.level === "B1" ? "150–250" : "250–400"} words using the new words and grammar; 2–3 questions.
- listening: a short script (4–10 lines with speaker names) that will be read aloud by text-to-speech; 2–3 questions.
- speaking: 4 sentences to read aloud, using the target language.
- writing: a task prompt, minWords suitable for the level, 2–4 targetWords to include, and a model answer.
- quizExtra: 2–3 extra questions.
Question formats: "mc" (options 3–4, answer = zero-based index of the correct option), "cloze" (prompt contains exactly one ___, answer = the missing word(s), optional alternatives), "order" (answer = a correct sentence of 4–12 words). Every question id must be unique within the lesson.`,
  });
  const lesson: Lesson = { ...gen, id, unitId: unit.id, source: "ai" };
  await store.putCache({ kind: "lesson", key: id, level: unit.level, json: JSON.stringify(lesson), created: Date.now() });
  return lesson;
}

// ───────────────────────── Dialogues ─────────────────────────

export async function generateDialogue(store: Store, topic: DialogueTopic, ctx: LearnerContext): Promise<Dialogue> {
  const existing = (await store.listCache("dialogue", ctx.level)).map((r) => (JSON.parse(r.json) as Dialogue).title);
  const gen = await generateJson({
    schema: GenDialogueSchema,
    model: ctx.model,
    maxTokens: 6000,
    system: SYSTEM,
    prompt: `Write a new realistic dialogue for the topic "${topic}" at CEFR ${LEVEL_LABEL[ctx.level]} (${LEVEL_GUIDE[ctx.level]}).
Speaker A is the other person; speaker B is the learner. 8–12 lines, alternating, starting with A. Set "level" to "${ctx.level}" and "topic" to "${topic}".
Give a short title, a one-sentence setting (second person: "You…"), role names (B should be "You"), and 3–5 useful phrases with simple meanings.
${weakLine(ctx)}
Avoid these existing titles: ${existing.slice(0, 30).join(" | ") || "none"}.`,
  });
  const d: Dialogue = { ...gen, id: `ai-d-${Date.now().toString(36)}`, source: "ai" };
  await store.putCache({ kind: "dialogue", key: d.id, level: d.level, json: JSON.stringify(d), created: Date.now() });
  return d;
}

/** One AI role-play turn: replies in character at the learner's level and corrects the learner's last line. */
export async function roleplayTurn(
  dialogue: Dialogue,
  history: { who: "ai" | "learner"; text: string }[],
  learnerText: string,
  ctx: LearnerContext,
): Promise<RoleplayTurn> {
  const transcript = history.map((h) => `${h.who === "ai" ? dialogue.roles.A : "Learner"}: ${h.text}`).join("\n");
  return generateJson({
    schema: RoleplayTurnSchema,
    model: ctx.model,
    maxTokens: 1500,
    system: `${SYSTEM}
You are role-playing "${dialogue.roles.A}" in this scenario: ${dialogue.setting}
Speak at CEFR ${LEVEL_LABEL[ctx.level]} (${LEVEL_GUIDE[ctx.level]}). Keep each reply to 1–3 sentences and keep the conversation moving.
After every learner line, check it. If it has a real error (grammar, word choice, or something unnatural), set correction.needed=true with the original, a corrected version and a short, kind explanation. Ignore missing final punctuation and capital letters. If it is fine, needed=false and leave the other correction fields empty.
"suggestion" is one example of what the learner could say next. Set finished=true when the scenario reaches a natural end (usually after 6–10 exchanges).`,
    prompt: `Conversation so far:\n${transcript || "(start)"}\nLearner: ${learnerText}`,
  });
}

// ───────────────────────── Writing ─────────────────────────

export async function correctWriting(
  store: Store,
  task: { prompt: string; targetWords: string[] },
  text: string,
  ctx: LearnerContext,
): Promise<WritingFeedback> {
  const key = String(hashString(`${task.prompt}|${text}|${ctx.level}`));
  const cached = await store.getCache("writing", key);
  if (cached) return JSON.parse(cached.json) as WritingFeedback;
  const fb = await generateJson({
    schema: WritingFeedbackSchema,
    model: ctx.model,
    maxTokens: 4000,
    system: `${SYSTEM}
You correct learner writing like a supportive teacher. Judge it against CEFR ${LEVEL_LABEL[ctx.level]} expectations.`,
    prompt: `Task: ${task.prompt}
Target words to include: ${task.targetWords.join(", ") || "none"}.
Learner's text:
"""${text}"""

Return: score (0–100, task completion + accuracy for this level), the full corrected text (minimal changes, keep the learner's ideas), up to 8 issues (original fragment, correction, a short explanation the learner can understand, type), one sentence on strengths, and one practical tip for next time.`,
  });
  await store.putCache({ kind: "writing", key, level: ctx.level, json: JSON.stringify(fb), created: Date.now() });
  return fb;
}
