import { create } from "zustand";
import { BUILTIN_LESSONS, OUTLINE, type Lesson, type LessonStep, type Level, type UnitOutline } from "@/content";
import { getStore } from "@/db";
import type { Attempt } from "@/db/types";
import { addLessonToDeck } from "@/engine/srs";
import {
  ACHIEVEMENTS,
  addXp,
  completeStep,
  currentLevel,
  evaluateAchievements,
  initialProgress,
  pathAt,
  recordQuiz,
  XP,
  type ProgressState,
  type QuizOutcome,
} from "@/engine/progress";
import { generateLesson, getEndlessUnit, type LearnerContext } from "@/engine/ai/generate";
import { computeWeakPoints } from "@/engine/stats";
import { setHaptics } from "@/native/haptics";
import { setVoiceRate } from "@/native/tts";

const PROGRESS_KEY = "progress";

export interface Celebration {
  kind: "level" | "achievement";
  title: string;
  detail: string;
  emoji: string;
}

interface AppState {
  ready: boolean;
  progress: ProgressState;
  wordsLearned: number;
  dueCount: number;
  celebrations: Celebration[];
  load: () => Promise<void>;
  update: (fn: (p: ProgressState) => ProgressState) => Promise<void>;
  markStep: (lessonId: string, step: LessonStep, xp?: number) => Promise<void>;
  finishQuiz: (lesson: Lesson, ratio: number) => Promise<QuizOutcome>;
  logAttempt: (a: Omit<Attempt, "ts">) => Promise<void>;
  refreshCounts: () => Promise<void>;
  dismissCelebration: () => void;
  gainXp: (amount: number, patch?: Partial<ProgressState>) => Promise<void>;
}

async function save(p: ProgressState) {
  const store = await getStore();
  await store.setKV(PROGRESS_KEY, p);
}

function applySettingsSideEffects(p: ProgressState) {
  setVoiceRate(p.settings.voiceRate);
  setHaptics(p.settings.haptics);
  const root = document.documentElement;
  const dark =
    p.settings.theme === "dark" ||
    (p.settings.theme === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches !== false);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.motion =
    p.settings.reducedMotion === "on"
      ? "reduce"
      : p.settings.reducedMotion === "off"
        ? "full"
        : window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "reduce"
          : "full";
}

function newAchievementCelebrations(before: string[], after: string[]): Celebration[] {
  return after
    .filter((a) => !before.includes(a) && !a.startsWith("level_"))
    .map((a) => ({ kind: "achievement" as const, ...achievementInfo(a) }));
}

const achievementInfo = (id: string) => {
  const a = ACHIEVEMENTS[id] ?? { title: id, detail: "", emoji: "⭐" };
  return { title: a.title, detail: a.detail, emoji: a.emoji };
};

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  progress: initialProgress(),
  wordsLearned: 0,
  dueCount: 0,
  celebrations: [],

  load: async () => {
    const store = await getStore();
    const saved = await store.getKV<ProgressState>(PROGRESS_KEY);
    const base = initialProgress();
    const progress: ProgressState = saved
      ? { ...base, ...saved, settings: { ...base.settings, ...saved.settings, reminder: { ...base.settings.reminder, ...saved.settings?.reminder } } }
      : base;
    applySettingsSideEffects(progress);
    set({ progress, ready: true });
    await get().refreshCounts();
  },

  update: async (fn) => {
    const progress = fn(get().progress);
    applySettingsSideEffects(progress);
    set({ progress });
    await save(progress);
  },

  gainXp: async (amount, patch) => {
    const before = get().progress.achievements;
    await get().update((p) => {
      const next = addXp({ ...p, ...patch }, amount);
      return { ...next, achievements: evaluateAchievements(next, { wordsLearned: get().wordsLearned }) };
    });
    const extra = newAchievementCelebrations(before, get().progress.achievements);
    if (extra.length) set((s) => ({ celebrations: [...s.celebrations, ...extra] }));
  },

  markStep: async (lessonId, step, xp = XP.step) => {
    const already = get().progress.lessons[lessonId]?.steps.includes(step);
    await get().update((p) => completeStep(p, lessonId, step));
    if (!already && xp > 0) await get().gainXp(xp);
  },

  finishQuiz: async (lesson, ratio) => {
    const before = get().progress.achievements;
    const outcome = recordQuiz(get().progress, lesson.id, ratio);
    let state = outcome.state;
    if (outcome.firstPass) {
      const store = await getStore();
      await addLessonToDeck(store, lesson);
      const counts = await store.countCards();
      const words = (await store.allCards()).filter((c) => c.kind === "word").length;
      set({ dueCount: counts.due, wordsLearned: words });
      state = { ...state, achievements: evaluateAchievements(state, { levelUp: outcome.levelUp, wordsLearned: words }) };
    }
    applySettingsSideEffects(state);
    set({ progress: state });
    await save(state);
    const celebrations: Celebration[] = [];
    if (outcome.levelUp) {
      celebrations.push({
        kind: "level",
        title: `Welcome to ${outcome.levelUp === "PreA1" ? "Pre-A1" : outcome.levelUp}`,
        detail: "You completed every lesson of the previous level. A new chapter starts now.",
        emoji: "🎓",
      });
    }
    celebrations.push(...newAchievementCelebrations(before, state.achievements));
    if (celebrations.length) set((s) => ({ celebrations: [...s.celebrations, ...celebrations] }));
    return outcome;
  },

  logAttempt: async (a) => {
    const store = await getStore();
    await store.addAttempt({ ...a, ts: Date.now() });
  },

  refreshCounts: async () => {
    const store = await getStore();
    const counts = await store.countCards();
    const words = (await store.allCards()).filter((c) => c.kind === "word").length;
    set({ dueCount: counts.due, wordsLearned: words });
  },

  dismissCelebration: () => set((s) => ({ celebrations: s.celebrations.slice(1) })),
}));

// ───────────────────────── Content access ─────────────────────────

/** Outline for any unit, including endless ones (generated and cached). */
export async function getUnit(unitId: string, ctx: LearnerContext): Promise<UnitOutline> {
  const fixed = OUTLINE.find((u) => u.id === unitId);
  if (fixed) return fixed;
  const m = /^END-u(\d+)$/.exec(unitId);
  if (!m) throw new Error(`Unknown unit ${unitId}`);
  const store = await getStore();
  return getEndlessUnit(store, unitId, Number(m[1]), ctx);
}

/** Cached endless unit outline without generating (for the path map). */
export async function peekUnit(unitId: string): Promise<UnitOutline | null> {
  const fixed = OUTLINE.find((u) => u.id === unitId);
  if (fixed) return fixed;
  const store = await getStore();
  const c = await store.getCache("unit", unitId);
  return c ? (JSON.parse(c.json) as UnitOutline) : null;
}

/** Built-in → cached → generated. Throws NoApiKeyError when generation is needed but no key is set. */
export async function getLesson(lessonId: string, ctx: LearnerContext): Promise<Lesson> {
  const builtin = BUILTIN_LESSONS[lessonId];
  if (builtin) return builtin;
  const store = await getStore();
  const cached = await store.getCache("lesson", lessonId);
  if (cached) return JSON.parse(cached.json) as Lesson;
  const m = /^(.*)-l([123])$/.exec(lessonId);
  if (!m) throw new Error(`Bad lesson id ${lessonId}`);
  const unit = await getUnit(m[1]!, ctx);
  return generateLesson(store, unit, Number(m[2]) as 1 | 2 | 3, ctx);
}

export async function hasLessonOffline(lessonId: string): Promise<boolean> {
  if (BUILTIN_LESSONS[lessonId]) return true;
  const store = await getStore();
  return !!(await store.getCache("lesson", lessonId));
}

/** Learner context for every AI call: level, weak points and known words. */
export async function learnerContext(level?: Level): Promise<LearnerContext> {
  const { progress } = useApp.getState();
  const store = await getStore();
  const [attempts, cards] = await Promise.all([store.attemptsSince(Date.now() - 30 * 864e5), store.allCards()]);
  const weak = computeWeakPoints(attempts, cards).map((w) => w.label);
  return {
    level: level ?? currentLevel(progress),
    weakPoints: weak,
    knownWords: cards.filter((c) => c.kind === "word").map((c) => c.front),
    model: progress.settings.model,
  };
}

/** All lessons the learner has passed (for offline practice), from built-ins and cache. */
export async function passedLessons(): Promise<Lesson[]> {
  const { progress } = useApp.getState();
  const store = await getStore();
  const out: Lesson[] = [];
  for (const [id, lp] of Object.entries(progress.lessons)) {
    if (!lp.passed) continue;
    const b = BUILTIN_LESSONS[id];
    if (b) out.push(b);
    else {
      const c = await store.getCache("lesson", id);
      if (c) out.push(JSON.parse(c.json) as Lesson);
    }
  }
  return out;
}

export { pathAt };
