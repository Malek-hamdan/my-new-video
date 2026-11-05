import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowLeft } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { handleBack } from "@/native/back";
import { useNav } from "@/state/nav";

gsap.registerPlugin(useGSAP);

/**
 * Screen container: a plain native-scrolling area (no scroll hijacking) with a
 * GSAP enter transition (transform + opacity only, 60fps-safe).
 */
export function Screen({
  children,
  className,
  title,
  eyebrow,
  back,
  right,
  padBottom = true,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  eyebrow?: string;
  back?: boolean;
  right?: ReactNode;
  padBottom?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const direction = useNav((s) => s.direction);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, x: 18 * direction },
        { autoAlpha: 1, x: 0, duration: 0.34, ease: "power3.out", clearProps: "transform,opacity,visibility" },
      );
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={cn("scroll-area safe-top h-dvh w-full", padBottom && "pb-32", className)}>
      {title || back ? (
        <header className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-2 pb-4">
          {back ? (
            <button
              type="button"
              aria-label="Back"
              onClick={() => handleBack()}
              className="tap focus-ring grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface"
            >
              <ArrowLeft size={20} />
            </button>
          ) : null}
          <div className="min-w-0 flex-1">
            {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
            {title ? <h1 className="display truncate text-[28px]">{title}</h1> : null}
          </div>
          {right}
        </header>
      ) : null}
      <div className="mx-auto w-full max-w-xl px-4">{children}</div>
    </div>
  );
}
