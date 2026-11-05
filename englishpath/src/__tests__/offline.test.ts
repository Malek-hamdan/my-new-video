import { describe, expect, it } from "vitest";
import { BUILTIN_LESSONS } from "@/content";
import { buildPractice, offlineTurnCheck, offlineWritingCheck } from "@/engine/offline";

describe("offline engine", () => {
  it("finds common beginner errors and explains them", () => {
    const fb = offlineWritingCheck("i is a student. she have a cat", { minWords: 6, targetWords: ["student"] });
    expect(fb.corrected).toBe("I am a student. She has a cat.");
    expect(fb.issues.length).toBeGreaterThanOrEqual(3);
    expect(fb.issues.every((i) => i.explanation.length > 0)).toBe(true);
  });
  it("produces endless, different practice sets", () => {
    const lessons = Object.values(BUILTIN_LESSONS).slice(0, 3);
    const a = buildPractice(lessons, [], 1);
    const b = buildPractice(lessons, [], 2);
    expect(a).toHaveLength(10);
    expect(b).toHaveLength(10);
    expect(a.map((q) => q.id).join()).not.toBe(b.map((q) => q.id).join());
    expect(buildPractice(lessons, [], 999_999)).toHaveLength(10);
  });
  it("checks role-play lines", () => {
    expect(offlineTurnCheck("Yes, please. How much are the apples?", "yes please how much are the apples").ok).toBe(true);
    expect(offlineTurnCheck("Yes, please. How much are the apples?", "goodbye").ok).toBe(false);
  });
});
