export const DB_NAME = "englishpath";
export const DB_VERSION = 1;

export const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS srs (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  data TEXT NOT NULL,
  due INTEGER NOT NULL,
  card TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_srs_due ON srs(due);
CREATE TABLE IF NOT EXISTS content_cache (
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  level TEXT NOT NULL,
  json TEXT NOT NULL,
  created INTEGER NOT NULL,
  PRIMARY KEY (kind, key)
);
CREATE INDEX IF NOT EXISTS idx_cache_kind_level ON content_cache(kind, level);
CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  skill TEXT NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  tag TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_ts ON attempts(ts);
`;
