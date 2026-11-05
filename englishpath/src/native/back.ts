import { Capacitor } from "@capacitor/core";
import { runBackHandlers } from "@/hooks/useBack";
import { useNav } from "@/state/nav";

/**
 * Hardware back button policy:
 * 1. A screen-level handler (open dialog, lesson exit confirmation…) gets it first.
 * 2. Otherwise pop the current tab's stack.
 * 3. On another tab's root, go to Learn.
 * 4. On Learn's root, move the app to the background (never kill it mid-flow).
 */
export function handleBack(): "handled" | "popped" | "tab" | "minimize" {
  if (runBackHandlers()) return "handled";
  const nav = useNav.getState();
  if (nav.pop()) return "popped";
  if (nav.tab !== "learn") {
    nav.setTab("learn");
    return "tab";
  }
  return "minimize";
}

export async function installBackButton() {
  if (!Capacitor.isNativePlatform()) {
    // Browser/dev: Escape acts as the back button.
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") handleBack();
    });
    return;
  }
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", () => {
    if (handleBack() === "minimize") void App.minimizeApp();
  });
}
