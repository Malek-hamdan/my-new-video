import { Check, ChevronRight, Flame, Lock, Play, Sparkles, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LEVELS, LEVEL_LABEL, LEVEL_NAME, OUTLINE, unitsForLevel, type Level, type UnitOutline } from "@/content";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress";
import {
  FIXED_UNITS,
  LESSONS_PER_UNIT,
  currentLevel,
  endlessUnitId,
  frontier,
  indexOfLesson,
  isUnlocked,
  liveStreak,
  pathAt,
  todaysXp,
} from "@/engine/progress";
import { cn } from "@/lib/utils";
import { peekUnit, useApp } from "@/state/app";
import { useNav } from "@/state/nav";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export function LearnHome() {
  const progress = useApp((s) => s.progress);
  const dueCount = useApp((s) => s.dueCount);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const front = frontier(progress);
  const next = pathAt(front);
  const level = currentLevel(progress);
  const [view, setView] = useState<Level | "endless">(next.endless ? "endless" : level);
  const [nextUnit, setNextUnit] = useState<UnitOutline | null>(null);

  useEffect(() => {
    void peekUnit(next.unitId).then(setNextUnit);
  }, [next.unitId]);

  const goal = progress.dailyGoal;
  const today = todaysXp(progress);
  const streak = liveStreak(progress);
  const passedCount = useMemo(() => Object.values(progress.lessons).filter((l) => l.passed).length, [progress.lessons]);

  return (
    <Screen>
      {/* Header: greeting + streak/XP/goal */}
      <div className="flex items-start justify-between gap-4 pt-2">
        <div>
          <div className="eyebrow">{greeting()}</div>
          <h1 className="display mt-1 text-[34px]">
            Your <em className="text-accent italic">path</em>
          </h1>
        </div>
        <ProgressRing value={today / goal} size={60} label={`Daily goal: ${today} of ${goal} XP`}>
          <div className="text-center leading-none">
            <div className="text-[15px] font-semibold tabular-nums">{today}</div>
            <div className="text-[9px] text-muted">/{goal} XP</div>
          </div>
        </ProgressRing>
      </div>

      <div className="mt-4 flex gap-2">
        <Chip icon={<Flame size={15} className={streak ? "text-accent" : "text-muted"} />} label={`${streak} day${streak === 1 ? "" : "s"}`} />
        <Chip icon={<Zap size={15} className="text-accent" />} label={`${progress.xp} XP`} />
        <Chip icon={<Check size={15} className="text-success" />} label={`${passedCount} lessons`} />
      </div>

      {/* Continue card */}
      <button
        type="button"
        onClick={() => push({ name: "lesson", lessonId: next.lessonId })}
        className="tap focus-ring card relative mt-6 block w-full overflow-hidden p-5 text-left"
      >
        <div className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full bg-accent/10 blur-2xl" aria-hidden />
        <div className="eyebrow">
          {next.endless ? "Endless path" : `${LEVEL_LABEL[next.level]} · Unit ${OUTLINE[next.unitIndex]?.index ?? ""}`} · Lesson {next.lessonNo}
        </div>
        <div className="display mt-2 text-[26px]">{nextUnit ? nextUnit.lessonTitles[next.lessonNo - 1] : "A new mastery unit"}</div>
        <p className="mt-1.5 line-clamp-2 text-[14px] text-muted">{nextUnit ? nextUnit.canDo : "Generated for you at C2, focused on your weak points."}</p>
        <div className="mt-5 flex items-center justify-between">
          <span className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-accent-fg">
            <Play size={16} fill="currentColor" /> {progress.lessons[next.lessonId]?.steps.length ? "Continue" : "Start lesson"}
          </span>
          <span className="text-[12px] text-muted tabular-nums">{progress.lessons[next.lessonId]?.steps.length ?? 0}/7 steps</span>
        </div>
      </button>

      {/* Quick actions */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setTab("review")} className="tap focus-ring card p-4 text-left">
          <div className="text-[22px] font-semibold tabular-nums">{dueCount}</div>
          <div className="text-[13px] text-muted">reviews due</div>
        </button>
        <button type="button" onClick={() => push({ name: "practice" })} className="tap focus-ring card p-4 text-left">
          <Sparkles size={20} className="text-accent" />
          <div className="mt-1 text-[13px] text-muted">Endless practice</div>
        </button>
      </div>

      {/* Level selector */}
      <div className="mt-8 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {[...LEVELS, "endless" as const].map((l) => {
          const reached = l === "endless" ? front >= FIXED_UNITS * LESSONS_PER_UNIT : LEVELS.indexOf(l) <= LEVELS.indexOf(level) || progress.placedOut.includes(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => setView(l)}
              className={cn(
                "tap focus-ring h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium",
                view === l ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-2",
                !reached && view !== l && "opacity-55",
              )}
            >
              {l === "endless" ? "∞ Endless" : LEVEL_LABEL[l]}
            </button>
          );
        })}
      </div>

      {view === "endless" ? (
        <EndlessList />
      ) : (
        <>
          <div className="mt-5 mb-3 flex items-baseline justify-between">
            <h2 className="display text-[22px]">{LEVEL_NAME[view]}</h2>
            <span className="eyebrow">{LEVEL_LABEL[view]}</span>
          </div>
          <div className="space-y-3">
            {unitsForLevel(view).map((u) => (
              <UnitCard key={u.id} unit={u} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-fg-2 tabular-nums">
      {icon}
      {label}
    </span>
  );
}

function UnitCard({ unit }: { unit: UnitOutline }) {
  const progress = useApp((s) => s.progress);
  const push = useNav((s) => s.push);
  const first = indexOfLesson(`${unit.id}-l1`);
  const states = [0, 1, 2].map((k) => {
    const id = pathAt(first + k).lessonId;
    return progress.lessons[id]?.passed ? "done" : isUnlocked(progress, first + k) ? "open" : "locked";
  });
  const locked = states[0] === "locked";
  return (
    <button
      type="button"
      onClick={() => push({ name: "unit", unitId: unit.id })}
      className={cn("tap focus-ring card flex w-full items-center gap-4 p-4 text-left", locked && "opacity-60")}
    >
      <div
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-2xl text-[17px] font-semibold tabular-nums",
          states.every((s) => s === "done") ? "bg-success-soft text-success" : locked ? "bg-surface-2 text-muted" : "bg-accent-soft text-accent",
        )}
      >
        {locked ? <Lock size={18} /> : states.every((s) => s === "done") ? <Check size={20} /> : unit.index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[16px] font-semibold">{unit.title}</div>
        <div className="mt-0.5 line-clamp-1 text-[13px] text-muted">{unit.canDo}</div>
        <div className="mt-2 flex gap-1.5" aria-label={`${states.filter((s) => s === "done").length} of 3 lessons passed`}>
          {states.map((s, i) => (
            <span key={i} className={cn("h-1.5 w-8 rounded-full", s === "done" ? "bg-success" : s === "open" ? "bg-accent" : "bg-surface-2")} />
          ))}
        </div>
      </div>
      <ChevronRight size={18} className="text-muted" />
    </button>
  );
}

function EndlessList() {
  const progress = useApp((s) => s.progress);
  const push = useNav((s) => s.push);
  const front = frontier(progress);
  const reached = front >= FIXED_UNITS * LESSONS_PER_UNIT;
  const shown = reached ? Math.floor((front - FIXED_UNITS * LESSONS_PER_UNIT) / LESSONS_PER_UNIT) + 1 : 1;
  const [titles, setTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    void Promise.all(
      Array.from({ length: shown }, (_, i) => endlessUnitId(i + 1)).map(async (id) => [id, (await peekUnit(id))?.title] as const),
    ).then((rows) => setTitles(Object.fromEntries(rows.filter(([, t]) => t).map(([id, t]) => [id, t!]))));
  }, [shown]);

  return (
    <div className="mt-5 space-y-3">
      <p className="text-[14px] text-muted">
        After C2 the course never ends: new mastery units are generated for you, one at a time, around your weak points.
      </p>
      {Array.from({ length: shown }, (_, i) => {
        const id = endlessUnitId(i + 1);
        return (
          <button
            key={id}
            type="button"
            disabled={!reached}
            onClick={() => push({ name: "unit", unitId: id })}
            className="tap focus-ring card flex w-full items-center gap-4 p-4 text-left disabled:opacity-60"
          >
            <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">{reached ? "∞" : <Lock size={18} />}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{titles[id] ?? `Mastery unit ${i + 1}`}</div>
              <div className="text-[13px] text-muted">{reached ? "Generated on demand" : "Unlocks after the C2 outline"}</div>
            </div>
          </button>
        );
      })}
      {!reached ? (
        <Button variant="secondary" block onClick={() => push({ name: "practice" })}>
          Practise what you know
        </Button>
      ) : null}
    </div>
  );
}
