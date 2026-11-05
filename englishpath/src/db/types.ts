/** Row stored for every spaced-repetition item (word or grammar point). */
export interface SrsRow {
  id: string;
  kind: "word" | "grammar";
  /** Lesson the item came from. */
  ref: string;
  front: string;
  back: string;
  /** Extra JSON payload (example sentence, emoji, ipa…). */
  data: Record<string, unknown>;
  /** Due time in epoch ms (denormalised from the FSRS card for fast queries). */
  due: number;
  /** Serialised ts-fsrs card. */
  card: Record<string, unknown>;
}

export interface Attempt {
  ts: number;
  skill: string;
  correct: number;
  total: number;
  /** Optional tag: grammar id, word id, topic — used for weak points. */
  tag?: string;
}

export interface CacheRow {
  kind: string;
  key: string;
  level: string;
  json: string;
  created: number;
}

export interface Store {
  readonly backend: "sqlite" | "web";
  init(): Promise<void>;
  getKV<T>(key: string): Promise<T | null>;
  setKV(key: string, value: unknown): Promise<void>;
  upsertCard(row: SrsRow): Promise<void>;
  getCard(id: string): Promise<SrsRow | null>;
  dueCards(now: number, limit: number): Promise<SrsRow[]>;
  countCards(): Promise<{ total: number; due: number }>;
  allCards(): Promise<SrsRow[]>;
  putCache(row: CacheRow): Promise<void>;
  getCache(kind: string, key: string): Promise<CacheRow | null>;
  listCache(kind: string, level?: string): Promise<CacheRow[]>;
  addAttempt(a: Attempt): Promise<void>;
  attemptsSince(ts: number): Promise<Attempt[]>;
  wipe(): Promise<void>;
}
