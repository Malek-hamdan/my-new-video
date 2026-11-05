import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from "@capacitor-community/sqlite";
import type { Attempt, CacheRow, SrsRow, Store } from "./types";
import { CREATE_SQL, DB_NAME, DB_VERSION } from "./schema.sql";

type Row = Record<string, unknown>;

const toSrs = (r: Row): SrsRow => ({
  id: String(r.id),
  kind: r.kind === "grammar" ? "grammar" : "word",
  ref: String(r.ref),
  front: String(r.front),
  back: String(r.back),
  data: JSON.parse(String(r.data)) as Record<string, unknown>,
  due: Number(r.due),
  card: JSON.parse(String(r.card)) as Record<string, unknown>,
});

const toCache = (r: Row): CacheRow => ({
  kind: String(r.kind),
  key: String(r.key),
  level: String(r.level),
  json: String(r.json),
  created: Number(r.created),
});

/** Native SQLite store (Android) via @capacitor-community/sqlite. */
export class SqliteStore implements Store {
  readonly backend = "sqlite" as const;
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;

  async init() {
    const consistent = (await this.sqlite.checkConnectionsConsistency()).result;
    const exists = (await this.sqlite.isConnection(DB_NAME, false)).result;
    this.db =
      consistent && exists
        ? await this.sqlite.retrieveConnection(DB_NAME, false)
        : await this.sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
    await this.db.open();
    await this.db.execute(CREATE_SQL);
  }

  private get conn(): SQLiteDBConnection {
    if (!this.db) throw new Error("Database not initialised");
    return this.db;
  }

  private async rows(sql: string, values: unknown[] = []): Promise<Row[]> {
    const res = await this.conn.query(sql, values);
    return (res.values ?? []) as Row[];
  }

  async getKV<T>(key: string) {
    const [r] = await this.rows("SELECT value FROM kv WHERE key = ?", [key]);
    return r ? (JSON.parse(String(r.value)) as T) : null;
  }

  async setKV(key: string, value: unknown) {
    await this.conn.run("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
  }

  async upsertCard(row: SrsRow) {
    await this.conn.run(
      "INSERT OR REPLACE INTO srs (id, kind, ref, front, back, data, due, card) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [row.id, row.kind, row.ref, row.front, row.back, JSON.stringify(row.data), row.due, JSON.stringify(row.card)],
    );
  }

  async getCard(id: string) {
    const [r] = await this.rows("SELECT * FROM srs WHERE id = ?", [id]);
    return r ? toSrs(r) : null;
  }

  async dueCards(now: number, limit: number) {
    return (await this.rows("SELECT * FROM srs WHERE due <= ? ORDER BY due ASC LIMIT ?", [now, limit])).map(toSrs);
  }

  async countCards() {
    const [t] = await this.rows("SELECT COUNT(*) AS n FROM srs");
    const [d] = await this.rows("SELECT COUNT(*) AS n FROM srs WHERE due <= ?", [Date.now()]);
    return { total: Number(t?.n ?? 0), due: Number(d?.n ?? 0) };
  }

  async allCards() {
    return (await this.rows("SELECT * FROM srs")).map(toSrs);
  }

  async putCache(row: CacheRow) {
    await this.conn.run(
      "INSERT OR REPLACE INTO content_cache (kind, key, level, json, created) VALUES (?, ?, ?, ?, ?)",
      [row.kind, row.key, row.level, row.json, row.created],
    );
  }

  async getCache(kind: string, key: string) {
    const [r] = await this.rows("SELECT * FROM content_cache WHERE kind = ? AND key = ?", [kind, key]);
    return r ? toCache(r) : null;
  }

  async listCache(kind: string, level?: string) {
    const rows = level
      ? await this.rows("SELECT * FROM content_cache WHERE kind = ? AND level = ? ORDER BY created DESC", [kind, level])
      : await this.rows("SELECT * FROM content_cache WHERE kind = ? ORDER BY created DESC", [kind]);
    return rows.map(toCache);
  }

  async addAttempt(a: Attempt) {
    await this.conn.run("INSERT INTO attempts (ts, skill, correct, total, tag) VALUES (?, ?, ?, ?, ?)", [
      a.ts, a.skill, a.correct, a.total, a.tag ?? null,
    ]);
  }

  async attemptsSince(ts: number) {
    return (await this.rows("SELECT ts, skill, correct, total, tag FROM attempts WHERE ts >= ? ORDER BY ts ASC", [ts])).map(
      (r) => ({
        ts: Number(r.ts),
        skill: String(r.skill),
        correct: Number(r.correct),
        total: Number(r.total),
        ...(r.tag ? { tag: String(r.tag) } : {}),
      }),
    );
  }

  async wipe() {
    await this.conn.execute("DELETE FROM kv; DELETE FROM srs; DELETE FROM content_cache; DELETE FROM attempts;");
  }
}
