import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, Compass, Sprout } from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { LEVEL_LABEL, LEVEL_NAME, PLACEMENT, type Level } from "@/content";
import { StaticOrb } from "@/components/StaticOrb";
import { QuestionCard } from "@/components/QuestionCard";
import SplitText from "@/components/reactbits/SplitText";
import { Button } from "@/components/ui/button";
import { placementResult } from "@/engine/progress";
import { useBackHandler } from "@/hooks/useBack";
import { prefersReducedMotion } from "@/lib/utils";
import { useApp } from "@/state/app";

gsap.registerPlugin(useGSAP);

// The 3D globe lives in its own lazy chunk (three.js) so it never slows app start.
const OnboardingGlobe = lazy(() => import("@/components/OnboardingGlobe"));

type Phase = "welcome" | "choose" | "placement" | "result";

export function Onboarding() {
  const update = useApp((s) => s.update);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [section, setSection] = useState(0);
  const [q, setQ] = useState(0);
  const [scores, setScores] = useState<{ level: Level; ratio: number }[]>([]);
  const [correct, setCorrect] = useState(0);
  const [result, setResult] = useState<{ start: Level; placedOut: Level[] } | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useBackHandler(() => {
    if (phase === "welcome") return false;
    setPhase(phase === "placement" || phase === "result" ? "choose" : "welcome");
    return true;
  });

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(".ob-fade", { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12, delay: phase === "welcome" ? 0.9 : 0.1, ease: "power3.out" });
    },
    { scope: root, dependencies: [phase] },
  );

  const finish = (start: Level, placedOut: Level[]) =>
    update((p) => ({ ...p, onboarded: true, placementDone: placedOut.length > 0 || start !== "PreA1", startLevel: start, placedOut }));

  const answer = (ok: boolean) => {
    const sec = PLACEMENT[section]!;
    const c = correct + (ok ? 1 : 0);
    if (q < sec.questions.length - 1) {
      setCorrect(c);
      setQ(q + 1);
      return;
    }
    const all = [...scores, { level: sec.level, ratio: c / sec.questions.length }];
    setScores(all);
    setCorrect(0);
    setQ(0);
    // Stop early at the first failed section: no need to show harder questions.
    if (c / sec.questions.length < 0.8 || section === PLACEMENT.length - 1) {
      setResult(placementResult(all));
      setPhase("result");
    } else setSection(section + 1);
  };

  if (phase === "placement") {
    const sec = PLACEMENT[section]!;
    const total = PLACEMENT.reduce((n, s) => n + s.questions.length, 0);
    const doneCount = PLACEMENT.slice(0, section).reduce((n, s) => n + s.questions.length, 0) + q;
    return (
      <div ref={root} className="safe-top mx-auto flex h-dvh max-w-xl flex-col px-4 pb-6">
        <div className="flex items-center justify-between py-3">
          <span className="eyebrow">Placement · {LEVEL_LABEL[sec.level]}</span>
          <button type="button" className="text-[13px] text-muted underline" onClick={() => setPhase("choose")}>
            Cancel
          </button>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full origin-left bg-accent transition-transform duration-500" style={{ transform: `scaleX(${doneCount / total})` }} />
        </div>
        <div className="scroll-area mt-6 flex flex-1 flex-col">
          <QuestionCard key={`${section}-${q}`} q={sec.questions[q]!} onAnswered={(ok) => answer(ok)} />
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div ref={root} className="safe-top mx-auto flex h-dvh max-w-xl flex-col px-6 pb-8 text-center">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="ob-fade eyebrow">Your starting level</div>
          <SplitText key={result.start} text={LEVEL_LABEL[result.start]} tag="h1" splitType="chars" effect="pop" textAlign="center" className="display mt-4 text-[96px] leading-none text-accent" />
          <p className="ob-fade mt-3 text-[20px]">{LEVEL_NAME[result.start]}</p>
          <p className="ob-fade mt-4 max-w-sm text-[15px] text-muted">
            {result.placedOut.length
              ? `You tested out of ${result.placedOut.map((l) => LEVEL_LABEL[l]).join(", ")}. Those lessons stay open for revision.`
              : "You'll start from the very beginning — the best foundation."}
          </p>
        </div>
        <Button className="ob-fade" size="lg" block onClick={() => void finish(result.start, result.placedOut)}>
          Start learning <ArrowRight />
        </Button>
      </div>
    );
  }

  return (
    <div ref={root} className="safe-top relative mx-auto flex h-dvh max-w-xl flex-col overflow-hidden px-6 pb-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60%] bg-[radial-gradient(70%_60%_at_50%_35%,rgb(253_182_28/0.10),transparent_70%)]" aria-hidden />
      <div className="relative h-[42dvh] min-h-[260px] w-full">
        <Suspense fallback={<StaticOrb />}>
          <OnboardingGlobe className="absolute inset-0" />
        </Suspense>
      </div>
      {phase === "welcome" ? (
        <>
          <div className="relative mt-2">
            <SplitText text="English, from your first word" tag="h1" splitType="words" effect="rise" delay={90} className="display text-[42px]" />
            <SplitText text="to total fluency." tag="p" splitType="words" effect="blur" delay={90} startDelay={0.45} className="display text-[42px] text-accent italic" />
            <p className="ob-fade mt-4 max-w-sm text-[15px] text-muted">
              Seven CEFR levels, one lesson at a time — words, grammar, reading, listening, speaking and writing. And it never runs out.
            </p>
          </div>
          <div className="ob-fade mt-auto pt-6">
            <Button size="lg" block onClick={() => setPhase("choose")}>
              Get started <ArrowRight />
            </Button>
          </div>
        </>
      ) : (
        <div className="relative mt-2 flex flex-1 flex-col">
          <h1 className="ob-fade display text-[34px]">Where should we start?</h1>
          <div className="mt-6 space-y-3">
            <button type="button" onClick={() => void finish("PreA1", [])} className="ob-fade tap focus-ring card flex w-full items-center gap-4 p-5 text-left">
              <div className="grid size-12 place-items-center rounded-2xl bg-success-soft text-success">
                <Sprout />
              </div>
              <div>
                <div className="font-semibold">I'm new to English</div>
                <div className="text-[13px] text-muted">Start at Pre-A1, from hello.</div>
              </div>
            </button>
            <button type="button" onClick={() => { setSection(0); setQ(0); setScores([]); setCorrect(0); setPhase("placement"); }} className="ob-fade tap focus-ring card flex w-full items-center gap-4 p-5 text-left">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
                <Compass />
              </div>
              <div>
                <div className="font-semibold">I know some English</div>
                <div className="text-[13px] text-muted">Take a short placement test (about 3 minutes).</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
