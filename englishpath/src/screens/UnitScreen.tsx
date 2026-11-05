import { Check, ChevronRight, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { LEVEL_LABEL, type UnitOutline } from "@/content";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { NoApiKeyError } from "@/engine/ai/client";
import { indexOfLesson, isUnlocked, pathAt } from "@/engine/progress";
import { cn } from "@/lib/utils";
import { getUnit, learnerContext, peekUnit, useApp } from "@/state/app";
import { useNav } from "@/state/nav";

export function UnitScreen({ unitId }: { unitId: string }) {
  const progress = useApp((s) => s.progress);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const [unit, setUnit] = useState<UnitOutline | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "needs-key" | "error">("loading");
  const [error, setError] = useState("");

  const load = async (generate: boolean) => {
    setState("loading");
    try {
      const u = generate ? await getUnit(unitId, await learnerContext("C2")) : await peekUnit(unitId);
      if (u) {
        setUnit(u);
        setState("ready");
      } else setState("needs-key");
    } catch (e) {
      if (e instanceof NoApiKeyError) setState("needs-key");
      else {
        setError((e as Error).message);
        setState("error");
      }
    }
  };

  useEffect(() => {
    void load(false);
  }, [unitId]);

  const first = indexOfLesson(`${unitId}-l1`);

  return (
    <Screen back eyebrow={unit ? `${LEVEL_LABEL[unit.level]} · Unit ${unit.index}` : "Unit"} title={unit?.title ?? "Mastery unit"}>
      {state === "loading" ? <div className="card h-40 animate-pulse" /> : null}

      {state === "needs-key" || state === "error" ? (
        <div className="card p-5">
          <Sparkles className="text-accent" />
          <h2 className="display mt-3 text-[22px]">This unit is generated for you</h2>
          <p className="mt-2 text-[14px] text-muted">
            {state === "error" ? error : "Endless units are written by Claude at your level. It needs your API key and a connection the first time; after that it's saved for offline use."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void load(true)}>Generate unit</Button>
            <Button variant="secondary" onClick={() => setTab("settings")}>
              Add API key
            </Button>
          </div>
        </div>
      ) : null}

      {unit && state === "ready" ? (
        <>
          <p className="text-[15px] text-fg-2">{unit.canDo}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {unit.grammarFocus.map((g) => (
              <span key={g} className="rounded-full border border-line px-3 py-1 text-[12px] text-muted">
                {g}
              </span>
            ))}
          </div>
          <ol className="mt-6 space-y-3">
            {unit.lessonTitles.map((title, k) => {
              const idx = first + k;
              const id = pathAt(idx).lessonId;
              const lp = progress.lessons[id];
              const open = isUnlocked(progress, idx);
              const status = lp?.passed ? "done" : open ? "open" : "locked";
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={!open}
                    onClick={() => push({ name: "lesson", lessonId: id })}
                    className={cn("tap focus-ring card flex w-full items-center gap-4 p-4 text-left disabled:cursor-not-allowed", !open && "opacity-55")}
                  >
                    <div
                      className={cn(
                        "grid size-11 place-items-center rounded-full border text-[15px] font-semibold",
                        status === "done" ? "border-success/40 bg-success-soft text-success" : status === "open" ? "border-accent/50 bg-accent-soft text-accent" : "border-line text-muted",
                      )}
                    >
                      {status === "done" ? <Check size={18} /> : status === "locked" ? <Lock size={16} /> : k + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{title}</div>
                      <div className="text-[13px] text-muted">
                        {status === "done"
                          ? `Passed · best quiz ${Math.round((lp?.bestQuiz ?? 0) * 100)}%`
                          : status === "open"
                            ? `${lp?.steps.length ?? 0}/7 steps · quiz needs 80%`
                            : "Pass the previous quiz (80%+) to unlock"}
                      </div>
                    </div>
                    {open ? <ChevronRight size={18} className="text-muted" /> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </Screen>
  );
}
