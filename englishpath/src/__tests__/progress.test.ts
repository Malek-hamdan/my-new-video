import { describe, expect, it } from "vitest";
import {
  FIXED_LESSONS, addXp, canOpenStep, currentLevel, firstIndexOfLevel, frontier, indexOfLesson, initialProgress,
  isUnlocked, liveStreak, pathAt, placementResult, recordQuiz, xpRank,
} from "@/engine/progress";

describe("locked progression", () => {
  it("only the first lesson is open at the start", () => {
    const p = initialProgress();
    expect(isUnlocked(p, 0)).toBe(true);
    expect(isUnlocked(p, 1)).toBe(false);
    expect(isUnlocked(p, 5)).toBe(false);
  });

  it("79% does not unlock the next lesson; 80% does", () => {
    let p = initialProgress();
    p = recordQuiz(p, "PreA1-u1-l1", 0.79).state;
    expect(p.lessons["PreA1-u1-l1"]!.passed).toBe(false);
    expect(isUnlocked(p, 1)).toBe(false);
    p = recordQuiz(p, "PreA1-u1-l1", 0.8).state;
    expect(p.lessons["PreA1-u1-l1"]!.passed).toBe(true);
    expect(isUnlocked(p, 1)).toBe(true);
    expect(isUnlocked(p, 2)).toBe(false);
    expect(frontier(p)).toBe(1);
  });

  it("steps inside a lesson are sequential and the quiz needs all steps", () => {
    expect(canOpenStep([], "vocabulary")).toBe(true);
    expect(canOpenStep([], "grammar")).toBe(false);
    expect(canOpenStep(["vocabulary", "grammar", "reading", "listening", "speaking"], "quiz")).toBe(false);
    expect(canOpenStep(["vocabulary", "grammar", "reading", "listening", "speaking", "writing"], "quiz")).toBe(true);
  });

  it("levels up after the last lesson of a level", () => {
    let p = initialProgress();
    const last = firstIndexOfLevel("A1") - 1;
    for (let i = 0; i < last; i++) p = recordQuiz(p, pathAt(i).lessonId, 1).state;
    const out = recordQuiz(p, pathAt(last).lessonId, 0.9);
    expect(out.levelUp).toBe("A1");
    expect(currentLevel(out.state)).toBe("A1");
  });

  it("never runs out: the path continues past C2 with endless units", () => {
    const e = pathAt(FIXED_LESSONS + 4);
    expect(e.endless).toBe(true);
    expect(e.lessonId).toBe("END-u2-l2");
    expect(indexOfLesson("END-u2-l2")).toBe(FIXED_LESSONS + 4);
    expect(indexOfLesson("A1-u2-l3")).toBe(firstIndexOfLevel("A1") + 5);
    expect(pathAt(10_000).endless).toBe(true);
  });
});

describe("placement", () => {
  it("places at the first section below 80%", () => {
    const r = placementResult([
      { level: "PreA1", ratio: 1 },
      { level: "A1", ratio: 0.75 },
      { level: "A2", ratio: 0.5 },
    ]);
    expect(r).toEqual({ start: "A1", placedOut: ["PreA1"] });
    let p = { ...initialProgress(), startLevel: r.start, placedOut: r.placedOut };
    expect(isUnlocked(p, firstIndexOfLevel("A1"))).toBe(true);
    expect(isUnlocked(p, firstIndexOfLevel("A1") + 1)).toBe(false);
    expect(isUnlocked(p, 3)).toBe(true); // tested-out level open for revision
    expect(frontier(p)).toBe(firstIndexOfLevel("A1"));
  });
  it("passing everything places at C2", () => {
    expect(placementResult(["PreA1", "A1", "A2", "B1", "B2", "C1"].map((level) => ({ level: level as never, ratio: 1 }))).start).toBe("C2");
  });
});

describe("xp and streak", () => {
  it("counts consecutive days and resets after a gap", () => {
    let p = initialProgress();
    p = addXp(p, 10, new Date(2026, 0, 1, 9));
    p = addXp(p, 10, new Date(2026, 0, 1, 20));
    p = addXp(p, 10, new Date(2026, 0, 2, 9));
    expect(p.streak.current).toBe(2);
    expect(liveStreak(p, new Date(2026, 0, 3, 9))).toBe(2);
    expect(liveStreak(p, new Date(2026, 0, 4, 9))).toBe(0);
    p = addXp(p, 10, new Date(2026, 0, 5, 9));
    expect(p.streak.current).toBe(1);
    expect(p.streak.best).toBe(2);
  });
  it("computes XP ranks", () => {
    expect(xpRank(0).rank).toBe(1);
    expect(xpRank(100).rank).toBe(2);
    expect(xpRank(299).rank).toBe(2);
    expect(xpRank(300).rank).toBe(3);
  });
});
