import { Infinity as InfinityIcon, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getStore } from "@/db";
import { buildPractice } from "@/engine/offline";
import { XP } from "@/engine/progress";
import type { QuizItem } from "@/engine/quiz";
import { computeWeakPoints } from "@/engine/stats";
import { useBackHandler } from "@/hooks/useBack";
import { passedLessons, useApp } from "@/state/app";
import { useNav } from "@/state/nav";
import { QuestionRun } from "./lesson/LearnSteps";

/**
 * Endless offline practice: every round is a new mix of everything passed so far,
 * weighted toward weak points. Works without internet or an API key.
 */
export function PracticeScreen() {
  const pop = useNav((s) => s.pop);
  const gainXp = useApp((s) => s.gainXp);
  const logAttempt = useApp((s) => s.logAttempt);
  const [round, setRound] = useState(() => Date.now() % 100000);
  const [items, setItems] = useState<QuizItem[] | null>(null);
  const [score, setScore] = useState<{ c: number; t: number } | null>(null);

  useBackHandler(() => {
    pop();
    return true;
  });

  useEffect(() => {
    void (async () => {
      const store = await getStore();
      const [lessons, attempts, cards] = await Promise.all([passedLessons(), store.attemptsSince(Date.now() - 30 * 864e5), store.allCards()]);
      const weak = computeWeakPoints(attempts, cards, 20).map((w) => w.tag);
      setItems(buildPractice(lessons, weak, round));
    })();
  }, [round]);

  return (
    <div className="safe-top mx-auto flex h-dvh max-w-xl flex-col px-4">
      <div className="flex items-center gap-3 py-2">
        <button type="button" aria-label="Close practice" onClick={pop} className="tap grid size-11 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <span className="eyebrow">Endless practice</span>
      </div>
      <div className="scroll-area flex flex-1 flex-col pb-6">
        {items === null ? null : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <InfinityIcon size={40} className="text-accent" />
            <h2 className="display mt-4 text-[26px]">Pass your first lesson</h2>
            <p className="mt-2 max-w-xs text-[14px] text-muted">Practice mixes everything you've learned. Finish a lesson quiz and it starts here — forever.</p>
            <Button className="mt-6" onClick={pop}>
              Go to my lesson
            </Button>
          </div>
        ) : score ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="display text-[64px] tabular-nums">
              {score.c}/{score.t}
            </div>
            <p className="mt-2 text-muted">+{XP.practice} XP · a fresh set is ready</p>
            <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
              <Button size="lg" onClick={() => { setScore(null); setItems(null); setRound((r) => r + 1); }}>
                <RotateCcw /> Next round
              </Button>
              <Button size="lg" variant="secondary" onClick={pop}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <QuestionRun
            key={round}
            tag={`p${round}`}
            questions={items}
            onEach={(q, ok) => {
              const item = q as QuizItem;
              void logAttempt({ skill: item.skill, correct: ok ? 1 : 0, total: 1, tag: item.tag });
            }}
            onFinish={(c, t) => {
              setScore({ c, t });
              void gainXp(XP.practice);
            }}
          />
        )}
      </div>
    </div>
  );
}
