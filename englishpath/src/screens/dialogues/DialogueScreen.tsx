import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Eye, Lightbulb, Loader2, Mic, Pause, Play, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Dialogue } from "@/content/schema";
import { MessageBubble } from "@/components/MessageBubble";
import { Button } from "@/components/ui/button";
import { NoApiKeyError } from "@/engine/ai/errors";
import { roleplayTurn } from "@/engine/ai/generate";
import type { RoleplayTurn } from "@/engine/ai/schemas";
import { offlineTurnCheck } from "@/engine/offline";
import { XP } from "@/engine/progress";
import { useBackHandler } from "@/hooks/useBack";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { tap } from "@/native/haptics";
import { getApiKey } from "@/native/secrets";
import { listenOnce, speechAvailability } from "@/native/speech";
import { speak, speakScript, stopSpeaking } from "@/native/tts";
import { learnerContext, useApp } from "@/state/app";
import { useNav } from "@/state/nav";
import { allDialogues } from "./DialoguesHome";

gsap.registerPlugin(useGSAP);

export function DialogueScreen({ dialogueId, mode }: { dialogueId: string; mode: "listen" | "roleplay" }) {
  const pop = useNav((s) => s.pop);
  const [d, setD] = useState<Dialogue | null>(null);

  useBackHandler(() => {
    void stopSpeaking();
    pop();
    return true;
  });
  useEffect(() => {
    void allDialogues().then((all) => setD(all.find((x) => x.id === dialogueId) ?? null));
    return () => void stopSpeaking();
  }, [dialogueId]);

  return (
    <div className="safe-top mx-auto flex h-dvh max-w-xl flex-col">
      <div className="flex items-center gap-3 px-4 py-2">
        <button type="button" aria-label="Close dialogue" onClick={() => { void stopSpeaking(); pop(); }} className="tap grid size-11 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <div className="min-w-0">
          <div className="eyebrow">{mode === "listen" ? "Listen & learn" : "Role-play"}</div>
          <div className="truncate font-semibold">{d?.title}</div>
        </div>
      </div>
      {d ? mode === "listen" ? <ListenMode d={d} /> : <RoleplayMode d={d} /> : null}
    </div>
  );
}

function useBubbleIn(scope: React.RefObject<HTMLDivElement | null>, count: number) {
  useGSAP(
    () => {
      const last = scope.current?.querySelector(".bubble:last-of-type");
      if (!last) return;
      scope.current?.scrollTo({ top: scope.current.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      if (prefersReducedMotion()) return;
      gsap.fromTo(last, { autoAlpha: 0, y: 12, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: "back.out(1.6)" });
    },
    { scope, dependencies: [count] },
  );
}

// ───────────────────────── Listen & learn ─────────────────────────

function ListenMode({ d }: { d: Dialogue }) {
  const gainXp = useApp((s) => s.gainXp);
  const progress = useApp((s) => s.progress);
  const pop = useNav((s) => s.pop);
  const [shown, setShown] = useState(1);
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useBubbleIn(scroller, shown);
  const finished = shown >= d.lines.length;

  const playAll = async () => {
    if (playing) {
      abort.current?.abort();
      await stopSpeaking();
      setPlaying(false);
      return;
    }
    abort.current = new AbortController();
    setPlaying(true);
    setShown(d.lines.length);
    await speakScript(
      d.lines.map((l) => ({ speaker: l.speaker, text: l.text })),
      setActive,
      abort.current.signal,
    );
    setPlaying(false);
  };

  return (
    <>
      <div ref={scroller} className="scroll-area flex-1 space-y-4 px-4 pt-2 pb-6">
        <p className="rounded-2xl bg-surface-2 p-4 text-[14px] text-fg-2">{d.setting}</p>
        {d.lines.slice(0, shown).map((l, i) => (
          <button key={i} type="button" className="block w-full text-left" onClick={() => void speak(l.text, { pitch: l.speaker === "A" ? 1 : 0.82 })}>
            <MessageBubble variant={l.speaker === "B" ? "outgoing" : "incoming"} name={d.roles[l.speaker]} active={active === i}>
              {l.text}
            </MessageBubble>
          </button>
        ))}
        {finished ? (
          <div className="card mt-6 p-5">
            <div className="eyebrow">Key phrases</div>
            <ul className="mt-3 space-y-3">
              {d.phrases.map((p) => (
                <li key={p.phrase}>
                  <button type="button" onClick={() => void speak(p.phrase)} className="text-left font-semibold text-accent">
                    {p.phrase}
                  </button>
                  <div className="text-[13px] text-muted">{p.meaning}</div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="safe-bottom border-t border-line bg-bg/95 px-4 pt-3 pb-4">
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={() => void playAll()} aria-label={playing ? "Stop" : "Play all"}>
            {playing ? <Pause /> : <Play />}
          </Button>
          {finished ? (
            <Button
              block
              size="lg"
              onClick={() => {
                void gainXp(XP.dialogue, { dialoguesDone: progress.dialoguesDone + 1 });
                pop();
              }}
            >
              Done · +{XP.dialogue} XP
            </Button>
          ) : (
            <Button
              block
              size="lg"
              onClick={() => {
                const next = d.lines[shown];
                setShown(shown + 1);
                if (next) void speak(next.text, { pitch: next.speaker === "A" ? 1 : 0.82 });
              }}
            >
              Next line
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────── Role-play ─────────────────────────

type Msg =
  | { who: "ai"; text: string }
  | { who: "learner"; text: string; verdict?: "ok" | "retry" }
  | { who: "note"; correction?: RoleplayTurn["correction"]; text: string };

function RoleplayMode({ d }: { d: Dialogue }) {
  const gainXp = useApp((s) => s.gainXp);
  const logAttempt = useApp((s) => s.logAttempt);
  const progress = useApp((s) => s.progress);
  const pop = useNav((s) => s.pop);
  const [engine, setEngine] = useState<"checking" | "ai" | "script">("checking");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [lineIdx, setLineIdx] = useState(0); // script mode: index into d.lines
  const [tries, setTries] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [done, setDone] = useState(false);
  const [mic, setMic] = useState(false);
  const [listening, setListening] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const turns = useRef({ ok: 0, total: 0 });
  useBubbleIn(scroller, msgs.length);

  // Start: the other person speaks first (from the script, no API call needed).
  useEffect(() => {
    void (async () => {
      const key = await getApiKey();
      setEngine(key ? "ai" : "script");
      setMic((await speechAvailability()) !== "unavailable");
      const first = d.lines[0]!;
      setMsgs([{ who: "ai", text: first.text }]);
      void speak(first.text);
      const firstB = d.lines.findIndex((l) => l.speaker === "B");
      setLineIdx(firstB);
      setHint(d.lines[firstB]?.text ?? null);
    })();
  }, [d]);

  const finish = () => {
    setDone(true);
    void gainXp(XP.dialogue, { dialoguesDone: progress.dialoguesDone + 1 });
    void logAttempt({ skill: "speaking", correct: turns.current.ok, total: Math.max(1, turns.current.total), tag: `dialogue:${d.topic}` });
  };

  const sendScript = (text: string) => {
    const expected = d.lines[lineIdx]!;
    const check = offlineTurnCheck(expected.text, text);
    turns.current.total++;
    const nextTries = tries + 1;
    if (check.ok || nextTries >= 2) {
      if (check.ok) turns.current.ok++;
      const add: Msg[] = [{ who: "learner", text, verdict: check.ok ? "ok" : "retry" }];
      if (!check.ok) add.push({ who: "note", text: `A natural way to say it: “${expected.text}”` });
      else if (check.similarity < 0.95) add.push({ who: "note", text: `${check.feedback} Model: “${expected.text}”` });
      // Next A line(s) and next B target.
      let i = lineIdx + 1;
      while (i < d.lines.length && d.lines[i]!.speaker === "A") {
        add.push({ who: "ai", text: d.lines[i]!.text });
        void speak(d.lines[i]!.text);
        i++;
      }
      setMsgs((m) => [...m, ...add]);
      setTries(0);
      setShowHint(false);
      if (i >= d.lines.length) {
        setHint(null);
        finish();
      } else {
        setLineIdx(i);
        setHint(d.lines[i]!.text);
      }
      void tap(check.ok ? "success" : "error");
    } else {
      setTries(nextTries);
      setMsgs((m) => [...m, { who: "learner", text, verdict: "retry" }, { who: "note", text: `${check.feedback} Tap 💡 for a hint.` }]);
      void tap("error");
    }
  };

  const sendAi = async (text: string) => {
    setBusy(true);
    const history = msgs.filter((m): m is Extract<Msg, { who: "ai" | "learner" }> => m.who !== "note").map((m) => ({ who: m.who, text: m.text }));
    setMsgs((m) => [...m, { who: "learner", text }]);
    try {
      const turn = await roleplayTurn(d, history, text, await learnerContext(d.level));
      turns.current.total++;
      if (!turn.correction.needed) turns.current.ok++;
      setMsgs((m) => [
        ...m,
        ...(turn.correction.needed ? [{ who: "note" as const, correction: turn.correction, text: turn.correction.explanation }] : []),
        { who: "ai" as const, text: turn.reply },
      ]);
      setHint(turn.suggestion || null);
      setShowHint(false);
      void speak(turn.reply);
      if (turn.finished || turns.current.total >= 12) finish();
    } catch (e) {
      // Fall back to the scripted partner without losing the conversation.
      setEngine("script");
      setMsgs((m) => [
        ...m,
        { who: "note", text: e instanceof NoApiKeyError ? "No API key — switching to script practice." : "Couldn't reach Claude — switching to script practice (works offline)." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy || done) return;
    setInput("");
    if (engine === "ai") void sendAi(t);
    else sendScript(t);
  };

  const speakIt = async () => {
    setListening(true);
    try {
      const [best] = await listenOnce();
      if (best) send(best);
    } finally {
      setListening(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 text-[12px] text-muted">
        <span>
          You are <strong className="text-fg">{d.roles.B}</strong> · partner: {d.roles.A}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1", engine === "ai" ? "bg-accent-soft text-accent" : "bg-surface-2")}>
          {engine === "ai" ? (
            <>
              <Sparkles size={12} /> AI partner
            </>
          ) : (
            "Script practice"
          )}
        </span>
      </div>
      <div ref={scroller} className="scroll-area flex-1 space-y-4 px-4 pt-2 pb-6">
        <p className="rounded-2xl bg-surface-2 p-4 text-[14px] text-fg-2">{d.setting}</p>
        {msgs.map((m, i) =>
          m.who === "note" ? (
            <div key={i} className="bubble mx-auto max-w-[90%] rounded-2xl border border-accent/30 bg-accent-soft p-3 text-[13px]">
              {m.correction?.needed ? (
                <div className="mb-1">
                  <span className="text-danger line-through">{m.correction.original}</span> → <span className="font-semibold text-success">{m.correction.corrected}</span>
                </div>
              ) : null}
              {m.text}
            </div>
          ) : (
            <MessageBubble
              key={i}
              variant={m.who === "learner" ? "outgoing" : "incoming"}
              name={m.who === "learner" ? "You" : d.roles.A}
              reaction={m.who === "learner" && m.verdict ? (m.verdict === "ok" ? "✅" : "🔁") : undefined}
            >
              {m.text}
            </MessageBubble>
          ),
        )}
        {busy ? (
          <div className="bubble flex items-center gap-2 text-[13px] text-muted">
            <Loader2 size={14} className="animate-spin" /> {d.roles.A} is typing…
          </div>
        ) : null}
        {done ? (
          <div className="card mt-4 p-5 text-center">
            <div className="text-[34px]">🎉</div>
            <div className="display mt-1 text-[24px]">Conversation complete</div>
            <p className="mt-1 text-[14px] text-muted">
              {turns.current.ok} of {turns.current.total} turns without corrections · +{XP.dialogue} XP
            </p>
            <Button className="mt-4" onClick={pop}>
              Back to dialogues
            </Button>
          </div>
        ) : null}
      </div>

      {!done ? (
        <div className="safe-bottom border-t border-line bg-bg/95 px-4 pt-3 pb-4">
          {showHint && hint ? (
            <button type="button" onClick={() => setInput(hint)} className="mb-2 w-full rounded-2xl bg-surface-2 px-4 py-2.5 text-left text-[14px] text-fg-2">
              💡 {hint}
            </button>
          ) : null}
          <div className="flex items-end gap-2">
            <button
              type="button"
              aria-label="Show a hint"
              disabled={!hint}
              onClick={() => setShowHint((s) => !s)}
              className="tap grid size-12 shrink-0 place-items-center rounded-full border border-line text-muted disabled:opacity-30"
            >
              {engine === "script" ? <Eye size={18} /> : <Lightbulb size={18} />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              aria-label="Your reply"
              placeholder={listening ? "Listening…" : "Type your reply"}
              className="focus-ring h-12 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] outline-none focus:border-accent"
            />
            {input.trim() || !mic ? (
              <button type="button" aria-label="Send" disabled={!input.trim() || busy} onClick={() => send(input)} className="tap grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-fg disabled:opacity-40">
                <Send size={18} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Speak your reply"
                disabled={busy || listening || engine === "checking"}
                onClick={() => void speakIt()}
                className={cn("tap grid size-12 shrink-0 place-items-center rounded-full text-accent-fg", listening ? "animate-pulse bg-danger text-white" : "bg-accent")}
              >
                <Mic size={18} />
              </button>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
