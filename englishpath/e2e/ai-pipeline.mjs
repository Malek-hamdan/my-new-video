import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const out = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (["error"].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));

// Seed: onboarded learner who passed Pre-A1 units 1–3 (the built-in content).
const lessons = {};
for (const u of [1, 2, 3]) for (const l of [1, 2, 3]) lessons[`PreA1-u${u}-l${l}`] = { steps: ["vocabulary","grammar","reading","listening","speaking","writing","quiz"], bestQuiz: 0.9, attempts: 1, passed: true, completedAt: Date.now() };
const progress = { version: 1, onboarded: true, placementDone: false, startLevel: "PreA1", placedOut: [], lessons, xp: 640, streak: { current: 3, best: 5, lastDay: null }, daily: { day: "", xp: 0 }, dailyGoal: 50, achievements: ["first_lesson"], reviews: 0, dialoguesDone: 0, settings: { theme: "dark", reducedMotion: "system", voiceRate: 0.9, haptics: true, reminder: { enabled: false, hour: 19, minute: 0 }, model: "claude-opus-5-5" } };
await p.addInitScript((snap) => localStorage.setItem("englishpath.webdb.v1", JSON.stringify(snap)), { kv: { progress }, srs: {}, cache: {}, attempts: [] });

const lesson = {
  title: "In the Room", goal: "Say where things are in a room with in, on and under.",
  vocab: [
    { id: "table", word: "table", pos: "noun", meaning: "A piece of furniture with a flat top and legs.", example: "The book is on the table.", emoji: "🪑", ipa: "/ˈteɪbəl/" },
    { id: "chair", word: "chair", pos: "noun", meaning: "A seat for one person.", example: "The cat is under the chair.", emoji: "🪑", ipa: "/ˈtʃɛr/" },
    { id: "bed", word: "bed", pos: "noun", meaning: "The furniture you sleep on.", example: "My phone is on the bed.", emoji: "🛏️", ipa: "/ˈbɛd/" },
    { id: "box", word: "box", pos: "noun", meaning: "A container with flat sides.", example: "The keys are in the box.", emoji: "📦", ipa: "/ˈbɑks/" },
    { id: "lamp", word: "lamp", pos: "noun", meaning: "A thing that gives light.", example: "The lamp is on the desk.", emoji: "💡", ipa: "/ˈlæmp/" },
    { id: "door", word: "door", pos: "noun", meaning: "You open it to go into a room.", example: "The bag is next to the door.", emoji: "🚪", ipa: "/ˈdɔr/" },
  ],
  grammar: { id: "g-in-on-under", title: "in / on / under",
    explanation: ["Use **in** for inside something.", "Use **on** for the top of something, and **under** for below."],
    examples: [{ en: "The pen is in the bag." }, { en: "The cup is on the table." }, { en: "The dog is under the bed." }],
    mistakes: [{ wrong: "The book is in the table.", right: "The book is on the table.", why: "A table has a top: use on." }],
    practice: [
      { id: "p1", type: "cloze", prompt: "The keys are ___ the box.", answer: "in" },
      { id: "p2", type: "mc", prompt: "The cat is ___ the chair (below it).", options: ["on", "under", "in"], answer: 1 },
      { id: "p3", type: "order", answer: "The lamp is on the desk." } ] },
  reading: { title: "My room", text: "My room is small. My bed is next to the window. My books are on the table and my bag is under the chair.", questions: [{ id: "r1", type: "mc", prompt: "Where is the bag?", options: ["on the table", "under the chair", "in the box"], answer: 1 }] },
  listening: { title: "Where is my phone?", script: [{ speaker: "Mia", text: "Where is my phone?" }, { speaker: "Dad", text: "It is on the bed." }], questions: [{ id: "l1", type: "mc", prompt: "Where is the phone?", options: ["on the bed", "under the bed"], answer: 0 }] },
  speaking: { prompts: ["The book is on the table.", "The cat is under the chair.", "Where is my bag?", "It is in the box."] },
  writing: { prompt: "Describe where three things are in your room.", minWords: 10, targetWords: ["on", "under"], model: "My lamp is on the desk. My shoes are under the bed." },
  quizExtra: [{ id: "q1", type: "mc", prompt: "You sleep in a…", options: ["bed", "box"], answer: 0 }],
};
const msg = (text) => ({ id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 10, output_tokens: 10 } });
const calls = [];
let lessonCalls = 0;
await p.route("https://api.anthropic.com/**", async (route) => {
  const req = route.request();
  const body = req.postDataJSON();
  calls.push({ url: req.url(), key: (await req.allHeaders())["x-api-key"]?.slice(0, 12), browser: req.headers()["anthropic-dangerous-direct-browser-access"], beta: req.headers()["anthropic-beta"], model: body.model, fallbacks: body.fallbacks, hasSchema: !!body.output_config?.format });
  const schemaStr = JSON.stringify(body.output_config?.format ?? {});
  let text = "ready";
  if (schemaStr.includes("quizExtra")) {
    lessonCalls++;
    // First answer is deliberately invalid to exercise the single retry.
    text = lessonCalls === 1 ? JSON.stringify({ ...lesson, vocab: [] }) : JSON.stringify(lesson);
  } else if (schemaStr.includes("nextTip")) {
    text = JSON.stringify({ score: 82, corrected: "My lamp is on the desk. My shoes are under the bed.", issues: [{ original: "My lamp are", correction: "My lamp is", explanation: "Lamp is singular, so use is.", type: "grammar" }], strengths: "Clear sentences and correct prepositions.", nextTip: "Add one more object next time." });
  }
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(msg(text)) });
});

await p.goto(BASE);
await p.waitForTimeout(1200);
// Add a (fake) key in Settings — stored in memory only in the browser build.
await p.getByRole("button", { name: "Settings" }).click();
await p.waitForTimeout(700);
await p.getByLabel("Claude API key").fill("sk-ant-api03-TESTKEYabcdefghijklmnopqrstuvwxyz0123");
await p.getByRole("button", { name: "Save" }).click();
await p.waitForTimeout(400);
await p.getByRole("button", { name: /Test connection/ }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/40-settings-key.png`, fullPage: true });
const ls = await p.evaluate(() => JSON.stringify(localStorage));
console.log("key in localStorage:", ls.includes("TESTKEY"));
// Continue to the first lesson that isn't built in.
await p.getByRole("button", { name: "Learn" }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/41-learn-next.png` });
await p.getByRole("button", { name: /Start lesson/ }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/42-needs-generation.png` });
await p.getByRole("button", { name: /Generate lesson/ }).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/43-generated-lesson.png` });
console.log("lesson generation calls:", lessonCalls);
console.log(JSON.stringify(calls, null, 0));
console.log(errors.join("\n") || "no console errors");
const cachedKeys = await p.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("englishpath.webdb.v1")).cache)).catch(() => []);
const ok = lessonCalls === 2 && !ls.includes("TESTKEY") && calls.every((c) => c.browser === "true") && cachedKeys.includes("lesson:PreA1-u4-l1");
if (!ok || errors.length) { console.error("E2E FAILED"); process.exitCode = 1; } else console.log("E2E PASSED: key kept out of storage, invalid JSON retried once, lesson validated + cached + rendered");
await b.close();
