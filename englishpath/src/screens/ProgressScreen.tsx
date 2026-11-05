import { Award, ChevronRight, Flame, Target, TrendingDown, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { LEVEL_LABEL, LEVEL_NAME, SKILLS, unitsForLevel, type Skill } from "@/content";
import { Screen } from "@/components/Screen";
import { ProgressBar, ProgressRing } from "@/components/ui/progress";
import { getStore } from "@/db";
import { ACHIEVEMENTS, currentLevel, liveStreak, todaysXp, xpRank } from "@/engine/progress";
import { activityByDay, computeWeakPoints, skillAccuracy, type WeakPoint } from "@/engine/stats";
import { cn } from "@/lib/utils";
import { useApp } from "@/state/app";
import { useNav } from "@/state/nav";

const SKILL_LABEL: Record<Skill, string> = {
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
};

export function ProgressScreen() {
  const progress = useApp((s) => s.progress);
  const wordsLearned = useApp((s) => s.wordsLearned);
  const update = useApp((s) => s.update);
  const push = useNav((s) => s.push);
  const [acc, setAcc] = useState<Record<Skill, number | null> | null>(null);
  const [weak, setWeak] = useState<WeakPoint[]>([]);
  const [activity, setActivity] = useState<{ day: string; count: number }[]>([]);

  useEffect(() => {
    void (async () => {
      const store = await getStore();
      const [attempts, cards] = await Promise.all([store.attemptsSince(Date.now() - 30 * 864e5), store.allCards()]);
      setAcc(skillAccuracy(attempts));
      setWeak(computeWeakPoints(attempts, cards));
      setActivity(activityByDay(attempts));
    })();
  }, []);

  const level = currentLevel(progress);
  const levelLessons = unitsForLevel(level).flatMap((u) => [1, 2, 3].map((n) => `${u.id}-l${n}`));
  const levelDone = levelLessons.filter((id) => progress.lessons[id]?.passed).length;
  const rank = xpRank(progress.xp);
  const streak = liveStreak(progress);
  const today = todaysXp(progress);
  const maxAct = Math.max(1, ...activity.map((a) => a.count));

  return (
    <Screen>
      <div className="pt-2">
        <div className="eyebrow">Dashboard</div>
        <h1 className="display mt-1 text-[34px]">
          Your <em className="text-accent italic">progress</em>
        </h1>
      </div>

      {/* Level hero */}
      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="eyebrow">Current level</div>
            <div className="display mt-1 text-[56px] leading-none text-accent">{LEVEL_LABEL[level]}</div>
            <div className="mt-1 text-[14px] text-muted">{LEVEL_NAME[level]}</div>
          </div>
          <ProgressRing value={levelDone / levelLessons.length} size={88} stroke={8} label={`${levelDone} of ${levelLessons.length} lessons in ${LEVEL_LABEL[level]}`}>
            <div className="text-center leading-tight">
              <div className="text-[18px] font-semibold tabular-nums">{Math.round((levelDone / levelLessons.length) * 100)}%</div>
              <div className="text-[10px] text-muted">of level</div>
            </div>
          </ProgressRing>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[12px] text-muted tabular-nums">
            <span>Rank {rank.rank}</span>
            <span>
              {rank.into} / {rank.span} XP
            </span>
          </div>
          <ProgressBar className="mt-1.5" value={rank.into / rank.span} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat icon={<Flame className={streak ? "text-accent" : "text-muted"} size={18} />} value={streak} label={`day streak · best ${progress.streak.best}`} />
        <Stat icon={<Zap className="text-accent" size={18} />} value={progress.xp} label="total XP" />
        <Stat icon={<Award className="text-accent" size={18} />} value={wordsLearned} label="words learned" />
        <Stat icon={<Target className="text-accent" size={18} />} value={`${today}/${progress.dailyGoal}`} label="today's XP goal" />
      </div>

      {/* Daily goal */}
      <section className="card mt-3 p-5" aria-labelledby="goal-h">
        <h2 id="goal-h" className="font-semibold">
          Daily goal
        </h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[20, 50, 100, 150].map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={progress.dailyGoal === g}
              onClick={() => void update((p) => ({ ...p, dailyGoal: g }))}
              className={cn("tap focus-ring h-14 rounded-2xl border text-center", progress.dailyGoal === g ? "border-accent bg-accent-soft text-accent" : "border-line")}
            >
              <div className="text-[15px] font-semibold tabular-nums">{g}</div>
              <div className="text-[10px] text-muted">{g === 20 ? "casual" : g === 50 ? "regular" : g === 100 ? "serious" : "intense"}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Accuracy per skill — single series, direct labels, one validated hue */}
      <section className="card mt-3 p-5" aria-labelledby="acc-h">
        <h2 id="acc-h" className="font-semibold">
          Accuracy by skill <span className="text-[12px] font-normal text-muted">· last 30 days</span>
        </h2>
        <ul className="mt-4 space-y-3">
          {SKILLS.map((s) => {
            const v = acc?.[s] ?? null;
            return (
              <li key={s} className="grid grid-cols-[88px_1fr_44px] items-center gap-3 text-[13px]">
                <span className="text-fg-2">{SKILL_LABEL[s]}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`${SKILL_LABEL[s]}: ${v === null ? "no data" : `${Math.round(v * 100)}%`}`}>
                  <div className="h-full origin-left rounded-full bg-chart transition-transform duration-700" style={{ transform: `scaleX(${v ?? 0})` }} />
                </div>
                <span className="text-right font-medium tabular-nums">{v === null ? "—" : `${Math.round(v * 100)}%`}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Activity */}
      <section className="card mt-3 p-5" aria-labelledby="act-h">
        <h2 id="act-h" className="font-semibold">
          Activity <span className="text-[12px] font-normal text-muted">· answers per day</span>
        </h2>
        <div className="mt-4 flex h-28 items-end gap-2">
          {activity.map((a, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" role="img" aria-label={`${a.day}: ${a.count}`}>
              {a.count > 0 && (i === activity.length - 1 || a.count === maxAct) ? <span className="text-[11px] font-medium tabular-nums">{a.count}</span> : null}
              <div className="w-full max-w-7 rounded-t-[4px] bg-chart" style={{ height: `${(a.count / maxAct) * 80}%`, minHeight: a.count ? 3 : 0 }} />
              <span className="text-[10px] text-muted">{a.day}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Weak points */}
      <section className="card mt-3 p-5" aria-labelledby="weak-h">
        <h2 id="weak-h" className="flex items-center gap-2 font-semibold">
          <TrendingDown size={18} className="text-danger" /> Weak points
        </h2>
        {weak.length ? (
          <ul className="mt-3 divide-y divide-line">
            {weak.map((w) => (
              <li key={w.tag} className="flex items-center justify-between py-2.5 text-[14px]">
                <span className="min-w-0 truncate">{w.label}</span>
                <span className="ml-3 shrink-0 text-danger tabular-nums">{Math.round(w.accuracy * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[14px] text-muted">Nothing below 70% yet. Weak points appear here after a few tries and are fed into new lessons and practice.</p>
        )}
        {weak.length ? (
          <button type="button" onClick={() => push({ name: "practice" })} className="tap mt-3 text-[14px] font-semibold text-accent">
            Practise these now →
          </button>
        ) : null}
      </section>

      <button type="button" onClick={() => push({ name: "achievements" })} className="tap focus-ring card mt-3 flex w-full items-center gap-4 p-5 text-left">
        <div className="text-[28px]" aria-hidden>
          🏅
        </div>
        <div className="flex-1">
          <div className="font-semibold">Achievements</div>
          <div className="text-[13px] text-muted tabular-nums">
            {progress.achievements.length} of {Object.keys(ACHIEVEMENTS).length} unlocked
          </div>
        </div>
        <ChevronRight className="text-muted" size={18} />
      </button>
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="card p-4">
      {icon}
      <div className="mt-2 text-[26px] leading-none font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[12px] text-muted">{label}</div>
    </div>
  );
}

export function AchievementsScreen() {
  const have = useApp((s) => s.progress.achievements);
  return (
    <Screen back eyebrow="Progress" title="Achievements">
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
          const got = have.includes(id);
          return (
            <div key={id} className={cn("card p-4", !got && "opacity-45 grayscale")}>
              <div className="text-[32px]" aria-hidden>
                {a.emoji}
              </div>
              <div className="mt-2 font-semibold">{a.title}</div>
              <div className="text-[12px] text-muted">{a.detail}</div>
              <div className={cn("mt-2 text-[11px] font-semibold", got ? "text-success" : "text-muted")}>{got ? "Unlocked" : "Locked"}</div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
