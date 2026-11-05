import { describe, expect, it } from "vitest";
import { BUILTIN_DIALOGUE_LIST, BUILTIN_LESSONS, LEVELS, OUTLINE, PLACEMENT, QuestionSchema } from "@/content";
import { buildQuiz, isCorrect, correctText } from "@/engine/quiz";

describe("curriculum content", () => {
  it("outlines every CEFR level with 3 lessons per unit", () => {
    for (const level of LEVELS) expect(OUTLINE.filter((u) => u.level === level).length).toBeGreaterThanOrEqual(6);
    expect(OUTLINE.length).toBe(54);
    expect(new Set(OUTLINE.map((u) => u.id)).size).toBe(OUTLINE.length);
  });

  it("has fully written units 1–3 for Pre-A1 and A1 (18 lessons)", () => {
    const ids = Object.keys(BUILTIN_LESSONS);
    expect(ids).toHaveLength(18);
    for (const lvl of ["PreA1", "A1"]) for (const u of [1, 2, 3]) for (const l of [1, 2, 3]) expect(ids).toContain(`${lvl}-u${u}-l${l}`);
  });

  it("every vocabulary item has IPA", () => {
    for (const l of Object.values(BUILTIN_LESSONS)) for (const w of l.vocab) expect(w.ipa, w.word).toMatch(/^\/.+\/$/);
  });

  it("builds a valid 10-question quiz for every lesson, and its answer key is correct", () => {
    for (const l of Object.values(BUILTIN_LESSONS)) {
      for (const attempt of [0, 1, 2]) {
        const quiz = buildQuiz(l, attempt);
        expect(quiz, l.id).toHaveLength(10);
        expect(new Set(quiz.map((q) => q.id)).size).toBe(10);
        for (const q of quiz) {
          expect(QuestionSchema.safeParse(q).success, `${l.id} ${q.id}`).toBe(true);
          const key = q.type === "mc" ? q.answer : correctText(q);
          expect(isCorrect(q, key), `${l.id} ${q.id}`).toBe(true);
        }
      }
    }
  });

  it("validates built-in dialogues and placement", () => {
    expect(BUILTIN_DIALOGUE_LIST.length).toBe(10);
    expect(new Set(BUILTIN_DIALOGUE_LIST.map((d) => d.topic)).size).toBe(10);
    expect(PLACEMENT.map((p) => p.level)).toEqual(["PreA1", "A1", "A2", "B1", "B2", "C1"]);
  });
});
