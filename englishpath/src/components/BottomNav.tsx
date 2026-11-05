import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BookOpen, ChartNoAxesColumn, MessagesSquare, RotateCcw, Settings } from "lucide-react";
import { useRef } from "react";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { tap } from "@/native/haptics";
import { useNav, type Tab } from "@/state/nav";

gsap.registerPlugin(useGSAP);

const ITEMS: { tab: Tab; label: string; icon: typeof BookOpen }[] = [
  { tab: "learn", label: "Learn", icon: BookOpen },
  { tab: "dialogues", label: "Dialogues", icon: MessagesSquare },
  { tab: "review", label: "Review", icon: RotateCcw },
  { tab: "progress", label: "Progress", icon: ChartNoAxesColumn },
  { tab: "settings", label: "Settings", icon: Settings },
];

/**
 * Bottom tab bar. Ported from the 21st.dev "Bottom Nav Bar" by arunachalam
 * (pill layout, label reveals on the active tab). Framer Motion was replaced
 * with GSAP; the label reveal animates transform/opacity only (no width tween).
 */
export function BottomNav({ badge }: { badge?: Partial<Record<Tab, number>> }) {
  const { tab, setTab, reset } = useNav();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.fromTo(
        `[data-tab="${tab}"] .nav-label`,
        { autoAlpha: 0, x: -6 },
        { autoAlpha: 1, x: 0, duration: 0.28, ease: "power3.out" },
      );
    },
    { scope: root, dependencies: [tab] },
  );

  return (
    <nav
      ref={root}
      aria-label="Main"
      className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between rounded-full border border-line bg-surface/95 p-1.5 shadow-[0_18px_40px_-16px_rgb(0_0_0/0.55)] backdrop-blur-xl">
        {ITEMS.map(({ tab: t, label, icon: Icon }) => {
          const active = t === tab;
          const count = badge?.[t] ?? 0;
          return (
            <button
              key={t}
              data-tab={t}
              type="button"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                void tap();
                if (active) reset(t);
                else setTab(t);
              }}
              className={cn(
                "tap focus-ring relative flex h-11 min-w-11 items-center justify-center rounded-full px-3",
                active ? "bg-accent-soft text-accent" : "text-muted",
              )}
            >
              <Icon size={21} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
              {active ? <span className="nav-label ml-2 text-[13px] font-semibold">{label}</span> : null}
              {count > 0 && !active ? (
                <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-fg">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
