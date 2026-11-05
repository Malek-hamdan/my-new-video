import { Capacitor } from "@capacitor/core";
import { useApp } from "@/state/app";
import { scheduleDailyReminder } from "./notifications";

/** Native-only setup after the progress state is loaded. */
export async function initNative() {
  if (!Capacitor.isNativePlatform()) return;
  const { StatusBar, Style } = await import("@capacitor/status-bar");
  const apply = async () => {
    const dark = document.documentElement.dataset.theme !== "light";
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
    await StatusBar.setBackgroundColor({ color: dark ? "#070b18" : "#f6f3ec" }).catch(() => undefined);
  };
  await apply();
  useApp.subscribe((s, prev) => {
    if (s.progress.settings.theme !== prev.progress.settings.theme) void apply();
  });
  const { reminder } = useApp.getState().progress.settings;
  if (reminder.enabled) await scheduleDailyReminder(true, reminder.hour, reminder.minute).catch(() => undefined);
  const { SplashScreen } = await import("@capacitor/splash-screen");
  await SplashScreen.hide().catch(() => undefined);
}
