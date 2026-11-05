import { Keyboard, Loader2, Mic, MicOff, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { NoApiKeyError } from "@/engine/ai/errors";
import { correctWriting } from "@/engine/ai/generate";
import type { WritingFeedback } from "@/engine/ai/schemas";
import { offlineWritingCheck } from "@/engine/offline";
import { countWords, scoreSpeech, type WordResult } from "@/engine/text";
import { cn } from "@/lib/utils";
import { getStore } from "@/db";
import { tap } from "@/native/haptics";
import { listenOnce, requestSpeechPermission, speechAvailability, stopListening, type SpeechAvailability } from "@/native/speech";
import { speak } from "@/native/tts";
import { learnerContext } from "@/state/app";
import type { StepProps } from "./LearnSteps";

// ───────────────────────── 5. Speaking ─────────────────────────

export function SpeakingStep({ lesson, onDone }: StepProps) {
  const prompts = lesson.speaking.prompts;
  const [i, setI] = useState(0);
  const [avail, setAvail] = useState<SpeechAvailability | "checking">("checking");
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<{ words: WordResult[]; score: number; heard: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [typing, setTyping] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const sentence = prompts[i]!;

  useEffect(() => {
    void speechAvailability().then(setAvail);
    return () => void stopListening();
  }, []);

  const grade = (heard: string) => {
    const r = scoreSpeech(sentence, heard);
    setResult({ ...r, heard });
    void tap(r.score >= 80 ? "success" : "error");
  };

  const record = async () => {
    if (avail === "no-permission") {
      const ok = await requestSpeechPermission();
      setAvail(ok ? "ready" : "no-permission");
      if (!ok) return;
    }
    setListening(true);
    setResult(null);
    try {
      const matches = await listenOnce();
      // Pick the alternative that scores best: recognisers often rank homophones differently.
      const best = matches.map((m) => ({ m, s: scoreSpeech(sentence, m).score })).sort((a, b) => b.s - a.s)[0];
      grade(best?.m ?? "");
    } catch {
      grade("");
    } finally {
      setListening(false);
    }
  };

  const next = () => {
    const all = [...scores, result?.score ?? 0];
    setScores(all);
    setResult(null);
    setTyped("");
    if (i === prompts.length - 1) {
      const avg = all.reduce((a, b) => a + b, 0) / all.length;
      onDone({ correct: Math.round(avg), total: 100, tag: `speaking:${lesson.id}` });
    } else setI(i + 1);
  };

  const noMic = avail === "unavailable";

  return (
    <div className="flex min-h-full flex-col">
      <div className="eyebrow tabular-nums">
        Speaking · {i + 1} of {prompts.length}
      </div>
      <p className="mt-2 text-[14px] text-muted">Listen, then say the sentence. You get a score for every word.</p>
      <div className="card mt-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="display text-[28px] leading-tight">
            {result
              ? result.words.map((w, k) => (
                  <span
                    key={k}
                    className={cn("mr-2 inline-block", w.status === "correct" ? "text-success" : w.status === "close" ? "text-accent" : "text-danger underline decoration-2 underline-offset-4")}
                    title={w.heard ? `Heard: ${w.heard}` : "Not heard"}
                  >
                    {w.word}
                  </span>
                ))
              : sentence}
          </div>
          <button type="button" aria-label="Listen to the model" onClick={() => void speak(sentence)} className="tap grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-2">
            <Volume2 size={18} />
          </button>
        </div>
        {result ? (
          <div className="mt-5 flex items-center justify-between rounded-2xl bg-surface-2 p-4">
            <div>
              <div className="text-[13px] text-muted">Accuracy</div>
              <div className={cn("text-[30px] font-semibold tabular-nums", result.score >= 80 ? "text-success" : result.score >= 50 ? "text-accent" : "text-danger")}>{result.score}%</div>
            </div>
            <div className="max-w-[60%] text-right text-[13px] text-muted">
              {result.heard ? <>We heard: “{result.heard}”</> : "We didn't catch that. Try again closer to the mic."}
              <div className="mt-1 flex justify-end gap-3 text-[11px]">
                <span className="text-success">● correct</span>
                <span className="text-accent">● close</span>
                <span className="text-danger">● missed</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {noMic || typing ? (
        <div className="mt-5">
          {noMic ? (
            <p className="text-[13px] text-muted">
              Speech recognition isn't available on this device (Android needs the Google speech service). Say the sentence aloud, then type what you said to check it word by word.
            </p>
          ) : null}
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Type what you said"
            placeholder="Type what you said"
            className="focus-ring mt-3 h-12 w-full rounded-2xl border border-line bg-surface px-4 outline-none focus:border-accent"
          />
        </div>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        {!noMic && !typing ? (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => (listening ? void stopListening() : void record())}
              aria-label={listening ? "Stop listening" : "Start speaking"}
              className={cn("tap focus-ring grid size-20 place-items-center rounded-full text-accent-fg", listening ? "animate-pulse bg-danger text-white" : "bg-accent")}
            >
              {listening ? <MicOff size={30} /> : <Mic size={30} />}
            </button>
            <button type="button" aria-label="Type instead" onClick={() => setTyping(true)} className="tap grid size-12 place-items-center rounded-full border border-line text-muted">
              <Keyboard size={18} />
            </button>
          </div>
        ) : (
          <Button block variant="secondary" disabled={!typed.trim()} onClick={() => grade(typed)}>
            Check what I said
          </Button>
        )}
        {avail === "no-permission" && !typing ? <p className="text-center text-[12px] text-muted">Tap the mic to allow microphone access.</p> : null}
        <div className="flex gap-3">
          {result ? (
            <Button variant="secondary" size="lg" onClick={() => setResult(null)} aria-label="Try again">
              <RotateCcw />
            </Button>
          ) : null}
          <Button block size="lg" disabled={!result} onClick={next}>
            {i === prompts.length - 1 ? "Finish speaking" : "Next sentence"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 6. Writing ─────────────────────────

export function WritingStep({ lesson, onDone }: StepProps) {
  const w = lesson.writing;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState<(WritingFeedback & { mode: "ai" | "offline"; note?: string }) | null>(null);
  const [showModel, setShowModel] = useState(false);
  const n = countWords(text);

  const check = async () => {
    setBusy(true);
    try {
      const store = await getStore();
      const ctx = await learnerContext();
      const ai = await correctWriting(store, w, text, ctx);
      setFb({ ...ai, mode: "ai" });
    } catch (e) {
      setFb({
        ...offlineWritingCheck(text, w),
        mode: "offline",
        note:
          e instanceof NoApiKeyError
            ? "Offline check. Add your Claude API key in Settings for full AI correction with explanations."
            : "Couldn't reach Claude, so this is the offline check. Try again when you're online for full AI correction.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (fb) {
    return (
      <div className="flex min-h-full flex-col">
        <div className="eyebrow">{fb.mode === "ai" ? "AI correction" : "Offline check"}</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className={cn("display text-[52px] tabular-nums", fb.score >= 80 ? "text-success" : fb.score >= 50 ? "text-accent" : "text-danger")}>{fb.score}</div>
          <div className="text-[14px] text-muted">/ 100</div>
        </div>
        {fb.note ? <p className="mt-1 text-[13px] text-muted">{fb.note}</p> : null}
        <h3 className="eyebrow mt-6">Corrected text</h3>
        <p className="card mt-2 p-4 text-[16px] leading-relaxed select-text">{fb.corrected}</p>
        {fb.issues.length ? (
          <>
            <h3 className="eyebrow mt-6">What to fix</h3>
            <ul className="mt-2 space-y-2">
              {fb.issues.map((x, k) => (
                <li key={k} className="card p-4">
                  <div className="text-[14px]">
                    <span className="text-danger line-through">{x.original}</span> → <span className="font-semibold text-success">{x.correction}</span>
                    <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{x.type}</span>
                  </div>
                  <div className="mt-1 text-[13px] text-fg-2">{x.explanation}</div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="card mt-4 space-y-2 p-4 text-[14px]">
          <div>
            <span className="font-semibold text-success">Strengths: </span>
            {fb.strengths}
          </div>
          <div>
            <span className="font-semibold text-accent">Next time: </span>
            {fb.nextTip}
          </div>
        </div>
        <Button variant="ghost" className="mt-3 self-start" onClick={() => setShowModel((s) => !s)}>
          {showModel ? "Hide" : "Show"} model answer
        </Button>
        {showModel ? <p className="mt-1 rounded-2xl bg-surface-2 p-4 text-[15px] italic">{w.model}</p> : null}
        <div className="mt-auto flex gap-3 pt-8">
          <Button variant="secondary" size="lg" onClick={() => setFb(null)}>
            Edit
          </Button>
          <Button block size="lg" onClick={() => onDone({ correct: fb.score, total: 100, tag: `writing:${lesson.id}` })}>
            Continue to quiz
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="eyebrow">Writing</div>
      <h2 className="mt-2 text-[19px] leading-snug font-semibold">{w.prompt}</h2>
      {w.targetWords.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {w.targetWords.map((t) => (
            <span key={t} className={cn("rounded-full border px-3 py-1 text-[12px]", text.toLowerCase().includes(t.toLowerCase().replace(/^-/, "")) ? "border-success/50 text-success" : "border-line text-muted")}>
              {t}
            </span>
          ))}
        </div>
      ) : null}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Your text"
        placeholder="Start writing here…"
        rows={8}
        className="focus-ring mt-4 w-full flex-1 resize-none rounded-2xl border border-line bg-surface p-4 text-[16px] leading-relaxed outline-none focus:border-accent"
      />
      <div className={cn("mt-2 text-right text-[12px] tabular-nums", n >= w.minWords ? "text-success" : "text-muted")}>
        {n} / {w.minWords} words
      </div>
      <div className="mt-auto pt-6">
        <Button block size="lg" disabled={n < Math.min(3, w.minWords) || busy} onClick={() => void check()}>
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Checking…" : "Check my writing"}
        </Button>
      </div>
    </div>
  );
}
