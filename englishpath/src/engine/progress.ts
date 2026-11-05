import { OUTLINE } from "@/content/outline";
import { LESSON_STEPS, LEVELS, PASS_MARK, type Level, type LessonStep } from "@/content/schema";

export interface LessonProgress {
  steps: LessonStep[];
  bestQuiz: number;
  attempts: number;
  passed: boolean;
  completedAt?: number;
}

export interface Settings {
  theme: "system" | "dark" | "light";
  reducedMotion: "system" | "on" | "off";
  voiceRate: number;
  haptics: boolean;
  reminder: { enabled: boolean; hour: number; minute: number };
  model: "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";
}

export interface ProgressState {
  version: 1;
  onboarded: boolean;
  placementDone: boolean;
  startLevel: Level;
  placedOut: Level[];
  lessons: Record<string, LessonProgress>;
  xp: number;
  streak: { current: number; best: number; lastDay: string | null };
  daily: { day: string; xp: number };
  dailyGoal: number;
  achievements: string[];
  reviews: number;
  dialoguesDone: number;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  reducedMotion: "system",
  voiceRate: 0.9,
  haptics: true,
  reminder: { enabled: false, hour: 19, minute: 0 },
  model: "claude-opus-5-5",
};

export const initialProgress = (): ProgressState => ({
  version: 1,
  onboarded: false,
  placementDone: false,
  startLevel: "PreA1",
  placedOut: [],
  lessons: {},
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null },
  daily: { day: dayKey(new Date()), xp: 0 },
  dailyGoal: 50,
  achievements: [],
  reviews: 0,
  dialoguesDone: 0,
  settings: { ...DEFAULT_SETTINGS },
});

// ───────────────────────── Path (fixed outline + endless) ─────────────────────────

export const LESSONS_PER_UNIT = 3;
export const FIXED_UNITS = OUTLINE.length;
export const FIXED_LESSONS = FIXED_UNITS * LESSONS_PER_UNIT;

export interface PathEntry {
  index: number;
  lessonId: string;
  unitId: string;
  unitIndex: number;
  lessonNo: 1 | 2 | 3;
  level: Level;
  endless: boolean;
}

/** Endless units continue after the fixed C2 outline: E1, E2, … (always C2). */
export const endlessUnitId = (n: number) => `END-u${n}`;

/** The learning path is infinite: index → lesson. */
export function pathAt(index: number): PathEntry {
  const unitPos = Math.floor(index / LESSONS_PER_UNIT);
  const lessonNo = ((index % LESSONS_PER_UNIT) + 1) as 1 | 2 | 3;
  if (unitPos < FIXED_UNITS) {
    const u = OUTLINE[unitPos]!;
    return { index, lessonId: `${u.id}-l${lessonNo}`, unitId: u.id, unitIndex: unitPos, lessonNo, level: u.level, endless: false };
  }
  const n = unitPos - FIXED_UNITS + 1;
  const unitId = endlessUnitId(n);
  return { index, lessonId: `${unitId}-l${lessonNo}`, unitId, unitIndex: unitPos, lessonNo, level: "C2", endless: true };
}

export function indexOfLesson(lessonId: string): number {
  const m = /^(.*)-l([123])$/.exec(lessonId);
  if (!m) return -1;
  const unitId = m[1]!;
  const no = Number(m[2]);
  const end = /^END-u(\d+)$/.exec(unitId);
  if (end) return (FIXED_UNITS + Number(end[1]) - 1) * LESSONS_PER_UNIT + no - 1;
  const u = OUTLINE.findIndex((x) => x.id === unitId);
  return u < 0 ? -1 : u * LESSONS_PER_UNIT + no - 1;
}

export const firstIndexOfLevel = (level: Level) => OUTLINE.findIndex((u) => u.level === level) * LESSONS_PER_UNIT;

const isPassed = (p: ProgressState, i: number) => i >= 0 && !!p.lessons[pathAt(i).lessonId]?.passed;

/**
 * Locked progression: a lesson opens only when the previous one's quiz was passed
 * (≥80%). The placement start lesson is always open, and levels the learner tested
 * out of in the placement test (≥80% on that section) are open for revision.
 */
export function isUnlocked(p: ProgressState, index: number): boolean {
  if (index === 0) return true;
  const e = pathAt(index);
  if (p.placedOut.includes(e.level)) return true;
  if (index === firstIndexOfLevel(p.startLevel)) return true;
  return isPassed(p, index - 1);
}

/** The first open, not-yet-passed lesson: where "Continue" takes the learner. */
export function frontier(p: ProgressState): number {
  let i = Math.max(0, firstIndexOfLevel(p.startLevel));
  while (isPassed(p, i)) i++;
  return i;
}

export const currentLevel = (p: ProgressState): Level => pathAt(frontier(p)).level;

/** Step gating inside a lesson: each step requires all previous ones. */
export function canOpenStep(done: LessonStep[], step: LessonStep): boolean {
  const idx = LESSON_STEPS.indexOf(step);
  return LESSON_STEPS.slice(0, idx).every((s) => done.includes(s));
}

export const passes = (ratio: number) => ratio >= PASS_MARK - 1e-9;

// ───────────────────────── XP, streak, daily goal ─────────────────────────

export const XP = {
  step: 10,
  writing: 15,
  quizPass: 30,
  quizPerfect: 10,
  quizFail: 5,
  review: 2,
  dialogue: 20,
  practice: 15,
} as const;

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const prevDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return dayKey(new Date(y, m - 1, d - 1));
};

/** Adds XP, rolls the daily counter and updates the streak (pure). */
export function addXp(p: ProgressState, amount: number, now = new Date()): ProgressState {
  const today = dayKey(now);
  const daily = p.daily.day === today ? { day: today, xp: p.daily.xp + amount } : { day: today, xp: amount };
  let streak = p.streak;
  if (amount > 0 && streak.lastDay !== today) {
    const current = streak.lastDay === prevDay(today) ? streak.current + 1 : 1;
    streak = { current, best: Math.max(streak.best, current), lastDay: today };
  }
  return { ...p, xp: p.xp + amount, daily, streak };
}

/** Streak shown to the user: 0 if they missed yesterday and today. */
export function liveStreak(p: ProgressState, now = new Date()): number {
  const today = dayKey(now);
  if (p.streak.lastDay === today || p.streak.lastDay === prevDay(today)) return p.streak.current;
  return 0;
}

export const todaysXp = (p: ProgressState, now = new Date()) => (p.daily.day === dayKey(now) ? p.daily.xp : 0);

/** XP rank: level n needs 100·n·(n+1)/2 total XP (100, 300, 600, …). */
export function xpRank(xp: number) {
  let n = 0;
  while (100 * ((n + 1) * (n + 2)) / 2 <= xp) n++;
  const base = (100 * n * (n + 1)) / 2;
  const next = (100 * (n + 1) * (n + 2)) / 2;
  return { rank: n + 1, into: xp - base, span: next - base };
}

// ───────────────────────── Lesson events ─────────────────────────

export function completeStep(p: ProgressState, lessonId: string, step: LessonStep): ProgressState {
  const lp = p.lessons[lessonId] ?? { steps: [], bestQuiz: 0, attempts: 0, passed: false };
  if (lp.steps.includes(step)) return p;
  return { ...p, lessons: { ...p.lessons, [lessonId]: { ...lp, steps: [...lp.steps, step] } } };
}

export interface QuizOutcome {
  state: ProgressState;
  passed: boolean;
  firstPass: boolean;
  levelUp: Level | null;
  xp: number;
}

/** Records a quiz attempt. Only ≥80% marks the lesson passed and opens the next one. */
export function recordQuiz(p: ProgressState, lessonId: string, ratio: number, now = new Date()): QuizOutcome {
  const lp = p.lessons[lessonId] ?? { steps: [], bestQuiz: 0, attempts: 0, passed: false };
  const passed = passes(ratio);
  const firstPass = passed && !lp.passed;
  const steps = passed && !lp.steps.includes("quiz") ? [...lp.steps, "quiz" as const] : lp.steps;
  const next: LessonProgress = {
    ...lp,
    steps,
    attempts: lp.attempts + 1,
    bestQuiz: Math.max(lp.bestQuiz, ratio),
    passed: lp.passed || passed,
    ...(firstPass ? { completedAt: now.getTime() } : {}),
  };
  const xp = passed ? XP.quizPass + (ratio === 1 ? XP.quizPerfect : 0) : XP.quizFail;
  let state = addXp({ ...p, lessons: { ...p.lessons, [lessonId]: next } }, xp, now);

  let levelUp: Level | null = null;
  if (firstPass) {
    const idx = indexOfLesson(lessonId);
    const here = pathAt(idx);
    const after = pathAt(idx + 1);
    if (!here.endless && after.level !== here.level) levelUp = after.level;
    if (!here.endless && after.endless) levelUp = "C2";
  }
  state = { ...state, achievements: evaluateAchievements(state, { levelUp }) };
  return { state, passed, firstPass, levelUp, xp };
}

// ───────────────────────── Achievements ─────────────────────────

export const ACHIEVEMENTS: Record<string, { title: string; detail: string; emoji: string }> = {
  first_lesson: { title: "First Step", detail: "Pass your first lesson.", emoji: "🌱" },
  perfect_quiz: { title: "Flawless", detail: "Score 100% on a lesson quiz.", emoji: "💎" },
  streak_3: { title: "On a Roll", detail: "Keep a 3-day streak.", emoji: "🔥" },
  streak_7: { title: "One Week Strong", detail: "Keep a 7-day streak.", emoji: "📅" },
  streak_30: { title: "Unstoppable", detail: "Keep a 30-day streak.", emoji: "🏆" },
  words_50: { title: "Word Collector", detail: "Learn 50 words.", emoji: "📚" },
  words_250: { title: "Wordsmith", detail: "Learn 250 words.", emoji: "🖋️" },
  reviews_100: { title: "Memory Builder", detail: "Complete 100 reviews.", emoji: "🧠" },
  first_dialogue: { title: "Conversationalist", detail: "Finish your first dialogue.", emoji: "💬" },
  ...Object.fromEntries(
    LEVELS.slice(1).map((l) => [`level_${l}`, { title: `Reached ${l}`, detail: `Unlock the ${l} level.`, emoji: "🎓" }]),
  ),
};

export function evaluateAchievements(
  p: ProgressState,
  extra: { levelUp?: Level | null; wordsLearned?: number } = {},
): string[] {
  const have = new Set(p.achievements);
  const passedCount = Object.values(p.lessons).filter((l) => l.passed).length;
  if (passedCount >= 1) have.add("first_lesson");
  if (Object.values(p.lessons).some((l) => l.bestQuiz === 1)) have.add("perfect_quiz");
  if (p.streak.best >= 3) have.add("streak_3");
  if (p.streak.best >= 7) have.add("streak_7");
  if (p.streak.best >= 30) have.add("streak_30");
  if ((extra.wordsLearned ?? 0) >= 50) have.add("words_50");
  if ((extra.wordsLearned ?? 0) >= 250) have.add("words_250");
  if (p.reviews >= 100) have.add("reviews_100");
  if (p.dialoguesDone >= 1) have.add("first_dialogue");
  if (extra.levelUp && extra.levelUp !== "PreA1") have.add(`level_${extra.levelUp}`);
  return [...have];
}

// ───────────────────────── Placement ─────────────────────────

/**
 * Places the learner at the first level whose section scored below 80%.
 * Every level before it counts as tested out (open for revision).
 */
export function placementResult(sections: { level: Level; ratio: number }[]): { start: Level; placedOut: Level[] } {
  const placedOut: Level[] = [];
  for (const s of sections) {
    if (passes(s.ratio)) placedOut.push(s.level);
    else return { start: s.level, placedOut };
  }
  const last = sections[sections.length - 1]?.level ?? "PreA1";
  const next = LEVELS[LEVELS.indexOf(last) + 1] ?? "C2";
  return { start: next, placedOut };
}
