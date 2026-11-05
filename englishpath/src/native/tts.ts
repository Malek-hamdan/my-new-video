import { Capacitor } from "@capacitor/core";

/**
 * Text-to-speech: native Android TTS via @capacitor-community/text-to-speech,
 * Web Speech API in the browser. Returns when the utterance finishes.
 */
let rate = 0.9;
export const setVoiceRate = (r: number) => {
  rate = Math.min(1.5, Math.max(0.5, r));
};

export async function speak(text: string, opts: { pitch?: number; rate?: number } = {}): Promise<void> {
  const r = opts.rate ?? rate;
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop().catch(() => undefined);
    await TextToSpeech.speak({ text, lang: "en-US", rate: r, pitch: opts.pitch ?? 1, volume: 1, category: "playback" });
    return;
  }
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = r;
    u.pitch = opts.pitch ?? 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    // Some engines never fire onend; never block the UI forever.
    setTimeout(resolve, Math.min(20000, 1200 + text.length * 90));
  });
}

export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { TextToSpeech } = await import("@capacitor-community/text-to-speech");
    await TextToSpeech.stop().catch(() => undefined);
  } else if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Reads a multi-speaker script with a different pitch per speaker. */
export async function speakScript(lines: { speaker?: string; text: string }[], onLine?: (i: number) => void, signal?: AbortSignal) {
  const speakers = [...new Set(lines.map((l) => l.speaker ?? ""))];
  for (let i = 0; i < lines.length; i++) {
    if (signal?.aborted) return;
    onLine?.(i);
    const s = speakers.indexOf(lines[i]!.speaker ?? "");
    await speak(lines[i]!.text, { pitch: s % 2 === 0 ? 1 : 0.82 });
  }
  onLine?.(-1);
}
