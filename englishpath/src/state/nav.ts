import { create } from "zustand";

export type Tab = "learn" | "dialogues" | "review" | "progress" | "settings";
export const TABS: Tab[] = ["learn", "dialogues", "review", "progress", "settings"];

export type Screen =
  | { name: "root" }
  | { name: "unit"; unitId: string }
  | { name: "lesson"; lessonId: string }
  | { name: "practice" }
  | { name: "dialogue"; dialogueId: string; mode: "listen" | "roleplay" }
  | { name: "reviewSession" }
  | { name: "achievements" }
  | { name: "about" };

interface NavState {
  tab: Tab;
  stacks: Record<Tab, Screen[]>;
  /** Monotonic key so transitions know a push vs pop happened. */
  seq: number;
  direction: 1 | -1;
  setTab: (t: Tab) => void;
  push: (s: Screen) => void;
  pop: () => boolean;
  reset: (t?: Tab) => void;
}

const root = (): Screen[] => [{ name: "root" }];

export const useNav = create<NavState>((set, get) => ({
  tab: "learn",
  stacks: { learn: root(), dialogues: root(), review: root(), progress: root(), settings: root() },
  seq: 0,
  direction: 1,
  setTab: (tab) => set((s) => ({ tab, seq: s.seq + 1, direction: 1 })),
  push: (screen) =>
    set((s) => ({ stacks: { ...s.stacks, [s.tab]: [...s.stacks[s.tab], screen] }, seq: s.seq + 1, direction: 1 })),
  pop: () => {
    const { tab, stacks } = get();
    if (stacks[tab].length <= 1) return false;
    set((s) => ({ stacks: { ...s.stacks, [tab]: s.stacks[tab].slice(0, -1) }, seq: s.seq + 1, direction: -1 }));
    return true;
  },
  reset: (t) => set((s) => ({ stacks: { ...s.stacks, [t ?? s.tab]: root() }, seq: s.seq + 1, direction: -1 })),
}));

export const currentScreen = (s: NavState) => s.stacks[s.tab][s.stacks[s.tab].length - 1]!;

/** Full-screen flows hide the bottom tab bar. */
export const isImmersive = (screen: Screen) =>
  screen.name === "lesson" || screen.name === "dialogue" || screen.name === "reviewSession" || screen.name === "practice";
