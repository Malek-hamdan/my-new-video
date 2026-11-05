import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.englishpath.learn",
  appName: "EnglishPath",
  webDir: "dist",
  backgroundColor: "#070b18",
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    // Android 15+ draws edge-to-edge: Capacitor injects --safe-area-inset-* CSS variables.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: "#021b51",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_englishpath",
      iconColor: "#FDB61C",
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
