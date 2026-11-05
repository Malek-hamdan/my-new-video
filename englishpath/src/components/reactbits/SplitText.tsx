/*
 * SplitText — port of React Bits' SplitText (github.com/DavidHDev/react-bits, TS-TW variant).
 * Copyright (c) 2026 David Haz. MIT + Commons Clause (use inside an application is permitted).
 *
 * Port notes (based on the real source, not the untouched component):
 * - ScrollTrigger removed: the user brief forbids scroll-linked effects, so the reveal
 *   always runs on mount ("load" trigger). Hover-spring physics removed (touch app).
 * - Same GSAP SplitText plugin, effect presets ("rise", "blur", "pop"), stagger via
 *   gsap.utils.distribute, font-loading guard, reduced-motion → final state.
 */
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { prefersReducedMotion } from "@/lib/utils";

gsap.registerPlugin(GSAPSplitText, useGSAP);

type Effect = "rise" | "blur" | "pop";

const LOOKS: Record<Effect, { from: gsap.TweenVars; to: gsap.TweenVars; ease: string }> = {
  rise: { from: { opacity: 0, yPercent: 60 }, to: { opacity: 1, yPercent: 0 }, ease: "power3.out" },
  blur: { from: { opacity: 0, filter: "blur(8px)", y: 8 }, to: { opacity: 1, filter: "blur(0px)", y: 0 }, ease: "power2.out" },
  pop: { from: { opacity: 0, scale: 0.4 }, to: { opacity: 1, scale: 1 }, ease: "back.out(1.6)" },
};

export interface SplitTextProps {
  text: string;
  className?: string;
  /** Stagger between pieces in ms. */
  delay?: number;
  duration?: number;
  splitType?: "chars" | "words" | "lines";
  effect?: Effect;
  mask?: boolean;
  tag?: "h1" | "h2" | "h3" | "p" | "span";
  textAlign?: CSSProperties["textAlign"];
  startDelay?: number;
  onComplete?: () => void;
}

const fontsLoaded = () => typeof document === "undefined" || !document.fonts || document.fonts.status === "loaded";

export default function SplitText({
  text,
  className = "",
  delay = 40,
  duration = 0.9,
  splitType = "chars",
  effect = "rise",
  mask = true,
  tag = "p",
  textAlign = "left",
  startDelay = 0,
  onComplete,
}: SplitTextProps) {
  const ref = useRef<HTMLElement>(null);
  const done = useRef(onComplete);
  done.current = onComplete;
  const [ready, setReady] = useState(fontsLoaded);

  useEffect(() => {
    if (ready) return;
    let live = true;
    void document.fonts.ready.then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, [ready]);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !ready) return;
      if (prefersReducedMotion()) {
        gsap.set(el, { visibility: "visible" });
        done.current?.();
        return;
      }
      const look = LOOKS[effect];
      const split = new GSAPSplitText(el, {
        type: splitType === "lines" ? "lines" : splitType === "words" ? "words" : "words,chars",
        mask: mask ? (splitType === "chars" ? "words" : splitType) : undefined,
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
      });
      const pieces = splitType === "chars" ? split.chars : splitType === "words" ? split.words : split.lines;
      gsap.set(el, { visibility: "visible" });
      const tl = gsap.timeline({ delay: startDelay, onComplete: () => done.current?.() });
      tl.fromTo(
        pieces,
        { ...look.from, willChange: "transform, opacity" },
        { ...look.to, duration, ease: look.ease, stagger: gsap.utils.distribute({ each: delay / 1000, from: "start" }) },
      ).set(pieces, { clearProps: "willChange,filter" });
      return () => {
        tl.kill();
        split.revert();
      };
    },
    { scope: ref, dependencies: [text, ready, effect, splitType], revertOnUpdate: true },
  );

  const Tag = tag;
  return (
    <Tag ref={ref as never} className={className} style={{ textAlign, visibility: "hidden" }}>
      {text}
    </Tag>
  );
}
