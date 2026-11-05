import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, RotateCcw, Trophy, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Lesson } from "@/content/schema";
import { QuestionCard } from "@/components/QuestionCard";
import { Button } from "@/components/ui/button";
import { PASS_MARK } from "@/content/schema";
import { buildQuiz, correctText, type Answer, type QuizItem } from "@/engine/quiz";
import type { QuizOutcome } from "@/engine/progress";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { useApp } from "@/state/app";

gsap.registerPlugin(useGSAP);

/** Final quiz: 10 questions, 80%+ passes the lesson and unlocks the next one. */
export function QuizStep({
  lesson,
  onNext,
  onReview,
  attemptsSoFar,
}: {
  lesson: Lesson;
  onNext: () => void;
  onReview: () => void;
  attemptsSoFar: number;
}) {
  const finishQuiz = useApp((s) => s.finishQuiz);
  const logAttempt = useApp((s) => s.logAttempt);
  const [attempt, setAttempt] = useState(attemptsSoFar);
  const items = useMemo(() => buildQuiz(lesson, attempt), [lesson, attempt]);
  const [k, setK] = useState(0);
  const [answers, setAnswers] = useState<{ item: QuizItem; ok: boolean; given: Answer }[]>([]);
  const [outcome, setOutcome] = useState<QuizOutcome | null>(null);

  const answer = async (item: QuizItem, ok: boolean, given: Answer) => {
    const next = [...answers, { item, ok, given }];
    setAnswers(next);
    void logAttempt({ skill: item.skill, correct: ok ? 1 : 0, total: 1, tag: item.tag });
    if (k < items.length - 1) {
      setK(k + 1);
      return;
    }
    const ratio = next.filter((a) => a.ok).length / items.length;
    setOutcome(await finishQuiz(lesson, ratio));
  };

  if (outcome) {
    return (
      <QuizResult
        answers={answers}
        outcome={outcome}
        onRetry={() => {
          setAttempt((a) => a + 1);
          setK(0);
          setAnswers([]);
          setOutcome(null);
        }}
        onNext={onNext}
        onReview={onReview}
      />
    );
  }
  const item = items[k]!;
  return (
    <div className="flex min-h-full flex-col">
      <div className="mb-4 flex gap-1" aria-hidden>
        {items.map((_, j) => (
          <span key={j} className={cn("h-1 flex-1 rounded-full", j < answers.length ? (answers[j]!.ok ? "bg-success" : "bg-danger") : j === k ? "bg-accent" : "bg-surface-2")} />
        ))}
      </div>
      <QuestionCard key={`${attempt}-${item.id}`} q={item} index={k} total={items.length} onAnswered={(ok, given) => void answer(item, ok, given)} />
    </div>
  );
}

function QuizResult({
  answers,
  outcome,
  onRetry,
  onNext,
  onReview,
}: {
  answers: { item: QuizItem; ok: boolean; given: Answer }[];
  outcome: QuizOutcome;
  onRetry: () => void;
  onNext: () => void;
  onReview: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const xpRef = useRef<HTMLSpanElement>(null);
  const correct = answers.filter((a) => a.ok).length;
  const pct = Math.round((correct / answers.length) * 100);
  const missed = answers.filter((a) => !a.ok);

  useGSAP(
    () => {
      const reduced = prefersReducedMotion();
      const score = { v: 0 };
      const xp = { v: 0 };
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (reduced) {
        if (counter.current) counter.current.textContent = `${pct}`;
        if (xpRef.current) xpRef.current.textContent = `+${outcome.xp}`;
        return;
      }
      tl.fromTo(".res-badge", { scale: 0.3, autoAlpha: 0, rotation: -20 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.7, ease: "back.out(2)" })
        .to(score, {
          v: pct,
          duration: 1,
          snap: { v: 1 },
          onUpdate: () => {
            if (counter.current) counter.current.textContent = `${score.v}`;
          },
        }, 0.15)
        .fromTo(".res-xp", { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 }, 0.8)
        .to(xp, {
          v: outcome.xp,
          duration: 0.8,
          snap: { v: 1 },
          onUpdate: () => {
            if (xpRef.current) xpRef.current.textContent = `+${xp.v}`;
          },
        }, 0.85)
        .fromTo(".res-rest", { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.08 }, 1);
    },
    { scope: root },
  );

  return (
    <div ref={root} className="flex min-h-full flex-col">
      <div className="mt-4 flex flex-col items-center text-center">
        <div className={cn("res-badge grid size-24 place-items-center rounded-full", outcome.passed ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
          {outcome.passed ? <Trophy size={44} /> : <X size={44} />}
        </div>
        <div className="mt-5 display text-[64px] leading-none tabular-nums">
          <span ref={counter}>0</span>%
        </div>
        <div className="mt-2 text-[15px] text-muted">
          {correct} of {answers.length} correct · pass mark {Math.round(PASS_MARK * 100)}%
        </div>
        <div className="res-xp mt-4 inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-1.5 text-[15px] font-semibold text-accent tabular-nums">
          <span ref={xpRef}>+0</span> XP
        </div>
        <h2 className="res-rest display mt-6 text-[26px]">{outcome.passed ? (outcome.firstPass ? "Lesson passed!" : "Passed again — nice.") : "Almost there"}</h2>
        <p className="res-rest mt-2 max-w-sm text-[14px] text-muted">
          {outcome.passed
            ? "The next lesson is unlocked, and these words are now in your review deck."
            : "You need 80% to unlock the next lesson. Look at what you missed, then try a new set of questions."}
        </p>
      </div>

      {missed.length ? (
        <div className="res-rest mt-6">
          <h3 className="eyebrow">Review these</h3>
          <ul className="mt-2 space-y-2">
            {missed.map(({ item, given }) => (
              <li key={item.id} className="card p-4 text-[14px]">
                <div className="font-medium">{item.type === "order" ? item.prompt ?? "Word order" : item.prompt}</div>
                <div className="mt-1 text-danger">
                  You: {item.type === "mc" ? (item.options[Number(given)] ?? "—") : String(given) || "—"}
                </div>
                <div className="text-success">Answer: {correctText(item)}</div>
                {item.explanation ? <div className="mt-1 text-[13px] text-muted">{item.explanation}</div> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="res-rest mt-auto space-y-3 pt-8">
        {outcome.passed ? (
          <Button block size="lg" onClick={onNext}>
            Next lesson <ArrowRight />
          </Button>
        ) : (
          <>
            <Button block size="lg" onClick={onRetry}>
              <RotateCcw /> Try a new quiz
            </Button>
            <Button block size="lg" variant="secondary" onClick={onReview}>
              Review the lesson first
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
