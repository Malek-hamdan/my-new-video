import { describe, expect, it } from "vitest";
import { BUILTIN_LESSONS } from "@/content";
import { WebStore } from "@/db/webStore";
import { addLessonToDeck, previewIntervals, Rating, reviewCard } from "@/engine/srs";

describe("FSRS review deck", () => {
  it("adds words + grammar once and schedules reviews into the future", async () => {
    const store = new WebStore(false);
    const lesson = BUILTIN_LESSONS["PreA1-u1-l1"]!;
    const now = new Date("2026-03-01T10:00:00Z");
    expect(await addLessonToDeck(store, lesson, now)).toBe(7);
    expect(await addLessonToDeck(store, lesson, now)).toBe(0);
    const due = await store.dueCards(now.getTime(), 50);
    expect(due).toHaveLength(7);
    const card = due[0]!;
    const previews = await previewIntervals(card, now);
    expect(Object.keys(previews)).toHaveLength(4);
    const next = await reviewCard(store, card, Rating.Good, now);
    expect(next.due).toBeGreaterThan(now.getTime());
    // survives JSON round-trip (stored as TEXT in SQLite)
    const again = await reviewCard(store, JSON.parse(JSON.stringify(next)), Rating.Good, new Date(next.due));
    expect(again.due).toBeGreaterThan(next.due);
    expect((await store.dueCards(now.getTime(), 50)).length).toBe(6);
  });
});
