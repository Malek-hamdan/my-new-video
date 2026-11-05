import { describe, expect, it } from "vitest";
import { canonical, scoreSpeech, sentenceSimilarity } from "@/engine/text";
import { isCorrect, orderTiles } from "@/engine/quiz";

describe("speaking score (word by word)", () => {
  it("scores a perfect reading 100", () => {
    const r = scoreSpeech("I wake up at seven.", "i wake up at seven");
    expect(r.score).toBe(100);
    expect(r.words.every((w) => w.status === "correct")).toBe(true);
  });
  it("marks missed and close words", () => {
    const r = scoreSpeech("She works in an office", "she work in office");
    expect(r.words.map((w) => w.status)).toEqual(["correct", "close", "correct", "missed", "correct"]);
    expect(r.score).toBe(70);
  });
  it("handles empty transcripts", () => {
    expect(scoreSpeech("Hello there", "").score).toBe(0);
  });
});

describe("answer checking", () => {
  it("accepts contractions and alternatives", () => {
    expect(canonical("I'm fine")).toBe("i am fine");
    expect(isCorrect({ id: "x", type: "cloze", prompt: "I ___ Anna.", answer: "am", alternatives: ["'m"] }, " AM ")).toBe(true);
    expect(isCorrect({ id: "x", type: "cloze", prompt: "They ___ work.", answer: "don't", alternatives: ["do not"] }, "do not")).toBe(true);
    expect(isCorrect({ id: "x", type: "order", answer: "What is your name?" }, "what is your name")).toBe(true);
  });
  it("never shows order tiles already in the right order", () => {
    const tiles = orderTiles({ id: "o1", type: "order", answer: "What is your name?" });
    expect(tiles.join(" ")).not.toBe("What is your name");
    expect([...tiles].sort()).toEqual(["What", "is", "name", "your"].sort());
  });
  it("sentence similarity", () => {
    expect(sentenceSimilarity("Can I have the chicken salad, please?", "can i have the chicken salad please")).toBe(1);
    expect(sentenceSimilarity("Yes, please.", "No thanks")).toBeLessThan(0.5);
  });
});
