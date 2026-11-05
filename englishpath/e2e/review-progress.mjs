import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const out = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));

const now = Date.now();
const lessons = {};
for (const u of [1, 2]) for (const l of [1, 2, 3]) lessons[`PreA1-u${u}-l${l}`] = { steps: ["vocabulary","grammar","reading","listening","speaking","writing","quiz"], bestQuiz: 0.9, attempts: 1, passed: true, completedAt: now };
const progress = { version: 1, onboarded: true, placementDone: false, startLevel: "PreA1", placedOut: [], lessons, xp: 420, streak: { current: 4, best: 6, lastDay: null }, daily: { day: "", xp: 0 }, dailyGoal: 50, achievements: ["first_lesson", "streak_3", "first_dialogue"], reviews: 12, dialoguesDone: 1, settings: { theme: "dark", reducedMotion: "system", voiceRate: 0.9, haptics: true, reminder: { enabled: false, hour: 19, minute: 0 }, model: "claude-opus-5-5" } };
const newCard = (id) => ({ stability: 0, stabilityFast: 0, difficulty: 0, state: 0, scheduleStatus: "new", dueAt: new Date(now - 60000).toISOString(), lastReviewAt: null, cardId: id, reps: 0, lapses: 0, scheduledDays: 0, learningStep: 0 });
const srs = {
  "w:mother": { id: "w:mother", kind: "word", ref: "PreA1-u2-l1", front: "mother", back: "Your female parent. Also: mum, mom.", data: { example: "My mother is a nurse.", emoji: "👩", ipa: "/ˈməðɝ/", pos: "noun" }, due: now - 60000, card: newCard("c1") },
  "w:brother": { id: "w:brother", kind: "word", ref: "PreA1-u2-l1", front: "brother", back: "A boy with the same parents as you.", data: { example: "This is my brother, Max.", emoji: "👦", ipa: "/ˈbrəðɝ/", pos: "noun" }, due: now - 60000, card: newCard("c2") },
  "g:g-he-she-is": { id: "g:g-he-she-is", kind: "grammar", ref: "PreA1-u2-l2", front: "He is / She is", back: "Use **he** for a man or boy.\nWith he, she and it we use **is**.", data: { examples: ["He is a doctor."], mistake: { wrong: "She are happy.", right: "She is happy." } }, due: now - 60000, card: newCard("c3") },
};
const day = (d) => now - d * 864e5;
const attempts = [
  ...[0, 1, 2, 3].map((d) => ({ ts: day(d), skill: "vocabulary", correct: 8, total: 10, tag: "lesson:x" })),
  { ts: day(1), skill: "grammar", correct: 1, total: 4, tag: "grammar:g-a-an" },
  { ts: day(2), skill: "grammar", correct: 3, total: 3, tag: "grammar:g-this-is-my" },
  { ts: day(0), skill: "reading", correct: 2, total: 2, tag: "reading:PreA1-u1-l1" },
  { ts: day(0), skill: "listening", correct: 1, total: 4, tag: "listening:PreA1-u2-l3" },
  { ts: day(3), skill: "speaking", correct: 76, total: 100, tag: "speaking:PreA1-u1-l1" },
  { ts: day(5), skill: "writing", correct: 64, total: 100, tag: "writing:PreA1-u1-l2" },
];
await p.addInitScript((snap) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("englishpath.webdb.v1", JSON.stringify(snap)); sessionStorage.setItem("seeded", "1"); } }, { kv: { progress }, srs, cache: {}, attempts });

await p.goto(BASE);
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/49-start.png` });
const badge = await p.getByRole("button", { name: "Review", exact: true }).innerText();
await p.getByRole("button", { name: "Review", exact: true }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/50-review-home.png` });
await p.getByRole("button", { name: /Start review/ }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/51-review-front.png` });
await p.getByRole("button", { name: "Show answer" }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/52-review-back.png` });
const goodLabel = await p.getByRole("button", { name: /Good/ }).innerText();
await p.getByRole("button", { name: /Good/ }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Show answer" }).click();
await p.getByRole("button", { name: /Easy/ }).click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: "Show answer" }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/53-review-grammar.png` });
await p.getByRole("button", { name: /Good/ }).click();
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/54-review-done.png` });
const after = JSON.parse(await p.evaluate(() => localStorage.getItem("englishpath.webdb.v1")));
const dueLeft = Object.values(after.srs).filter((r) => r.due <= Date.now()).length;
await p.getByRole("button", { name: "Done" }).click();
await p.waitForTimeout(600);
await p.getByRole("button", { name: "Progress", exact: true }).click();
await p.waitForTimeout(1200);
await p.screenshot({ path: `${out}/55-progress.png` });
await p.screenshot({ path: `${out}/56-progress-full.png`, fullPage: true });
const weakText = await p.getByText("Weak points").locator("..").locator("..").innerText();
await p.getByRole("button", { name: "Settings", exact: true }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/57-settings.png`, fullPage: true });
// Light theme
await p.getByRole("radio", { name: "Light" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Learn", exact: true }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/58-learn-light.png` });
await p.getByRole("button", { name: "Progress", exact: true }).click();
await p.waitForTimeout(900);
await p.screenshot({ path: `${out}/59-progress-light.png` });
const sw = await p.evaluate(() => document.documentElement.scrollWidth);
console.log({ badge, goodLabel, dueLeft, weakHasA_An: weakText.includes("a / an"), scrollWidth: sw });
console.log(errors.join("\n") || "no console errors");
const ok = badge.includes("3") && dueLeft === 0 && weakText.includes("a / an") && sw === 390 && !errors.length;
if (!ok) { console.error("E2E FAILED"); process.exitCode = 1; } else console.log("E2E PASSED: FSRS review session, dashboard, weak points, settings, light theme");
await b.close();
