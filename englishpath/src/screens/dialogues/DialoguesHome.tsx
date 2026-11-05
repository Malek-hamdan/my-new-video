import { Headphones, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BUILTIN_DIALOGUE_LIST, DIALOGUE_TOPICS, LEVELS, LEVEL_LABEL, type Dialogue, type DialogueTopic } from "@/content";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { getStore } from "@/db";
import { NoApiKeyError } from "@/engine/ai/errors";
import { generateDialogue } from "@/engine/ai/generate";
import { currentLevel } from "@/engine/progress";
import { useBackHandler } from "@/hooks/useBack";
import { cn } from "@/lib/utils";
import { learnerContext, useApp } from "@/state/app";
import { useNav } from "@/state/nav";

const TOPIC_EMOJI: Record<DialogueTopic, string> = {
  greetings: "👋",
  shopping: "🛍️",
  restaurant: "🍽️",
  travel: "✈️",
  doctor: "🩺",
  "job interview": "💼",
  workplace: "🏢",
  "phone calls": "📞",
  negotiation: "🤝",
  "small talk": "☕",
};

/** All dialogues available offline: built-in + every generated one saved on the device. */
export async function allDialogues(): Promise<Dialogue[]> {
  const store = await getStore();
  const generated = (await store.listCache("dialogue")).map((r) => JSON.parse(r.json) as Dialogue);
  return [...generated, ...BUILTIN_DIALOGUE_LIST];
}

export function DialoguesHome() {
  const progress = useApp((s) => s.progress);
  const push = useNav((s) => s.push);
  const setTab = useNav((s) => s.setTab);
  const [list, setList] = useState<Dialogue[]>([]);
  const [topic, setTopic] = useState<DialogueTopic | "all">("all");
  const [picked, setPicked] = useState<Dialogue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const level = currentLevel(progress);

  useBackHandler(() => {
    if (!picked) return false;
    setPicked(null);
    return true;
  }, !!picked);

  useEffect(() => {
    void allDialogues().then(setList);
  }, []);

  const shown = useMemo(
    () =>
      list
        .filter((d) => topic === "all" || d.topic === topic)
        .sort((a, b) => Math.abs(LEVELS.indexOf(a.level) - LEVELS.indexOf(level)) - Math.abs(LEVELS.indexOf(b.level) - LEVELS.indexOf(level))),
    [list, topic, level],
  );

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const store = await getStore();
      const t = topic === "all" ? DIALOGUE_TOPICS[Math.floor(Math.random() * DIALOGUE_TOPICS.length)]! : topic;
      const d = await generateDialogue(store, t, await learnerContext());
      setList((l) => [d, ...l]);
      setPicked(d);
    } catch (e) {
      setError(e instanceof NoApiKeyError ? "key" : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <div className="pt-2">
        <div className="eyebrow">Real-life English</div>
        <h1 className="display mt-1 text-[34px]">
          Dialogues <em className="text-accent italic">&amp; role-play</em>
        </h1>
      </div>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {(["all", ...DIALOGUE_TOPICS] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className={cn("tap focus-ring h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium capitalize", topic === t ? "border-accent bg-accent-soft text-accent" : "border-line text-fg-2")}
          >
            {t === "all" ? "All topics" : `${TOPIC_EMOJI[t]} ${t}`}
          </button>
        ))}
      </div>

      <button type="button" disabled={busy} onClick={() => void generate()} className="tap focus-ring card mt-5 flex w-full items-center gap-4 p-4 text-left">
        <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-fg">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}</div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{busy ? "Writing a new dialogue…" : "New dialogue for me"}</div>
          <div className="text-[13px] text-muted">
            {LEVEL_LABEL[level]} · {topic === "all" ? "any topic" : topic} · generated endlessly
          </div>
        </div>
      </button>
      {error ? (
        <div className="mt-3 rounded-2xl border border-line bg-surface-2 p-4 text-[14px]">
          {error === "key" ? (
            <>
              <p>New dialogues are written by Claude. Add your API key to unlock endless dialogues — the {list.length} saved ones work offline.</p>
              <Button size="sm" className="mt-3" onClick={() => setTab("settings")}>
                Add API key
              </Button>
            </>
          ) : (
            error
          )}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {shown.map((d) => (
          <button key={d.id} type="button" onClick={() => setPicked(d)} className="tap focus-ring card flex w-full items-center gap-4 p-4 text-left">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-[24px]" aria-hidden>
              {TOPIC_EMOJI[d.topic]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{d.title}</div>
              <div className="line-clamp-1 text-[13px] text-muted">{d.setting}</div>
            </div>
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", d.level === level ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted")}>{LEVEL_LABEL[d.level]}</span>
          </button>
        ))}
      </div>

      <Sheet open={!!picked} onOpenChange={(o) => !o && setPicked(null)} title={picked?.title ?? ""} description={picked?.setting}>
        {picked ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                push({ name: "dialogue", dialogueId: picked.id, mode: "listen" });
              }}
              className="tap focus-ring flex w-full items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4 text-left"
            >
              <Headphones className="text-accent" />
              <div>
                <div className="font-semibold">Listen &amp; learn</div>
                <div className="text-[13px] text-muted">Hear the conversation line by line, with key phrases.</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setPicked(null);
                push({ name: "dialogue", dialogueId: picked.id, mode: "roleplay" });
              }}
              className="tap focus-ring flex w-full items-center gap-4 rounded-2xl border border-line bg-surface-2 p-4 text-left"
            >
              <MessageCircle className="text-accent" />
              <div>
                <div className="font-semibold">Role-play</div>
                <div className="text-[13px] text-muted">You are “{picked.roles.B}”. Speak or type; every turn is corrected.</div>
              </div>
            </button>
          </div>
        ) : null}
      </Sheet>
    </Screen>
  );
}
