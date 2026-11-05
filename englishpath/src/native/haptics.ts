import { Capacitor } from "@capacitor/core";

let enabled = true;
export const setHaptics = (on: boolean) => {
  enabled = on;
};

export async function tap(kind: "light" | "success" | "error" = "light") {
  if (!enabled || !Capacitor.isNativePlatform()) return;
  const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
  if (kind === "light") await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  else await Haptics.notification({ type: kind === "success" ? NotificationType.Success : NotificationType.Error }).catch(() => undefined);
}
