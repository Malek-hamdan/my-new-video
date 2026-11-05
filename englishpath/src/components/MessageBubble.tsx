import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Chat bubble. Ported from the 21st.dev "Message Bubble" by framecn
 * (incoming/outgoing variants, bottom-anchored transform origin, reaction badge).
 * Inline theme objects were replaced with EnglishPath tokens; the rise-in is
 * driven by GSAP from the parent (DialogueScreen) instead of a state prop.
 */
export function MessageBubble({
  variant,
  children,
  name,
  reaction,
  active,
  className,
}: {
  variant: "incoming" | "outgoing";
  children: ReactNode;
  name?: string;
  reaction?: string;
  active?: boolean;
  className?: string;
}) {
  const out = variant === "outgoing";
  return (
    <div className={cn("bubble flex w-full", out ? "justify-end" : "justify-start", className)} style={{ transformOrigin: out ? "bottom right" : "bottom left" }}>
      <div className="relative max-w-[82%] min-w-0">
        {name ? <div className={cn("mb-1 px-1 text-[11px] font-semibold tracking-wide text-muted", out && "text-right")}>{name}</div> : null}
        <div
          className={cn(
            "inline-block max-w-full rounded-[22px] px-4 py-2.5 text-[15px] leading-[1.55] break-words transition-shadow",
            out ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md border border-line bg-surface-2 text-fg",
            active && "ring-2 ring-accent/70",
          )}
        >
          {children}
        </div>
        {reaction ? (
          <div
            className={cn(
              "absolute -bottom-3 flex min-w-6 items-center justify-center rounded-full bg-surface-2 px-1.5 py-0.5 text-[13px] shadow-[0_0_0_3px_var(--bg)]",
              out ? "right-3" : "left-3",
            )}
          >
            {reaction}
          </div>
        ) : null}
      </div>
    </div>
  );
}
