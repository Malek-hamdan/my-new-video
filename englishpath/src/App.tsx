import { lazy, Suspense, useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CelebrationOverlay } from "@/components/Celebration";
import { installBackButton } from "@/native/back";
import { useApp } from "@/state/app";
import { currentScreen, isImmersive, useNav, type Screen as ScreenT, type Tab } from "@/state/nav";
import { LearnHome } from "@/screens/LearnHome";
import { UnitScreen } from "@/screens/UnitScreen";
import { initNative } from "@/native/init";

// Learn is in the main bundle; everything else loads on first visit (fast cold start).
const LessonScreen = lazy(() => import("@/screens/lesson/LessonScreen").then((m) => ({ default: m.LessonScreen })));
const PracticeScreen = lazy(() => import("@/screens/PracticeScreen").then((m) => ({ default: m.PracticeScreen })));
const Onboarding = lazy(() => import("@/screens/Onboarding").then((m) => ({ default: m.Onboarding })));
const DialoguesHome = lazy(() => import("@/screens/dialogues/DialoguesHome").then((m) => ({ default: m.DialoguesHome })));
const DialogueScreen = lazy(() => import("@/screens/dialogues/DialogueScreen").then((m) => ({ default: m.DialogueScreen })));
const ReviewHome = lazy(() => import("@/screens/ReviewScreens").then((m) => ({ default: m.ReviewHome })));
const ReviewSession = lazy(() => import("@/screens/ReviewScreens").then((m) => ({ default: m.ReviewSession })));
const ProgressScreen = lazy(() => import("@/screens/ProgressScreen").then((m) => ({ default: m.ProgressScreen })));
const AchievementsScreen = lazy(() => import("@/screens/ProgressScreen").then((m) => ({ default: m.AchievementsScreen })));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen").then((m) => ({ default: m.SettingsScreen })));
const AboutScreen = lazy(() => import("@/screens/SettingsScreen").then((m) => ({ default: m.AboutScreen })));

function TabRoot({ tab }: { tab: Tab }) {
  switch (tab) {
    case "learn":
      return <LearnHome />;
    case "dialogues":
      return <DialoguesHome />;
    case "review":
      return <ReviewHome />;
    case "progress":
      return <ProgressScreen />;
    case "settings":
      return <SettingsScreen />;
  }
}

function Route({ screen, tab }: { screen: ScreenT; tab: Tab }) {
  switch (screen.name) {
    case "root":
      return <TabRoot tab={tab} />;
    case "unit":
      return <UnitScreen unitId={screen.unitId} />;
    case "lesson":
      return <LessonScreen lessonId={screen.lessonId} />;
    case "practice":
      return <PracticeScreen />;
    case "dialogue":
      return <DialogueScreen dialogueId={screen.dialogueId} mode={screen.mode} />;
    case "reviewSession":
      return <ReviewSession />;
    case "achievements":
      return <AchievementsScreen />;
    case "about":
      return <AboutScreen />;
  }
}

const screenKey = (tab: Tab, depth: number, s: ScreenT) => `${tab}:${depth}:${JSON.stringify(s)}`;

export function App() {
  const ready = useApp((s) => s.ready);
  const onboarded = useApp((s) => s.progress.onboarded);
  const dueCount = useApp((s) => s.dueCount);
  const nav = useNav();
  const screen = currentScreen(nav);

  useEffect(() => {
    void useApp.getState().load().then(() => initNative());
    void installBackButton();
  }, []);

  if (!ready) return <div className="h-dvh bg-bg" aria-busy="true" />;
  if (!onboarded)
    return (
      <Suspense fallback={<div className="h-dvh bg-bg" />}>
        <Onboarding />
      </Suspense>
    );

  return (
    <div className="relative mx-auto h-dvh w-full overflow-hidden">
      <main key={screenKey(nav.tab, nav.stacks[nav.tab].length, screen)} className="h-dvh">
        <Suspense fallback={<div className="h-dvh bg-bg" />}>
          <Route screen={screen} tab={nav.tab} />
        </Suspense>
      </main>
      {!isImmersive(screen) ? <BottomNav badge={{ review: dueCount }} /> : null}
      <CelebrationOverlay />
    </div>
  );
}
