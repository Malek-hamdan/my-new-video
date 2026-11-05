import type { Attempt, CacheRow, SrsRow, Store } from "./types";

const LS_KEY = "englishpath.webdb.v1";

interface Snapshot {
  kv: Record<string, unknown>;
  srs: Record<string, SrsRow>;
  cache: Record<string, CacheRow>;
  attempts: Attempt[];
}

const empty = (): Snapshot => ({ kv: {}, srs: {}, cache: {}, attempts: [] });

/**
 * Browser fallback used for `npm run dev`, Playwright previews and unit tests.
 * On Android the SQLite store is always used. Never holds the API key.
 */
export class WebStore implements Store {
  readonly backend = "web" as const;
  private s: Snapshot = empty();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private persist = true) {}

  async init() {
    if (!this.persist) return;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) this.s = { ...empty(), ...(JSON.parse(raw) as Snapshot) };
    } catch {
      this.s = empty();
    }
  }

  private save() {
    if (!this.persist) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.s));
      } catch {
        /* storage full or blocked: keep in memory */
      }
    }, 120);
  }

  async getKV<T>(key: string) {
    return (key in this.s.kv ? (structuredClone(this.s.kv[key]) as T) : null);
  }
  async setKV(key: string, value: unknown) {
    this.s.kv[key] = structuredClone(value);
    this.save();
  }
  async upsertCard(row: SrsRow) {
    this.s.srs[row.id] = structuredClone(row);
    this.save();
  }
  async getCard(id: string) {
    const r = this.s.srs[id];
    return r ? structuredClone(r) : null;
  }
  async dueCards(now: number, limit: number) {
    return Object.values(this.s.srs)
      .filter((r) => r.due <= now)
      .sort((a, b) => a.due - b.due)
      .slice(0, limit)
      .map((r) => structuredClone(r));
  }
  async countCards() {
    const all = Object.values(this.s.srs);
    return { total: all.length, due: all.filter((r) => r.due <= Date.now()).length };
  }
  async allCards() {
    return Object.values(this.s.srs).map((r) => structuredClone(r));
  }
  async putCache(row: CacheRow) {
    this.s.cache[`${row.kind}:${row.key}`] = { ...row };
    this.save();
  }
  async getCache(kind: string, key: string) {
    const r = this.s.cache[`${kind}:${key}`];
    return r ? { ...r } : null;
  }
  async listCache(kind: string, level?: string) {
    return Object.values(this.s.cache)
      .filter((r) => r.kind === kind && (!level || r.level === level))
      .sort((a, b) => b.created - a.created);
  }
  async addAttempt(a: Attempt) {
    this.s.attempts.push({ ...a });
    if (this.s.attempts.length > 5000) this.s.attempts.splice(0, this.s.attempts.length - 5000);
    this.save();
  }
  async attemptsSince(ts: number) {
    return this.s.attempts.filter((a) => a.ts >= ts).map((a) => ({ ...a }));
  }
  async wipe() {
    this.s = empty();
    this.save();
  }
}
