import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Brain, Infinity as InfinityIcon, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { getStore, type SrsRow } from "@/db";
import { XP } from "@/engine/progress";
import { formatInterval, previewIntervals, Rating, reviewCard, type Grade } from "@/engine/srs";
import { useBackHandler } from "@/hooks/useBack";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { tap } from "@/native/haptics";
import { speak } from "@/native/tts";
import { useApp } from "@/state/app";
import { useNav } from "@/state/nav";

gsap.registerPlugin(useGSAP);

export function ReviewHome() {
  const dueCount = useApp((s) => s.dueCount);
  const refresh = useApp((s) => s.refreshCounts);
  const push = useNav((s) => s.push);
  const [stats, setStats] = useState<{ total: number; words: number; grammar: number; next: number | null }>({ total: 0, words: 0, grammar: 0, next: null });

  useEffect(() => {
    void refresh();
    void (async () => {
      const cards = await (await getStore()).allCards();
      const future = cards.filter((c) => c.due > Date.now()).map((c) => c.due);
      setStats({
        total: cards.length,
        words: cards.filter((c) => c.kind === "word").length,
        grammar: cards.filter((c) => c.kind === "grammar").length,
        next: future.length ? Math.min(...future) : null,
      });
    })();
  }, [refresh]);

  return (
    <Screen>
      <div className="pt-2">
        <div className="eyebrow">Spaced repetition · FSRS</div>
        <h1 className="display mt-1 text-[34px]">
          Review, <em className="text-accent italic">remember</em>
        </h1>
      </div>
      <div className="card mt-6 p-6">
        <div className="text-[64px] leading-none font-semibold tabular-nums">{dueCount}</div>
        <div className="mt-1 text-[15px] text-muted">{dueCount === 1 ? "card is" : "cards are"} due now</div>
        <p className="mt-4 text-[14px] text-fg-2">
          Each word and grammar point comes back just before you'd forget it. Rate honestly — the schedule adapts to you.
        </p>
        <Button className="mt-5" block size="lg" disabled={dueCount === 0} onClick={() => push({ name: "reviewSession" })}>
          <Brain /> {dueCount ? "Start review" : "All caught up"}
        </Button>
        {dueCount === 0 && stats.next ? <p className="mt-3 text-center text-[13px] text-muted">Next card due in {formatInterval(stats.next - Date.now())}.</p> : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          ["Total", stats.total],
          ["Words", stats.words],
          ["Grammar", stats.grammar],
        ].map(([l, n]) => (
          <div key={l} className="card p-4">
            <div className="text-[22px] font-semibold tabular-nums">{n}</div>
            <div className="text-[12px] text-muted">{l}</div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => push({ name: "practice" })} className="tap focus-ring card mt-3 flex w-full items-center gap-4 p-4 text-left">
        <InfinityIcon className="text-accent" />
        <div>
          <div className="font-semibold">Endless practice</div>
          <div className="text-[13px] text-muted">Fresh mixed questions from everything you've learned, any time.</div>
        </div>
      </button>
      {stats.total === 0 ? <p className="mt-6 text-center text-[14px] text-muted">Pass a lesson quiz and its words and grammar join your deck.</p> : null}
    </Screen>
  );
}

const GRADES: { g: Grade; label: string; cls: string }[] = [
  { g: Rating.Again, label: "Again", cls: "border-danger/50 text-danger" },
  { g: Rating.Hard, label: "Hard", cls: "border-line-strong text-fg-2" },
  { g: Rating.Good, label: "Good", cls: "border-success/50 text-success" },
  { g: Rating.Easy, label: "Easy", cls: "border-accent/60 text-accent" },
];

export function ReviewSession() {
  const pop = useNav((s) => s.pop);
  const { gainXp, logAttempt, refreshCounts, progress } = useApp();
  const [queue, setQueue] = useState<SrsRow[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [doneCount, setDoneCount] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const card = queue?.[0];

  useBackHandler(() => {
    void refreshCounts();
    pop();
    return true;
  });

  useEffect(() => {
    void (async () => setQueue(await (await getStore()).dueCards(Date.now(), 200)))();
  }, []);

  useEffect(() => {
    if (!card) return;
    setFlipped(false);
    void previewIntervals(card).then(setPreviews);
    if (card.kind === "word") void speak(card.front);
  }, [card]);

  useGSAP(
    () => {
      if (!card || prefersReducedMotion()) return;
      gsap.fromTo(".rev-card", { autoAlpha: 0, y: 20, rotationX: -8 }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.45, ease: "power3.out" });
    },
    { scope: root, dependencies: [card?.id, doneCount] },
  );
  useGSAP(
    () => {
      if (!flipped || prefersReducedMotion()) return;
      gsap.fromTo(".rev-back", { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" });
    },
    { scope: root, dependencies: [flipped] },
  );

  const grade = async (g: Grade) => {
    if (!card || !queue) return;
    const store = await getStore();
    const next = await reviewCard(store, card, g);
    void tap(g === Rating.Again ? "error" : "success");
    void logAttempt({
      skill: card.kind === "word" ? "vocabulary" : "grammar",
      correct: g === Rating.Again ? 0 : 1,
      total: 1,
      tag: card.kind === "word" ? `word:${card.front.toLowerCase().replace(/\s+/g, "-")}` : `grammar:${card.id.slice(2)}`,
    });
    void gainXp(XP.review, { reviews: progress.reviews + 1 });
    // "Again" cards come back in this session once their short learning step is due.
    const rest = queue.slice(1);
    setQueue(next.due <= Date.now() + 10 * 60_000 ? [...rest, next] : rest);
    setDoneCount((n) => n + 1);
  };

  const data = card?.data as { example?: string; emoji?: string; ipa?: string | null; examples?: string[]; mistake?: { wrong: string; right: string } | null } | undefined;

  return (
    <div ref={root} className="safe-top mx-auto flex h-dvh max-w-xl flex-col px-4">
      <div className="flex items-center gap-3 py-2">
        <button type="button" aria-label="End review" onClick={() => { void refreshCounts(); pop(); }} className="tap grid size-11 place-items-center rounded-full text-muted">
          <X size={22} />
        </button>
        <span className="eyebrow tabular-nums">
          {doneCount} reviewed · {queue?.length ?? 0} left
        </span>
      </div>
      <div className="scroll-area flex flex-1 flex-col pb-6 [perspective:900px]">
        {queue && !card ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="text-[56px]">🧠</div>
            <h2 className="display mt-3 text-[28px]">Session complete</h2>
            <p className="mt-2 text-[14px] text-muted">{doneCount} cards reviewed. Come back when the next ones are due — or keep practising.</p>
            <div className="mt-6 flex w-full max-w-xs flex-col gap-3">
              <Button size="lg" onClick={() => { void refreshCounts(); pop(); }}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
        {card ? (
          <>
            <div className="rev-card card mt-4 flex min-h-[320px] flex-col p-6">
              <div className="eyebrow">{card.kind === "word" ? "Word" : "Grammar"}</div>
              {card.kind === "word" ? (
                <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
                  <div className="text-[56px] leading-none">{data?.emoji}</div>
                  <div className="display mt-4 text-[40px]">{card.front}</div>
                  {data?.ipa ? <div className="font-mono text-[15px] text-muted">{data.ipa}</div> : null}
                  <button type="button" aria-label="Listen" onClick={() => void speak(card.front)} className="tap mt-3 grid size-11 place-items-center rounded-full border border-line">
                    <Volume2 size={18} />
                  </button>
                </div>
              ) : (
                <div className="mt-4 flex flex-1 flex-col justify-center">
                  <div className="display text-[30px]">{card.front}</div>
                  <p className="mt-2 text-[14px] text-muted">Can you explain the rule and give an example?</p>
                </div>
              )}
              {flipped ? (
                <div className="rev-back mt-6 border-t border-line pt-5 text-[15px]">
                  {card.kind === "word" ? (
                    <>
                      <p>{card.back}</p>
                      {data?.example ? <p className="mt-2 text-fg-2 italic">“{data.example}”</p> : null}
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-line text-fg-2">{card.back.replace(/\*\*/g, "")}</p>
                      {data?.examples?.[0] ? <p className="mt-2 italic">“{data.examples[0]}”</p> : null}
                      {data?.mistake ? (
                        <p className="mt-2 text-[13px]">
                          <span className="text-danger line-through">{data.mistake.wrong}</span> → <span className="text-success">{data.mistake.right}</span>
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </div>
            <div className="mt-auto pt-6">
              {!flipped ? (
                <Button block size="lg" onClick={() => setFlipped(true)}>
                  Show answer
                </Button>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {GRADES.map(({ g, label, cls }) => (
                    <button key={g} type="button" onClick={() => void grade(g)} className={cn("tap focus-ring flex h-16 flex-col items-center justify-center rounded-2xl border bg-surface", cls)}>
                      <span className="text-[14px] font-semibold">{label}</span>
                      <span className="text-[11px] text-muted tabular-nums">{previews[g] ?? ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
