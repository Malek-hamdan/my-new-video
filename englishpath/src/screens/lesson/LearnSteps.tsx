import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight, Eye, Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Lesson, Question } from "@/content/schema";
import { QuestionCard } from "@/components/QuestionCard";
import { Rich } from "@/components/Rich";
import { Button } from "@/components/ui/button";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { speak, speakScript, stopSpeaking } from "@/native/tts";

gsap.registerPlugin(useGSAP);

export interface StepProps {
  lesson: Lesson;
  onDone: (result?: { correct: number; total: number; tag?: string }) => void;
}

function SpeakButton({ text, label = "Listen", className }: { text: string; label?: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${text}`}
      onClick={() => void speak(text)}
      className={cn("tap focus-ring grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-fg-2", className)}
    >
      <Volume2 size={18} />
    </button>
  );
}

// ───────────────────────── 1. Vocabulary ─────────────────────────

export function VocabularyStep({ lesson, onDone }: StepProps) {
  const [i, setI] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0]));
  const card = useRef<HTMLDivElement>(null);
  const w = lesson.vocab[i]!;
  const last = i === lesson.vocab.length - 1;

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(".vocab-card", { autoAlpha: 0, y: 14, scale: 0.98 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "power3.out" });
      gsap.fromTo(".vocab-emoji", { scale: 0.6, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.6, ease: "back.out(2)" });
    },
    { scope: card, dependencies: [i] },
  );

  useEffect(() => {
    void speak(w.word);
  }, [w.word]);

  const go = (d: number) => {
    const n = Math.max(0, Math.min(lesson.vocab.length - 1, i + d));
    setI(n);
    setSeen((s) => new Set(s).add(n));
  };

  return (
    <div ref={card} className="flex min-h-full flex-col">
      <div className="eyebrow tabular-nums">
        Word {i + 1} of {lesson.vocab.length}
      </div>
      <div className="vocab-card card mt-3 p-6">
        <div className="vocab-emoji text-[72px] leading-none" role="img" aria-label={`Picture for ${w.word}`}>
          {w.emoji}
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="display text-[38px] break-words">{w.word}</div>
            <div className="mt-1 text-[15px] text-muted">
              {w.ipa ? <span className="font-mono">{w.ipa}</span> : null} <span className="ml-1 italic">{w.pos}</span>
            </div>
          </div>
          <SpeakButton text={w.word} className="size-12 bg-accent text-accent-fg" />
        </div>
        <p className="mt-5 text-[16px] text-fg-2">{w.meaning}</p>
        <button type="button" onClick={() => void speak(w.example)} className="tap mt-4 flex w-full items-start gap-3 rounded-2xl bg-surface-2 p-4 text-left">
          <Volume2 size={16} className="mt-1 shrink-0 text-accent" />
          <span className="text-[15px] italic">“{w.example}”</span>
        </button>
      </div>
      <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
        {lesson.vocab.map((_, k) => (
          <span key={k} className={cn("h-1.5 rounded-full transition-all", k === i ? "w-6 bg-accent" : seen.has(k) ? "w-1.5 bg-fg/40" : "w-1.5 bg-line-strong")} />
        ))}
      </div>
      <div className="mt-auto flex gap-3 pt-6">
        <Button variant="secondary" size="lg" className="w-14 px-0" aria-label="Previous word" disabled={i === 0} onClick={() => go(-1)}>
          <ChevronLeft />
        </Button>
        {last ? (
          <Button size="lg" block disabled={seen.size < lesson.vocab.length} onClick={() => onDone()}>
            I know these words
          </Button>
        ) : (
          <Button size="lg" block onClick={() => go(1)}>
            Next word <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── Question runner (shared) ─────────────────────────

export function QuestionRun({
  questions,
  onFinish,
  onEach,
  tag,
}: {
  questions: Question[];
  onFinish: (correct: number, total: number) => void;
  onEach?: (q: Question, correct: boolean) => void;
  tag?: string;
}) {
  const [k, setK] = useState(0);
  const correct = useRef(0);
  const q = questions[k];
  if (!q) return null;
  return (
    <QuestionCard
      key={`${tag ?? ""}${q.id}`}
      q={q}
      index={k}
      total={questions.length}
      continueLabel={k === questions.length - 1 ? "Finish" : "Continue"}
      onAnswered={(ok) => {
        if (ok) correct.current++;
        onEach?.(q, ok);
        if (k === questions.length - 1) onFinish(correct.current, questions.length);
        else setK(k + 1);
      }}
    />
  );
}

// ───────────────────────── 2. Grammar ─────────────────────────

export function GrammarStep({ lesson, onDone }: StepProps) {
  const g = lesson.grammar;
  const [practising, setPractising] = useState(false);
  if (practising) {
    return (
      <QuestionRun
        tag="g"
        questions={g.practice}
        onFinish={(c, t) => onDone({ correct: c, total: t, tag: `grammar:${g.id}` })}
      />
    );
  }
  return (
    <div className="flex min-h-full flex-col">
      <div className="eyebrow">Grammar</div>
      <h2 className="display mt-2 text-[30px]">{g.title}</h2>
      <div className="mt-4 space-y-3 text-[16px] text-fg-2">
        {g.explanation.map((p, i) => (
          <p key={i}>
            <Rich text={p} />
          </p>
        ))}
      </div>
      <h3 className="eyebrow mt-7">Examples</h3>
      <ul className="mt-3 space-y-2">
        {g.examples.map((e, i) => (
          <li key={i} className="card flex items-center gap-3 p-3.5">
            <SpeakButton text={e.en} className="size-9" />
            <div>
              <div className="text-[15px]">{e.en}</div>
              {e.note ? <div className="text-[12px] text-muted">{e.note}</div> : null}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="eyebrow mt-7">Common mistakes</h3>
      <ul className="mt-3 space-y-2">
        {g.mistakes.map((m, i) => (
          <li key={i} className="card p-4">
            <div className="text-[15px] text-danger line-through decoration-danger/60">✗ {m.wrong}</div>
            <div className="mt-1 text-[15px] font-medium text-success">✓ {m.right}</div>
            <div className="mt-1.5 text-[13px] text-muted">{m.why}</div>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-8">
        <Button block size="lg" onClick={() => setPractising(true)}>
          Practise ({g.practice.length} questions)
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── 3. Reading ─────────────────────────

export function ReadingStep({ lesson, onDone }: StepProps) {
  const r = lesson.reading;
  const [answering, setAnswering] = useState(false);
  if (answering) {
    return <QuestionRun tag="r" questions={r.questions} onFinish={(c, t) => onDone({ correct: c, total: t, tag: `reading:${lesson.id}` })} />;
  }
  return (
    <div className="flex min-h-full flex-col">
      <div className="eyebrow">Reading</div>
      <div className="mt-2 flex items-start justify-between gap-3">
        <h2 className="display text-[28px]">{r.title}</h2>
        <SpeakButton text={r.text.replace(/\n/g, " ")} label="Read aloud" />
      </div>
      <article className="card mt-4 p-5 text-[17px] leading-[1.75] whitespace-pre-line select-text">{r.text}</article>
      <div className="mt-auto pt-8">
        <Button block size="lg" onClick={() => setAnswering(true)}>
          Answer {r.questions.length} questions
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── 4. Listening ─────────────────────────

export function ListeningStep({ lesson, onDone }: StepProps) {
  const l = lesson.listening;
  const [playing, setPlaying] = useState(false);
  const [line, setLine] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [showText, setShowText] = useState(false);
  const [answering, setAnswering] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abort.current?.abort();
    void stopSpeaking();
  }, []);

  const play = async () => {
    if (playing) {
      abort.current?.abort();
      await stopSpeaking();
      setPlaying(false);
      setLine(-1);
      return;
    }
    abort.current = new AbortController();
    setPlaying(true);
    await speakScript(l.script, setLine, abort.current.signal);
    setPlaying(false);
    setPlays((p) => p + 1);
  };

  if (answering) {
    return <QuestionRun tag="l" questions={l.questions} onFinish={(c, t) => onDone({ correct: c, total: t, tag: `listening:${lesson.id}` })} />;
  }
  return (
    <div className="flex min-h-full flex-col">
      <div className="eyebrow">Listening</div>
      <h2 className="display mt-2 text-[28px]">{l.title}</h2>
      <p className="mt-2 text-[14px] text-muted">Listen first without reading. You can play it as many times as you like.</p>
      <div className="mt-8 grid place-items-center">
        <button
          type="button"
          onClick={() => void play()}
          aria-label={playing ? "Stop" : "Play recording"}
          className={cn("tap focus-ring grid size-28 place-items-center rounded-full bg-accent text-accent-fg shadow-[0_20px_50px_-20px_var(--accent)]", playing && "animate-pulse")}
        >
          {playing ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-1" />}
        </button>
        <div className="mt-3 text-[13px] text-muted tabular-nums">{plays === 0 ? "Tap to play" : `Played ${plays}×`}</div>
      </div>
      {showText ? (
        <ul className="mt-8 space-y-2">
          {l.script.map((s, i) => (
            <li key={i} className={cn("card p-3.5 text-[15px] transition-colors", line === i && "border-accent bg-accent-soft")}>
              {s.speaker ? <span className="mr-2 font-semibold text-muted">{s.speaker}:</span> : null}
              {s.text}
            </li>
          ))}
        </ul>
      ) : plays > 0 ? (
        <Button variant="ghost" className="mx-auto mt-6" onClick={() => setShowText(true)}>
          <Eye /> Show transcript
        </Button>
      ) : null}
      <div className="mt-auto pt-8">
        <Button block size="lg" disabled={plays === 0} onClick={() => setAnswering(true)}>
          Answer {l.questions.length} questions
        </Button>
      </div>
    </div>
  );
}
