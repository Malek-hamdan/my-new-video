import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Check, Loader2, Lock, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LESSON_STEPS, type Lesson, type LessonStep } from "@/content/schema";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { GenerationError, NoApiKeyError } from "@/engine/ai/errors";
import { canOpenStep, indexOfLesson, isUnlocked, pathAt, XP } from "@/engine/progress";
import { useBackHandler } from "@/hooks/useBack";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { stopSpeaking } from "@/native/tts";
import { getLesson, hasLessonOffline, learnerContext, useApp } from "@/state/app";
import { useNav } from "@/state/nav";
import { GrammarStep, ListeningStep, ReadingStep, VocabularyStep } from "./LearnSteps";
import { SpeakingStep, WritingStep } from "./ProduceSteps";
import { QuizStep } from "./QuizStep";

gsap.registerPlugin(useGSAP);

const LABEL: Record<LessonStep, string> = {
  vocabulary: "Words",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
  quiz: "Quiz",
};

type Load = { state: "loading" | "generating" } | { state: "ready"; lesson: Lesson } | { state: "needs-key" } | { state: "error"; message: string };

export function LessonScreen({ lessonId }: { lessonId: string }) {
  const progress = useApp((s) => s.progress);
  const markStep = useApp((s) => s.markStep);
  const logAttempt = useApp((s) => s.logAttempt);
  const { pop, push, setTab } = useNav();
  const index = indexOfLesson(lessonId);
  const unlocked = index >= 0 && isUnlocked(progress, index);
  const lp = progress.lessons[lessonId];
  const done = lp?.steps ?? [];
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [step, setStep] = useState<LessonStep>(() => LESSON_STEPS.find((s) => !done.includes(s)) ?? "quiz");
  const [exitOpen, setExitOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  const fetchLesson = useCallback(
    async (allowGenerate: boolean) => {
      setLoad({ state: "loading" });
      try {
        const ctx = await learnerContext(pathAt(index).level);
        if (!allowGenerate) {
          // Built-in or cached only; otherwise ask before spending API tokens.
          if (!(await hasLessonOffline(lessonId))) {
            setLoad({ state: "needs-key" });
            return;
          }
        } else setLoad({ state: "generating" });
        setLoad({ state: "ready", lesson: await getLesson(lessonId, ctx) });
      } catch (e) {
        if (e instanceof NoApiKeyError) setLoad({ state: "needs-key" });
        else setLoad({ state: "error", message: e instanceof GenerationError ? e.message : (e as Error).message });
      }
    },
    [index, lessonId],
  );

  useEffect(() => {
    if (unlocked) void fetchLesson(false);
  }, [fetchLesson, unlocked]);

  useEffect(() => () => void stopSpeaking(), []);

  // Hardware back inside a lesson never exits: it asks first.
  useBackHandler(() => {
    setExitOpen((o) => !o);
    return true;
  });

  useGSAP(
    () => {
      if (prefersReducedMotion() || !body.current) return;
      gsap.fromTo(body.current, { autoAlpha: 0, x: 24 }, { autoAlpha: 1, x: 0, duration: 0.38, ease: "power3.out", clearProps: "transform" });
      body.current.scrollTo({ top: 0 });
    },
    { dependencies: [step, load.state] },
  );

  const complete = async (s: LessonStep, result?: { correct: number; total: number; tag?: string }) => {
    if (result) await logAttempt({ skill: s, correct: result.correct, total: result.total, ...(result.tag ? { tag: result.tag } : {}) });
    await markStep(lessonId, s, s === "writing" ? XP.writing : XP.step);
    const nextStep = LESSON_STEPS[LESSON_STEPS.indexOf(s) + 1];
    if (nextStep) setStep(nextStep);
  };

  const goNextLesson = () => {
    const next = pathAt(index + 1);
    pop();
    push({ name: "lesson", lessonId: next.lessonId });
  };

  if (!unlocked) {
    return (
      <Shell onClose={pop} title="Locked">
        <div className="flex flex-col items-center pt-16 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-surface-2 text-muted">
            <Lock size={32} />
          </div>
          <h2 className="display mt-6 text-[28px]">This lesson is locked</h2>
          <p className="mt-2 max-w-xs text-[15px] text-muted">Pass the previous lesson's quiz with 80% or more to open it. Every lesson builds on the one before.</p>
          <Button className="mt-8" onClick={pop}>
            Back to my path
          </Button>
        </div>
      </Shell>
    );
  }

  const lesson = load.state === "ready" ? load.lesson : null;

  return (
    <div className="safe-top flex h-dvh flex-col">
      {/* Header */}
      <div className="mx-auto w-full max-w-xl px-4">
        <div className="flex items-center gap-3 py-2">
          <button type="button" aria-label="Leave lesson" onClick={() => setExitOpen(true)} className="tap focus-ring grid size-11 place-items-center rounded-full text-muted">
            <X size={22} />
          </button>
          <div className="flex flex-1 gap-1" role="tablist" aria-label="Lesson steps">
            {LESSON_STEPS.map((s) => {
              const isDone = done.includes(s);
              const open = canOpenStep(done, s);
              return (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={s === step}
                  aria-label={`${LABEL[s]}${isDone ? " (done)" : open ? "" : " (locked)"}`}
                  disabled={!open || !lesson}
                  onClick={() => setStep(s)}
                  className="group flex-1 py-3"
                >
                  <span className={cn("block h-1.5 rounded-full transition-colors", s === step ? "bg-accent" : isDone ? "bg-success" : "bg-surface-2")} />
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-between pb-2">
          <div className="min-w-0">
            <div className="eyebrow truncate">{lesson?.title ?? "Lesson"}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-2">
            {done.includes(step) ? <Check size={14} className="text-success" /> : null}
            {LABEL[step]}
          </div>
        </div>
      </div>

      {/* Body: native scroll */}
      <div className="scroll-area flex-1">
        <div ref={body} className="mx-auto flex min-h-full w-full max-w-xl flex-col px-4 pt-2 [&>div]:flex-1 pb-[max(var(--safe-area-inset-bottom,env(safe-area-inset-bottom)),20px)]">
          {load.state === "loading" ? <Loading text="Opening lesson…" /> : null}
          {load.state === "generating" ? <Loading text="Writing a new lesson for your level…" sub="This takes about a minute the first time. It's saved for offline use afterwards." /> : null}
          {load.state === "needs-key" ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Sparkles size={36} className="text-accent" />
              <h2 className="display mt-4 text-[26px]">Generate this lesson</h2>
              <p className="mt-2 max-w-sm text-[14px] text-muted">
                The first 18 lessons are built in. From here, every lesson is written by Claude for your level and weak points, then saved on your phone. It needs your API key and an internet connection once.
              </p>
              <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
                <Button size="lg" onClick={() => void fetchLesson(true)}>
                  <Sparkles /> Generate lesson
                </Button>
                <Button size="lg" variant="secondary" onClick={() => setTab("settings")}>
                  Add API key in Settings
                </Button>
                <Button size="lg" variant="ghost" onClick={() => { pop(); push({ name: "practice" }); }}>
                  Practise offline instead
                </Button>
              </div>
            </div>
          ) : null}
          {load.state === "error" ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="display text-[24px]">Couldn't open this lesson</h2>
              <p className="mt-2 max-w-sm text-[14px] text-muted">{load.message}</p>
              <Button className="mt-6" onClick={() => void fetchLesson(true)}>
                Try again
              </Button>
            </div>
          ) : null}
          {lesson ? (
            <>
              {step === "vocabulary" ? <VocabularyStep lesson={lesson} onDone={() => void complete("vocabulary")} /> : null}
              {step === "grammar" ? <GrammarStep lesson={lesson} onDone={(r) => void complete("grammar", r)} /> : null}
              {step === "reading" ? <ReadingStep lesson={lesson} onDone={(r) => void complete("reading", r)} /> : null}
              {step === "listening" ? <ListeningStep lesson={lesson} onDone={(r) => void complete("listening", r)} /> : null}
              {step === "speaking" ? <SpeakingStep lesson={lesson} onDone={(r) => void complete("speaking", r)} /> : null}
              {step === "writing" ? <WritingStep lesson={lesson} onDone={(r) => void complete("writing", r)} /> : null}
              {step === "quiz" ? (
                canOpenStep(done, "quiz") ? (
                  <QuizStep lesson={lesson} attemptsSoFar={lp?.attempts ?? 0} onNext={goNextLesson} onReview={() => setStep("vocabulary")} />
                ) : (
                  <p className="pt-10 text-center text-muted">Finish the six learning steps to unlock the quiz.</p>
                )
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <Sheet open={exitOpen} onOpenChange={setExitOpen} title="Leave this lesson?" description="Steps you've finished are saved. The quiz must be passed (80%+) to unlock the next lesson.">
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setExitOpen(false)}>
            Keep learning
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              setExitOpen(false);
              void stopSpeaking();
              pop();
            }}
          >
            Leave lesson
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function Shell({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  useBackHandler(() => {
    onClose();
    return true;
  });
  return (
    <div className="safe-top mx-auto h-dvh max-w-xl px-4">
      <div className="flex items-center gap-3 py-2">
        <button type="button" aria-label="Close" onClick={onClose} className="tap grid size-11 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <span className="eyebrow">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Loading({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Loader2 size={32} className="animate-spin text-accent" />
      <div className="mt-4 font-medium">{text}</div>
      {sub ? <p className="mt-1 max-w-xs text-[13px] text-muted">{sub}</p> : null}
    </div>
  );
}
