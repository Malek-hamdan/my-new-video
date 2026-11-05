import { Capacitor } from "@capacitor/core";

const DAILY_ID = 1001;

/** Schedules (or cancels) the daily study reminder. Android 13+ asks for POST_NOTIFICATIONS. */
export async function scheduleDailyReminder(enabled: boolean, hour: number, minute: number): Promise<"scheduled" | "cancelled" | "denied" | "unsupported"> {
  if (!Capacitor.isNativePlatform()) return "unsupported";
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] }).catch(() => undefined);
  if (!enabled) return "cancelled";
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return "denied";
  await LocalNotifications.createChannel({
    id: "daily",
    name: "Daily reminder",
    description: "A daily nudge to keep your streak.",
    importance: 4,
  }).catch(() => undefined);
  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_ID,
        channelId: "daily",
        title: "Time for English ✨",
        body: "A few minutes today keeps your streak alive. Your next lesson is ready.",
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  });
  return "scheduled";
}
