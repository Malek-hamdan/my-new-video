import { Capacitor } from "@capacitor/core";

/**
 * Speech recognition for the Speaking step and role-play.
 * Android: @capacitor-community/speech-recognition (Google on-device/online recogniser,
 * needs RECORD_AUDIO). Browser: Web Speech API where available.
 * If neither exists, callers fall back to typing.
 */
export type SpeechAvailability = "ready" | "no-permission" | "unavailable";

interface WebRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

const WebCtor = (): (new () => WebRecognition) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => WebRecognition) | null;
};

export async function speechAvailability(): Promise<SpeechAvailability> {
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
    if (!available) return "unavailable";
    const perm = await SpeechRecognition.checkPermissions();
    return perm.speechRecognition === "granted" ? "ready" : "no-permission";
  }
  return WebCtor() ? "ready" : "unavailable";
}

export async function requestSpeechPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return !!WebCtor();
  const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
  const perm = await SpeechRecognition.requestPermissions();
  return perm.speechRecognition === "granted";
}

let activeWeb: WebRecognition | null = null;

/** Listens once and resolves with the best transcripts (may be empty). */
export async function listenOnce(): Promise<string[]> {
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    const res = await SpeechRecognition.start({
      language: "en-US",
      maxResults: 3,
      partialResults: false,
      popup: false,
      prompt: "Speak now",
    });
    return res.matches ?? [];
  }
  const Ctor = WebCtor();
  if (!Ctor) return [];
  return new Promise((resolve) => {
    const rec = new Ctor();
    activeWeb = rec;
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    let done = false;
    const finish = (v: string[]) => {
      if (done) return;
      done = true;
      activeWeb = null;
      resolve(v);
    };
    rec.onresult = (e) => {
      const first = e.results[0];
      finish(first ? Array.from(first).map((a) => a.transcript) : []);
    };
    rec.onerror = () => finish([]);
    rec.onend = () => finish([]);
    rec.start();
  });
}

export async function stopListening() {
  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
    await SpeechRecognition.stop().catch(() => undefined);
  } else {
    activeWeb?.stop();
  }
}
