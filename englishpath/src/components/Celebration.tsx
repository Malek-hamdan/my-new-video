import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { useBackHandler } from "@/hooks/useBack";
import { prefersReducedMotion } from "@/lib/utils";
import { useApp } from "@/state/app";
import SoftAurora from "./reactbits/SoftAurora";
import SplitText from "./reactbits/SplitText";
import { Button } from "./ui/button";

gsap.registerPlugin(useGSAP);

/**
 * Level-up / achievement screen. Signature: React Bits SoftAurora background
 * (recoloured to brand navy + saffron) and SplitText headline. Reduced motion:
 * a still gradient and the final text state.
 */
export function CelebrationOverlay() {
  const current = useApp((s) => s.celebrations[0]);
  const dismiss = useApp((s) => s.dismissCelebration);
  const root = useRef<HTMLDivElement>(null);
  useBackHandler(() => {
    dismiss();
    return true;
  }, !!current);

  useGSAP(
    () => {
      if (!current || prefersReducedMotion()) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.fromTo(root.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })
        .fromTo(".cel-emoji", { scale: 0.2, rotation: -25, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.8, ease: "back.out(2.2)" }, 0.1)
        .fromTo(".cel-detail, .cel-cta", { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.12 }, 0.7);
    },
    { scope: root, dependencies: [current?.title] },
  );

  if (!current) return null;
  const reduced = prefersReducedMotion();
  return (
    <div ref={root} className="fixed inset-0 z-[60] bg-[#050816]" role="dialog" aria-modal="true" aria-label={current.title}>
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,rgb(253_182_28/0.28),transparent_60%),radial-gradient(90%_60%_at_50%_0%,rgb(2_27_81/0.9),transparent_70%)]" />
      {!reduced ? (
        <SoftAurora className="absolute inset-0 opacity-90" color1="#fdb61c" color2="#1f4fd1" brightness={0.9} speed={0.5} enableMouseInteraction={false} />
      ) : null}
      <div className="safe-top safe-bottom relative flex h-full flex-col items-center justify-center px-8 text-center text-[#f4f1ea]">
        <div className="cel-emoji text-[84px] leading-none" aria-hidden>
          {current.emoji}
        </div>
        <div className="eyebrow mt-6 !text-[#f4f1ea]/70">{current.kind === "level" ? "Level up" : "Achievement unlocked"}</div>
        <SplitText key={current.title} text={current.title} tag="h2" className="display mt-3 text-[40px]" textAlign="center" splitType="chars" effect="rise" delay={28} startDelay={0.2} />
        <p className="cel-detail mt-4 max-w-xs text-[15px] text-[#f4f1ea]/75">{current.detail}</p>
        <div className="cel-cta mt-10 w-full max-w-xs">
          <Button block size="lg" onClick={dismiss}>
            Keep going
          </Button>
        </div>
      </div>
    </div>
  );
}
