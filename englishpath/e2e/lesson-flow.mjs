import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
const out = process.env.SHOTS ?? "e2e/screenshots";
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, colorScheme: "dark" });
const p = await ctx.newPage();
const errors = [];
p.on("console", (m) => { if (["error", "warning"].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await p.goto(BASE);
await p.waitForTimeout(3500);
await p.screenshot({ path: `${out}/10-onboarding-dark.png` });
await p.getByRole("button", { name: /Get started/ }).click();
await p.getByRole("button", { name: /new to English/ }).click();
await p.waitForTimeout(800);
await p.getByRole("button", { name: /Start lesson/ }).click();
await p.waitForTimeout(800);
// Vocabulary: go through all words
for (let i = 0; i < 5; i++) { await p.getByRole("button", { name: /Next word/ }).click(); await p.waitForTimeout(200); }
await p.getByRole("button", { name: /I know these words/ }).click();
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/11-grammar.png`, fullPage: false });
await p.getByRole("button", { name: /Practise/ }).click();
// Answer generic questions: pick first option or type "am"
async function answerAll(n) {
  for (let i = 0; i < n; i++) {
    await p.waitForTimeout(250);
    const radios = p.getByRole("radio");
    if (await radios.count()) await radios.first().click();
    else if (await p.getByLabel("Your answer").count()) await p.getByLabel("Your answer").fill("am");
    else { const tiles = p.locator("div.mt-3.flex.flex-wrap button:not([disabled])"); while (await tiles.count()) await tiles.first().click(); }
    await p.getByRole("button", { name: "Check" }).click();
    await p.waitForTimeout(250);
    if (i === 0) await p.screenshot({ path: `${out}/12-feedback.png` });
    await p.getByRole("button", { name: /Continue|Finish/ }).click();
  }
}
await answerAll(3);
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/13-reading.png` });
await p.getByRole("button", { name: /Answer 2 questions/ }).click();
await answerAll(2);
await p.waitForTimeout(500);
await p.getByRole("button", { name: /Play recording/ }).click();
await p.waitForTimeout(9000);
await p.screenshot({ path: `${out}/14-listening.png` });
await p.getByRole("button", { name: /Answer 2 questions/ }).click();
await answerAll(2);
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/15-speaking.png` });
// Speaking: typed fallback (no mic in headless)
for (let i = 0; i < 4; i++) {
  if (await p.getByRole("button", { name: "Type instead" }).count()) await p.getByRole("button", { name: "Type instead" }).click();
  const sentence = await p.locator(".display").first().innerText();
  await p.getByLabel("Type what you said").fill(i === 1 ? "thank" : sentence);
  await p.getByRole("button", { name: /Check what I said/ }).click();
  await p.waitForTimeout(300);
  if (i === 1) await p.screenshot({ path: `${out}/16-speaking-score.png` });
  await p.getByRole("button", { name: /Next sentence|Finish speaking/ }).click();
  await p.waitForTimeout(300);
}
await p.getByLabel("Your text").fill("hello! i is Carlos. thank you");
await p.getByRole("button", { name: /Check my writing/ }).click();
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/17-writing.png`, fullPage: true });
await p.getByRole("button", { name: /Continue to quiz/ }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/18-quiz.png` });
await answerAll(10);
await p.waitForTimeout(2500);
await p.screenshot({ path: `${out}/19-quiz-result.png` });
// Back button (Escape) inside lesson must open the confirm sheet, not leave.
await p.keyboard.press("Escape");
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/20-exit-sheet.png` });
const sheet = await p.getByText("Leave this lesson?").count();
console.log("exit sheet visible:", sheet);
await p.getByRole("button", { name: "Leave lesson" }).click();
await p.waitForTimeout(700);
// Next lesson must still be locked if the quiz failed
await p.getByRole("button", { name: /First Words/ }).click();
await p.waitForTimeout(700);
await p.screenshot({ path: `${out}/21-unit.png` });
const lockedBtn = p.getByRole("button", { name: /Numbers 1 to 10/ });
console.log("lesson 2 disabled:", await lockedBtn.isDisabled());
console.log(errors.join("\n") || "no console errors");
if (!sheet || !(await lockedBtn.isDisabled()) || errors.length) { console.error("E2E FAILED"); process.exitCode = 1; } else console.log("E2E PASSED: lesson flow, back button, 80% gate");
await b.close();
