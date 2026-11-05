import { Capacitor } from "@capacitor/core";
import { Bell, ChevronRight, Eye, EyeOff, KeyRound, Loader2, Moon, ShieldCheck, Trash2, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { getStore } from "@/db";
import { resetClient, testKey } from "@/engine/ai/client";
import { initialProgress, type Settings } from "@/engine/progress";
import { useBackHandler } from "@/hooks/useBack";
import { cn } from "@/lib/utils";
import { scheduleDailyReminder } from "@/native/notifications";
import { clearApiKey, getApiKey, maskKey, setApiKey } from "@/native/secrets";
import { speak } from "@/native/tts";
import { useApp } from "@/state/app";
import { useNav } from "@/state/nav";

const MODELS: { id: Settings["model"]; name: string; note: string }[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "Best quality (default) · $4 / $20 per M tokens" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "Faster, cheaper · $2 / $10 per M tokens" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "Fastest, cheapest · $0.10 / $0.50 per M tokens" },
];

export function SettingsScreen() {
  const progress = useApp((s) => s.progress);
  const update = useApp((s) => s.update);
  const push = useNav((s) => s.push);
  const s = progress.settings;
  const set = (patch: Partial<Settings>) => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }));

  const [key, setKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState(false);
  const [keyMsg, setKeyMsg] = useState<{ tone: "ok" | "err" | "info"; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useBackHandler(() => {
    if (!resetOpen) return false;
    setResetOpen(false);
    return true;
  }, resetOpen);

  useEffect(() => {
    void getApiKey().then(setKey);
  }, []);

  const saveKey = async () => {
    try {
      await setApiKey(draft);
      resetClient();
      setKey(draft.trim());
      setDraft("");
      setKeyMsg({ tone: "ok", text: Capacitor.isNativePlatform() ? "Saved in Android secure storage (Keystore)." : "Saved for this browser session only (never written to disk)." });
    } catch (e) {
      setKeyMsg({ tone: "err", text: (e as Error).message });
    }
  };

  const runTest = async () => {
    setTesting(true);
    setKeyMsg(null);
    try {
      await testKey(s.model);
      setKeyMsg({ tone: "ok", text: `Connected to ${MODELS.find((m) => m.id === s.model)?.name}.` });
    } catch (e) {
      setKeyMsg({ tone: "err", text: `Key test failed: ${(e as Error).message.slice(0, 160)}` });
    } finally {
      setTesting(false);
    }
  };

  const setReminder = async (enabled: boolean, hour = s.reminder.hour, minute = s.reminder.minute) => {
    const res = await scheduleDailyReminder(enabled, hour, minute);
    if (res === "denied") {
      setReminderMsg("Notifications are blocked. Allow them for EnglishPath in Android settings.");
      await set({ reminder: { enabled: false, hour, minute } });
      return;
    }
    setReminderMsg(res === "unsupported" ? "Reminders work in the Android app (not in the browser preview)." : enabled ? `Reminder set for ${fmtTime(hour, minute)} every day.` : null);
    await set({ reminder: { enabled, hour, minute } });
  };

  return (
    <Screen>
      <div className="pt-2">
        <div className="eyebrow">Preferences</div>
        <h1 className="display mt-1 text-[34px]">Settings</h1>
      </div>

      {/* Claude API key */}
      <Section title="AI engine" icon={<KeyRound size={18} />}>
        <p className="text-[14px] text-muted">
          Endless lessons, new dialogues, AI role-play and writing correction use Claude with <strong className="text-fg">your own API key</strong>. Built-in lessons, saved content, review and practice work without it.
        </p>
        {key ? (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-2 p-3.5">
            <div className="flex items-center gap-2 text-[14px]">
              <ShieldCheck size={18} className="text-success" />
              <span className="font-mono">{maskKey(key)}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void clearApiKey().then(() => {
                  resetClient();
                  setKey(null);
                  setKeyMsg({ tone: "info", text: "Key removed from this device." });
                })
              }
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="api-key" className="text-[13px] font-medium">
              Claude API key
            </label>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <input
                  id="api-key"
                  type={reveal ? "text" : "password"}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="sk-ant-…"
                  className="focus-ring h-12 w-full rounded-2xl border border-line bg-surface-2 pr-11 pl-4 font-mono text-[14px] outline-none focus:border-accent"
                />
                <button type="button" aria-label={reveal ? "Hide key" : "Show key"} onClick={() => setReveal((r) => !r)} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center text-muted">
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <Button size="lg" disabled={!draft.trim()} onClick={() => void saveKey()}>
                Save
              </Button>
            </div>
            <p className="mt-2 text-[12px] text-muted">Get a key at console.anthropic.com → API keys. It's stored encrypted on this phone and only sent to api.anthropic.com.</p>
          </div>
        )}
        <div className="mt-5 text-[13px] font-medium">Model</div>
        <div className="mt-2 space-y-2" role="radiogroup" aria-label="Claude model">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={s.model === m.id}
              onClick={() => void set({ model: m.id })}
              className={cn("tap focus-ring flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left", s.model === m.id ? "border-accent bg-accent-soft" : "border-line")}
            >
              <span className={cn("size-4 shrink-0 rounded-full border-2", s.model === m.id ? "border-accent bg-accent" : "border-line-strong")} />
              <span>
                <span className="block text-[14px] font-semibold">{m.name}</span>
                <span className="block text-[12px] text-muted">{m.note}</span>
              </span>
            </button>
          ))}
        </div>
        {key ? (
          <Button className="mt-3" variant="secondary" disabled={testing} onClick={() => void runTest()}>
            {testing ? <Loader2 className="animate-spin" /> : null} Test connection
          </Button>
        ) : null}
        {keyMsg ? <p className={cn("mt-3 text-[13px]", keyMsg.tone === "ok" ? "text-success" : keyMsg.tone === "err" ? "text-danger" : "text-muted")}>{keyMsg.text}</p> : null}
      </Section>

      {/* Reminder */}
      <Section title="Daily reminder" icon={<Bell size={18} />}>
        <Row label="Remind me to practise">
          <Switch checked={s.reminder.enabled} onCheckedChange={(v) => void setReminder(v)} aria-label="Daily reminder" />
        </Row>
        {s.reminder.enabled ? (
          <Row label="Time">
            <input
              type="time"
              aria-label="Reminder time"
              value={fmtTime(s.reminder.hour, s.reminder.minute)}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                void setReminder(true, h ?? 19, m ?? 0);
              }}
              className="focus-ring h-10 rounded-xl border border-line bg-surface-2 px-3 tabular-nums"
            />
          </Row>
        ) : null}
        {reminderMsg ? <p className="mt-2 text-[13px] text-muted">{reminderMsg}</p> : null}
      </Section>

      {/* Appearance & sound */}
      <Section title="Look & feel" icon={<Moon size={18} />}>
        <div className="text-[13px] font-medium">Theme</div>
        <Segmented
          value={s.theme}
          options={[
            ["system", "System"],
            ["dark", "Dark"],
            ["light", "Light"],
          ]}
          onChange={(v) => void set({ theme: v as Settings["theme"] })}
        />
        <div className="mt-4 text-[13px] font-medium">Motion</div>
        <Segmented
          value={s.reducedMotion}
          options={[
            ["system", "System"],
            ["off", "Full"],
            ["on", "Reduced"],
          ]}
          onChange={(v) => void set({ reducedMotion: v as Settings["reducedMotion"] })}
        />
        <Row label="Haptic feedback">
          <Switch checked={s.haptics} onCheckedChange={(v) => void set({ haptics: v })} aria-label="Haptic feedback" />
        </Row>
      </Section>

      <Section title="Voice" icon={<Volume2 size={18} />}>
        <div className="flex items-center justify-between text-[13px]">
          <label htmlFor="rate" className="font-medium">
            Speaking speed
          </label>
          <span className="text-muted tabular-nums">{s.voiceRate.toFixed(2)}×</span>
        </div>
        <input
          id="rate"
          type="range"
          min={0.6}
          max={1.2}
          step={0.05}
          value={s.voiceRate}
          onChange={(e) => void set({ voiceRate: Number(e.target.value) })}
          className="mt-3 w-full accent-[var(--accent)]"
        />
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void speak("Hello! This is how I will read your lessons.")}>
          <Volume2 /> Test voice
        </Button>
      </Section>

      <div className="mt-3 space-y-3">
        <button type="button" onClick={() => push({ name: "about" })} className="tap focus-ring card flex w-full items-center justify-between p-5 text-left">
          <span className="font-semibold">About &amp; open-source licences</span>
          <ChevronRight size={18} className="text-muted" />
        </button>
        <button type="button" onClick={() => setResetOpen(true)} className="tap focus-ring card flex w-full items-center gap-3 p-5 text-left text-danger">
          <Trash2 size={18} /> <span className="font-semibold">Reset all progress</span>
        </button>
      </div>

      <Sheet open={resetOpen} onOpenChange={setResetOpen} title="Reset all progress?" description="This deletes your lessons, XP, streak, review deck and saved AI content on this device. Your API key is kept. This can't be undone.">
        <div className="flex flex-col gap-3">
          <Button
            variant="danger"
            size="lg"
            onClick={() =>
              void (async () => {
                const store = await getStore();
                await store.wipe();
                const settings = useApp.getState().progress.settings;
                await update(() => ({ ...initialProgress(), settings }));
                await useApp.getState().refreshCounts();
                setResetOpen(false);
              })()
            }
          >
            Delete everything
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setResetOpen(false)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}

const fmtTime = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card mt-5 p-5" aria-label={title}>
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 flex min-h-11 items-center justify-between gap-4">
      <span className="text-[14px]">{label}</span>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="mt-2 grid grid-flow-col gap-1 rounded-full border border-line bg-surface-2 p-1" role="radiogroup">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn("tap focus-ring h-9 rounded-full text-[13px] font-medium", value === v ? "bg-accent text-accent-fg" : "text-fg-2")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const LICENCES: [string, string][] = [
  ["ts-fsrs (spaced repetition)", "MIT"],
  ["ipa-dict en_US (IPA, from CMUdict)", "MIT / BSD-2"],
  ["Capacitor & plugins", "MIT"],
  ["@capacitor-community sqlite, text-to-speech, speech-recognition", "MIT"],
  ["@aparajita/capacitor-secure-storage", "MIT"],
  ["React, Vite, Tailwind CSS, Zustand, Radix UI, shadcn/ui patterns", "MIT"],
  ["Zod", "MIT"],
  ["Anthropic TypeScript SDK", "Apache-2.0"],
  ["GSAP + SplitText", "GSAP Standard No-Charge License"],
  ["React Bits — SoftAurora, SplitText (port)", "MIT + Commons Clause"],
  ["three.js", "MIT"],
  ["lucide icons", "ISC"],
  ["Inter, Fraunces fonts", "SIL OFL 1.1"],
];

export function AboutScreen() {
  return (
    <Screen back eyebrow="Settings" title="About">
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <img src="/icon.svg" alt="" width={56} height={56} className="rounded-2xl" />
          <div>
            <div className="display text-[24px]">EnglishPath</div>
            <div className="text-[13px] text-muted">Version 1.0.0 · Pre-A1 → C2, then endless</div>
          </div>
        </div>
        <p className="mt-4 text-[14px] text-fg-2">
          All lessons, dialogues and the curriculum are original. Generated content is created by Claude from your own API key and stored only on this device.
        </p>
      </div>
      <h2 className="eyebrow mt-6">Open-source licences</h2>
      <ul className="card mt-2 divide-y divide-line">
        {LICENCES.map(([n, l]) => (
          <li key={n} className="flex items-center justify-between gap-4 px-5 py-3 text-[14px]">
            <span>{n}</span>
            <span className="shrink-0 text-[12px] text-muted">{l}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted">Full list with sources: ATTRIBUTIONS.md in the project repository.</p>
    </Screen>
  );
}
