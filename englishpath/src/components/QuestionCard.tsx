import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Check, Volume2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Question } from "@/content/schema";
import { correctText, isCorrect, orderTiles, type Answer } from "@/engine/quiz";
import { cn, prefersReducedMotion } from "@/lib/utils";
import { tap } from "@/native/haptics";
import { speak } from "@/native/tts";
import { Rich } from "./Rich";
import { Button } from "./ui/button";

gsap.registerPlugin(useGSAP);

/**
 * One question (multiple choice, gap fill or word order) with check → feedback.
 * Feedback motion is GSAP on transform/opacity only: a soft pop for correct,
 * a short horizontal shake for wrong. Reduced motion shows the state instantly.
 */
export function QuestionCard({
  q,
  onAnswered,
  continueLabel = "Continue",
  index,
  total,
}: {
  q: Question;
  onAnswered: (correct: boolean, answer: Answer) => void;
  continueLabel?: string;
  index?: number;
  total?: number;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState<null | boolean>(null);
  const tiles = useMemo(() => (q.type === "order" ? orderTiles(q) : []), [q]);

  const answer: Answer | undefined =
    q.type === "mc" ? (choice ?? undefined) : q.type === "cloze" ? text : picked.map((i) => tiles[i]).join(" ");
  const ready = q.type === "mc" ? choice !== null : q.type === "cloze" ? text.trim().length > 0 : picked.length === tiles.length;

  // Runs after React has rendered the feedback panel (it doesn't exist before `checked` is set).
  useGSAP(
    () => {
      if (checked === null || prefersReducedMotion()) return;
      if (checked) gsap.fromTo(".q-body", { scale: 0.985 }, { scale: 1, duration: 0.5, ease: "back.out(3)" });
      else gsap.fromTo(".q-body", { x: -10 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.3)" });
      gsap.fromTo(".q-feedback", { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: "power3.out" });
    },
    { scope: root, dependencies: [checked] },
  );

  const check = () => {
    if (!ready || answer === undefined) return;
    const ok = isCorrect(q, answer);
    setChecked(ok);
    void tap(ok ? "success" : "error");
  };

  const prompt = q.type === "order" ? q.prompt ?? "Put the words in the right order." : q.prompt;
  const isListening = prompt.startsWith("🎧");

  return (
    <div ref={root} className="flex min-h-full flex-col">
      {index !== undefined && total ? <div className="eyebrow mb-3 tabular-nums">Question {index + 1} of {total}</div> : null}
      <div className="q-body">
        <h3 className="text-[19px] leading-snug font-semibold">
          {q.type === "cloze" ? <ClozePrompt prompt={prompt} value={checked === null ? text : text || "…"} /> : <Rich text={prompt} />}
        </h3>

        {q.type === "mc" ? (
          <div className="mt-5 grid gap-2.5" role="radiogroup">
            {q.options.map((o, i) => {
              const isAnswer = checked !== null && i === q.answer;
              const isWrongPick = checked === false && i === choice;
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={choice === i}
                  disabled={checked !== null}
                  onClick={() => {
                    setChoice(i);
                    void tap();
                  }}
                  className={cn(
                    "tap focus-ring flex min-h-[52px] items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15px]",
                    choice === i && checked === null ? "border-accent bg-accent-soft" : "border-line bg-surface",
                    isAnswer && "border-success bg-success-soft",
                    isWrongPick && "border-danger bg-danger-soft",
                  )}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-line text-[12px] font-semibold text-muted">
                    {isAnswer ? <Check size={14} className="text-success" /> : isWrongPick ? <X size={14} className="text-danger" /> : String.fromCharCode(65 + i)}
                  </span>
                  <span>{o}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {q.type === "cloze" ? (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            disabled={checked !== null}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Your answer"
            placeholder="Type the missing word"
            className={cn(
              "focus-ring mt-5 h-14 w-full rounded-2xl border bg-surface px-4 text-[17px] outline-none",
              checked === null ? "border-line focus:border-accent" : checked ? "border-success" : "border-danger",
            )}
          />
        ) : null}

        {q.type === "order" ? (
          <div className="mt-5">
            <div className="flex min-h-[64px] flex-wrap content-start gap-2 rounded-2xl border border-dashed border-line-strong p-3">
              {picked.map((ti, k) => (
                <button
                  key={`${ti}-${k}`}
                  type="button"
                  disabled={checked !== null}
                  onClick={() => setPicked((p) => p.filter((_, j) => j !== k))}
                  className="tap rounded-xl bg-accent px-3 py-2 text-[15px] font-medium text-accent-fg"
                >
                  {tiles[ti]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {tiles.map((t, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={picked.includes(i) || checked !== null}
                  onClick={() => {
                    setPicked((p) => [...p, i]);
                    void tap();
                  }}
                  className="tap rounded-xl border border-line bg-surface px-3 py-2 text-[15px] disabled:opacity-25"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-auto pt-6">
        {checked !== null ? (
          <div
            className={cn("q-feedback mb-3 rounded-2xl border p-4", checked ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft")}
            role="status"
            aria-live="polite"
          >
            <div className={cn("flex items-center gap-2 font-semibold", checked ? "text-success" : "text-danger")}>
              {checked ? <Check size={18} /> : <X size={18} />} {checked ? "Correct!" : "Not quite"}
            </div>
            {!checked ? (
              <div className="mt-1 text-[14px]">
                Correct answer: <strong>{correctText(q)}</strong>
                <button type="button" aria-label="Listen" onClick={() => void speak(correctText(q))} className="ml-2 inline-grid size-7 place-items-center rounded-full align-middle text-muted">
                  <Volume2 size={15} />
                </button>
              </div>
            ) : null}
            {q.explanation ? <p className="mt-1 text-[13px] text-fg-2">{q.explanation}</p> : null}
          </div>
        ) : null}
        {checked === null ? (
          <Button block size="lg" disabled={!ready} onClick={check}>
            Check
          </Button>
        ) : (
          <Button block size="lg" variant={checked ? "success" : "primary"} onClick={() => onAnswered(checked, answer!)}>
            {continueLabel}
          </Button>
        )}
        {isListening ? <p className="mt-2 text-center text-[12px] text-muted">Based on the listening from this lesson.</p> : null}
      </div>
    </div>
  );
}

function ClozePrompt({ prompt, value }: { prompt: string; value: string }) {
  const [a, b] = prompt.split("___");
  return (
    <>
      {a}
      <span className="mx-1 inline-block min-w-16 border-b-2 border-accent px-1 text-center text-accent">{value || " "}</span>
      {b}
    </>
  );
}
