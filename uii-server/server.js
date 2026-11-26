"use strict";
// UII Parts server: serves the page, keeps the data, checks sign-in.
// No packages needed: Node's own http, crypto and fs.
//   PORT  (default 3000, listens on 127.0.0.1 only; Caddy sits in front with HTTPS)
//   DATA  (default ./data) folder for the collections, accounts and sessions
// Make or reset an admin from the shell:  uii-admin   (stops the service, runs "server.js make-admin" as the uii user, starts it again)
const http = require("http"), crypto = require("crypto"), fs = require("fs"), path = require("path");

const PORT = +process.env.PORT || 3000;
const DATA = path.resolve(process.env.DATA || path.join(__dirname, "data"));
const PAGE = path.join(__dirname, "public", "index.html");
const ASSETS = { "/manifest.webmanifest": "application/manifest+json", "/icon-192.png": "image/png", "/icon-512.png": "image/png",
  "/icon-maskable-512.png": "image/png", "/apple-touch-icon.png": "image/png", "/favicon-32.png": "image/png", "/favicon.ico": "image/png" };
const DAYS = 90, COOKIE = "uiis", MAX_BODY = 1024 * 1024, MAX_LOGIN_BODY = 2048;
const COLL_RE = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/, ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;
// names that mean something special to JavaScript objects: never an id, a username or a field name
const RESERVED = new Set(["__proto__", "constructor", "prototype"]);
// what a permission lets a person write

fs.mkdirSync(path.join(DATA, "c"), { recursive: true });

// ---------- storage ----------
// Every change is first added to a log file on disk (journal.log, fsync) and only then answered "saved".
// Within 10 seconds (sooner if the log passes 2 MB) the changed collections are written whole: one JSON
// file each, written to a temp file and swapped in; the file it replaces is kept as <name>.json.prev.
// The log is emptied only when every changed collection is written. After a crash it is played again.
// A file that cannot be read is never treated as empty: the previous copy is used, or that collection is
// CLOSED (reads and writes answer "unavailable") until it is restored and the service restarted.
// manifest.json lists the collections that exist, so a missing file is noticed instead of starting empty.
// Only one process may use the data folder at a time (lock file): the server, or uii-admin.
const CDIR = path.join(DATA, "c"), JOURNAL = path.join(DATA, "journal.log"), MANIFEST = path.join(DATA, "manifest.json"), LOCK = path.join(DATA, "lock");
const COLL_FILE_RE = /^_?[A-Za-z][A-Za-z0-9_-]{0,40}$/;
const colls = new Map(), dirty = new Set(), broken = new Set();
let compactTimer = null, jfd = null, jsize = 0, jwarned = false, known = null, locked = false;
function writeAll(fd, buf) {
  let off = 0;
  while (off < buf.length) off += fs.writeSync(fd, buf, off, buf.length - off);
}
function syncDir(dir) { const d = fs.openSync(dir, "r"); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } }
function writeFileDurable(file, text) {
  const tmp = file + ".tmp", fd = fs.openSync(tmp, "w");
  try { writeAll(fd, Buffer.from(text)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  syncDir(path.dirname(file));
}
function readObj(file) {
  const o = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("not a JSON object");
  return o;
}
// ---- one process at a time ----
function takeLock() {
  for (let i = 0; i < 2; i++) {
    try { const fd = fs.openSync(LOCK, "wx"); fs.writeSync(fd, String(process.pid)); fs.closeSync(fd); locked = true; return; }
    catch (e) {
      if (e.code !== "EEXIST") throw e;
      const pid = parseInt(fs.readFileSync(LOCK, "utf8"), 10);
      let alive = false;
      try { if (pid && pid !== process.pid) { process.kill(pid, 0); alive = true; } } catch (x) { alive = x.code === "EPERM"; }
      // after a reboot the same number can belong to another program: only this server counts
      if (alive) { try { alive = fs.readFileSync("/proc/" + pid + "/cmdline", "utf8").includes("server.js"); } catch (x) {} }
      if (alive) throw new Error("The UII Parts server (process " + pid + ") is using the data. Stop it first: use the uii-admin command, which does that for you.");
      fs.rmSync(LOCK, { force: true });                 // left by a process that is gone
    }
  }
  throw new Error("Could not take the data lock.");
}
function dropLock() { if (locked) { try { fs.rmSync(LOCK, { force: true }); } catch (e) {} locked = false; } }
// ---- which collections exist ----
function manifest() {
  if (known) return known;
  try { known = new Set(JSON.parse(fs.readFileSync(MANIFEST, "utf8"))); }
  catch (e) {
    // first start with this version: every collection already on disk counts as existing
    known = new Set();
    try { for (const f of fs.readdirSync(CDIR)) { const m = f.match(/^(.+)\.json(\.prev)?$/); if (m && COLL_FILE_RE.test(m[1])) known.add(m[1]); } } catch (x) {}
    writeFileDurable(MANIFEST, JSON.stringify(Array.from(known).sort()));
  }
  return known;
}
function addKnown(name) {
  const k = manifest();
  if (k.has(name)) return;
  k.add(name);
  writeFileDurable(MANIFEST, JSON.stringify(Array.from(k).sort()));
}
function keepBad(file) {
  try {
    fs.copyFileSync(file, file + ".bad-" + Date.now());
    var kept = true;
    const base = path.basename(file) + ".bad-";
    const olds = fs.readdirSync(CDIR).filter(f => f.startsWith(base)).sort();
    for (const f of olds.slice(0, Math.max(0, olds.length - 3))) fs.rmSync(path.join(CDIR, f), { force: true });   // keep the last 3
    return kept;
  } catch (e) { console.error("[storage] could not keep a copy of the damaged " + path.basename(file) + ": " + e.message); return false; }
}
function load(name) {
  if (colls.has(name)) return colls.get(name);
  const file = path.join(CDIR, name + ".json"), prev = file + ".prev";
  let m = null, err = null;
  try { m = new Map(Object.entries(readObj(file))); } catch (e) { err = e; }
  if (!m) {
    let pm = null, perr = null;
    try { pm = new Map(Object.entries(readObj(prev))); } catch (e) { perr = e; }
    if (pm) {
      m = pm;
      if (err.code !== "ENOENT") {
        const kept = keepBad(file);
        console.error("[storage] " + name + ".json could not be read (" + err.message + "); using the previous copy (changes from its last few seconds may be missing)." + (kept ? " The damaged file is kept." : ""));
      }
      dirty.add(name); scheduleCompact();
    } else if (err.code === "ENOENT" && perr.code === "ENOENT" && !manifest().has(name)) {
      m = new Map();                                      // a new collection
    } else {
      broken.add(name); m = new Map();
      console.error("[storage] " + name + " CLOSED: " + (err.code === "ENOENT" ? "its file is missing" : "its file cannot be read (" + err.message + ")") +
        " and so is its previous copy. Nothing in it is changed. Restore it from /var/backups/uii-parts, then: systemctl restart uii-parts");
    }
  }
  colls.set(name, m);
  return m;
}
function isBroken(name) { load(name); return broken.has(name); }
function unavailable() { return Object.assign(new Error("storage unavailable"), { code: 503 }); }
function journalFd() {
  if (jfd === null) { jfd = fs.openSync(JOURNAL, "a"); jsize = fs.fstatSync(jfd).size; }
  return jfd;
}
// one change: logged durably first, then made in memory
function commit(coll, id, value) {
  const m = load(coll);
  if (broken.has(coll)) throw unavailable();
  const buf = Buffer.from("\n" + JSON.stringify(value === undefined ? { c: coll, id, del: 1 } : { c: coll, id, d: value }) + "\n");
  try { const fd = journalFd(); writeAll(fd, buf); fs.fsyncSync(fd); jsize += buf.length; }
  catch (e) { console.error("[storage] could not save a change to " + coll + ": " + e.message); throw unavailable(); }
  if (value === undefined) m.delete(id); else m.set(id, value);
  dirty.add(coll);
  if (jsize > 2 * 1024 * 1024) { if (compactTimer) clearTimeout(compactTimer); compactTimer = null; setImmediate(compact); }
  else scheduleCompact();
}
function writeColl(name) {
  const file = path.join(CDIR, name + ".json"), tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
  try { writeAll(fd, Buffer.from(JSON.stringify(Object.fromEntries(load(name))))); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  addKnown(name);
  // the file being replaced becomes the previous copy (it was fsynced when it was written)
  if (fs.existsSync(file)) fs.renameSync(file, file + ".prev");
  fs.renameSync(tmp, file);
  syncDir(CDIR);
}
function compact() {
  compactTimer = null;
  for (const name of Array.from(dirty)) {
    try { writeColl(name); dirty.delete(name); }
    catch (e) { console.error("[storage] could not write " + name + ": " + e.message + " (kept in the log, will try again)"); }
  }
  if (dirty.size) { scheduleCompact(5000); return; }
  try { const fd = journalFd(); fs.ftruncateSync(fd, 0); fs.fsyncSync(fd); jsize = 0; jwarned = false; }
  catch (e) { console.error("[storage] could not empty the log: " + e.message); }
  if (jsize > 50 * 1024 * 1024 && !jwarned) { jwarned = true; console.error("[storage] journal.log is over 50 MB and cannot be emptied"); }
}
const COMPACT_MS = Math.max(0.2, +process.env.COMPACT_SECONDS || 10) * 1000;
function scheduleCompact(ms) { if (!compactTimer) compactTimer = setTimeout(compact, ms || COMPACT_MS); }
// changes found in the log for a CLOSED collection are moved to held-<name>.log, so the log can still be emptied
function hold(ev) {
  const fd = fs.openSync(path.join(DATA, "held-" + ev.c + ".log"), "a");
  try { writeAll(fd, Buffer.from(JSON.stringify(ev) + "\n")); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
// on start: play back what the log holds (changes not yet in the files), reading it piece by piece
function openStore() {
  fs.mkdirSync(CDIR, { recursive: true });
  takeLock();
  manifest();
  let fd;
  try { fd = fs.openSync(JOURNAL, "r"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  let n = 0, bad = 0, held = 0;
  if (fd !== undefined) {
    const buf = Buffer.alloc(1024 * 1024);
    let rest = "", got;
    const one = line => {
      if (!line.trim()) return;
      let ev; try { ev = JSON.parse(line); } catch (e) { bad++; return; }
      if (!ev || typeof ev.c !== "string" || typeof ev.id !== "string" || !COLL_FILE_RE.test(ev.c) || !ID_RE.test(ev.id) && !/^[0-9a-f]{64}$/.test(ev.id)) { bad++; return; }
      const m = load(ev.c);
      if (broken.has(ev.c)) { hold(ev); held++; return; }
      if (ev.del) m.delete(ev.id); else m.set(ev.id, ev.d);
      dirty.add(ev.c); n++;
    };
    try {
      while ((got = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
        const parts = (rest + buf.toString("utf8", 0, got)).split("\n");
        rest = parts.pop();
        parts.forEach(one);
      }
      one(rest);
    } finally { fs.closeSync(fd); }
  }
  if (n || bad || held) console.log("[storage] played back " + n + " change(s) from the log" + (bad ? ", skipped " + bad + " unreadable line(s)" : "") + (held ? ", " + held + " change(s) for a closed list kept in held-*.log" : ""));
  compact();
}
function closeStore() { if (compactTimer) clearTimeout(compactTimer); compactTimer = null; compact(); dropLock(); }
process.on("SIGTERM", () => { closeStore(); process.exit(0); });
process.on("SIGINT", () => { closeStore(); process.exit(0); });
process.on("exit", dropLock);

// ---------- passwords: scrypt with a salt per account ----------
// The page sends a SHA-256 of the password (never the password itself); that is hashed again here.
function pwMake(secret) {
  const salt = crypto.randomBytes(16);
  return "s1$" + salt.toString("hex") + "$" + crypto.scryptSync(String(secret), salt, 32).toString("hex");
}
function pwCheck(secret, stored) {
  if (!stored || !stored.startsWith("s1$")) return false;
  const [, salt, h] = stored.split("$");
  const a = crypto.scryptSync(String(secret), Buffer.from(salt, "hex"), 32), b = Buffer.from(h, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function clientHash(user, pass) { return crypto.createHash("sha256").update("uiird:" + user + ":" + pass).digest("hex"); }

// ---------- sessions: random token in an HttpOnly cookie; only its SHA-256 is kept ----------
function sessions() { return load("_sessions"); }
function tokenKey(t) { return crypto.createHash("sha256").update(t).digest("hex"); }
function newSession(user) {
  const mine = Array.from(sessions()).filter(([, s]) => s.user === user).sort((a, b) => a[1].exp - b[1].exp);
  for (const [k] of mine.slice(0, Math.max(0, mine.length - 9))) commit("_sessions", k);       // keep the newest 10
  const t = crypto.randomBytes(32).toString("base64url");
  commit("_sessions", tokenKey(t), { user, exp: Date.now() + DAYS * 864e5 });
  return t;
}
function cookieOf(req) {
  const m = (req.headers.cookie || "").match(new RegExp("(?:^|;\\s*)" + COOKIE + "=([^;]+)"));
  return m ? m[1] : "";
}
function whoIs(req) {
  const t = cookieOf(req);
  if (!t) return null;
  const k = tokenKey(t), s = sessions().get(k);
  if (!s || s.exp < Date.now()) { if (s) { try { commit("_sessions", k); } catch (e) {} } return null; }
  const u = load("users").get(s.user);
  if (!u || u.active === false) return null;
  return { key: k, user: u };
}
function dropSessionsOf(username) {
  for (const [k, s] of Array.from(sessions())) if (s.user === username) commit("_sessions", k);
}
setInterval(() => { // clear old sessions once an hour
  const now = Date.now();
  try { for (const [k, s] of Array.from(sessions())) if (s.exp < now) commit("_sessions", k); } catch (e) {}
}, 3600e3).unref();

// ---------- sign-in limits: 8 wrong tries per address per 15 minutes ----------
const tries = new Map();
function tooMany(ip) { const t = tries.get(ip); return t && t.n >= 8 && Date.now() - t.at < 15 * 60e3; }
// per address and minute: the sign-in attempts (right or wrong), and the page and icon requests of people not signed in
const hits = new Map();
function ipRate(ip, kind, max) {
  const k = kind + "|" + ip, now = Date.now(), r = hits.get(k);
  if (!r || now - r.t > 60e3) { hits.set(k, { t: now, n: 1 }); return false; }
  return ++r.n > max;
}
const pendingLogin = new Map(); let pendingAll = 0;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of tries) if (now - v.at > 15 * 60e3) tries.delete(k);
  for (const [k, v] of hits) if (now - v.t > 60e3) hits.delete(k);
  for (const [k, v] of RATE) if (now - v.t > 3600e3) RATE.delete(k);
}, 60e3).unref();
function wrongTry(ip) { const t = tries.get(ip); if (!t || Date.now() - t.at > 15 * 60e3) tries.set(ip, { n: 1, at: Date.now() }); else t.n++; }

// ---------- who may read what ----------
// Stock lists and settings (meta): everyone signed in. Accounts: the accounts manager sees all, others
// only their own. Activity: people with Activity or Users. Approval requests: approvers see all, others
// their own. Daily copies (index and contents): Backups only.
const STOCK = new Set(["parts", "transactions", "consumables", "usedParts", "equipment"]);
const KNOWN = new Set(["parts", "transactions", "consumables", "usedParts", "equipment", "users", "actlog", "pendops", "snapshots", "snapshotChunks", "meta"]);
function can(u, p) { return !!(u && u.active !== false && u.perms && u.perms[p]); }
function canRead(me, coll, d) {
  if (coll === "users") return can(me, "users") || (d && d.username === me.username);
  if (coll === "actlog") return can(me, "activity") || can(me, "users");
  if (coll === "pendops") return can(me, "approve") || can(me, "users") || (d && d.user === me.username);
  if (coll === "snapshotChunks" || coll === "snapshots") return can(me, "backup");
  return KNOWN.has(coll);
}
// accounts go out without their password hash; server-kept fields stay on the server
function publicDoc(coll, d) {
  if (coll !== "users") return d;
  const o = Object.assign({}, d); delete o.pw; delete o.hash; return o;
}

// ---------- live updates (Server-Sent Events): each person only gets what they may read ----------
const listeners = new Set();
function broadcast(coll, id, data, old) {
  const users = load("users");
  const msg = "data: " + JSON.stringify({ c: coll, id, d: data === undefined ? null : publicDoc(coll, data), del: data === undefined }) + "\n\n";
  for (const l of Array.from(listeners)) {
    if (!l.colls.has(coll)) continue;
    const u = users.get(l.user);
    if (!u || u.active === false) { dropLive(l); continue; }
    if (canRead(u, coll, data === undefined ? old || null : data)) liveWrite(l, msg);
  }
}
function dropLive(l) { listeners.delete(l); try { l.res.end(); } catch (e) {} }
// a listener that does not read (its buffer keeps growing) is cut off
function liveWrite(l, msg) {
  try { if (l.res.writableLength > 1024 * 1024) { dropLive(l); l.res.destroy(); return; } l.res.write(msg); } catch (e) { dropLive(l); }
}
function closeLive(username) { for (const l of Array.from(listeners)) if (l.user === username) dropLive(l); }
function closeLiveKey(key) { for (const l of Array.from(listeners)) if (l.key === key) dropLive(l); }
// every 25 seconds: a ping, and the sign-in behind each live link is checked again (expired, signed out, turned off)
setInterval(() => {
  const now = Date.now();
  for (const l of Array.from(listeners)) {
    const s = sessions().get(l.key), u = load("users").get(l.user);
    if (!s || s.exp < now || !u || u.active === false) { dropLive(l); continue; }
    liveWrite(l, ": ping\n\n");
  }
}, 25e3).unref();

function adminsLeft(users) { let n = 0; for (const [, u] of users) if (u.active !== false && u.perms && u.perms.users) n++; return n; }
function actlogAdd(u, what, part) {
  const id = "srv" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), now = Date.now();
  const d = { ts: now, seq: now, user: u.username, name: u.name || u.username, via: "", what, part: part || "", from: "", to: "" };
  commit("actlog", id, d); broadcast("actlog", id, d);
}
// every accepted change, with who made it, in a file people cannot reach (kept with the backups)
// audit.log is renamed at 2 MB and the last 4 are kept (audit.log.1 is the newest of them)
const AUDIT = path.join(DATA, "audit.log");
function audit(me, coll, id, op, keys) {
  try {
    fs.appendFileSync(AUDIT, JSON.stringify({ ts: Date.now(), user: me ? me.username : "", coll, id, op, keys: keys || undefined }) + "\n");
    if (fs.statSync(AUDIT).size > 2 * 1024 * 1024) {
      for (let i = 4; i >= 1; i--) { try { fs.renameSync(AUDIT + (i > 1 ? "." + (i - 1) : ""), AUDIT + "." + i); } catch (e) { if (e.code !== "ENOENT") throw e; } }
    }
  } catch (e) { console.error("[audit] " + e.message); }
}

// ---------- who may write what ----------
// Full write on the stock lists: Edit all, or Backups (restore). Otherwise only what the permission is for:
//  Receive: movements in and quantities going up, and a New arrival row (which its maker may then fill in);
//  Transfer: movements out and quantities going down; Approves: both (approving a request);
//  Edit Reference: the reference of a part; Delete: removing. "Needs approval" sends Receive and Transfer to
//  an approver instead (pendops). Only the fields a permission covers are taken from a change.
function full(u) { return can(u, "edit") || can(u, "backup"); }
function waitsForOk(u) { return can(u, "needsOk") && !can(u, "edit") && !can(u, "approve"); }
const SERVER_FIELDS = ["_by", "_at", "createdBy"];
// short free-text fields: printable, limited length
function shortText(v, max) { return typeof v === "string" && v.length <= max && !/[\u0000-\u001f]/.test(v); }
const SLIP_RE = /^[A-Za-z0-9 ._\/-]{0,40}$/;
function slipLineOk(b) { return SLIP_RE.test(String(norm(b.slip))) && SLIP_RE.test(String(norm(b.line))); }
// per account, per hour: Activity entries and approval requests
const RATE = new Map();
function overRate(user, kind, max, ms) {
  const k = user + "|" + kind, now = Date.now(), r = RATE.get(k);
  if (!r || now - r.t > (ms || 3600e3)) { RATE.set(k, { t: now, n: 1 }); return false; }
  return ++r.n > max;
}
// the fields a New arrival row may carry, and which of them its maker may fill in afterwards
const PART_FIELDS = ["month", "machine", "name", "reference", "quantity", "min", "price", "currency", "loggedQty", "date", "baseline", "arrival", "local", "created"];
const ARRIVAL_FILL = ["name", "reference", "min", "price", "currency", "date", "local"];
function norm(v) { return v === undefined || v === null || v === false ? "" : v; }
function changedKeys(cur, body) {
  const ks = new Set(Object.keys(cur).concat(Object.keys(body)));
  return Array.from(ks).filter(k => SERVER_FIELDS.indexOf(k) < 0 && JSON.stringify(norm(cur[k])) !== JSON.stringify(norm(body[k])));
}
// What a stored document may look like: flat fields (text, number, true/false, empty), text up to 2000
// characters, nothing nested except where the page really keeps a list or a small table; 64 KB at most.
const NESTED = { users: ["perms"], snapshots: ["byMachine", "months"], meta: ["rules"] };
const DOC_MAX = { snapshotChunks: 1100000, meta: 262144 };
function nestedOk(v, depth) {
  if (v === null || typeof v === "boolean" || (typeof v === "string" && v.length <= 500)) return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (depth > 3) return false;
  if (Array.isArray(v)) return v.length <= 500 && v.every(x => nestedOk(x, depth + 1));
  if (typeof v === "object") { const ks = Object.keys(v); return ks.length <= 500 && ks.every(k => !RESERVED.has(k) && k.length <= 120 && nestedOk(v[k], depth + 1)); }
  return false;
}
function validDoc(coll, d) {
  if (!d || typeof d !== "object" || Array.isArray(d)) return false;
  if (JSON.stringify(d).length > (DOC_MAX[coll] || 65536)) return false;
  for (const k of Object.keys(d)) {
    if (RESERVED.has(k) || k.length > 60) return false;
    const v = d[k];
    if (v === null || typeof v === "boolean") continue;
    if (typeof v === "number") { if (!Number.isFinite(v)) return false; continue; }
    if (typeof v === "string") { if (v.length > (coll === "snapshotChunks" && k === "data" ? 1100000 : 2000)) return false; continue; }
    if ((NESTED[coll] || []).indexOf(k) >= 0 && nestedOk(v, 0)) continue;
    return false;
  }
  return true;
}
function wholeNum(v) { return /^\d+$/.test(String(v)) ? +v : null; }
function monthKey(offset) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 7); }
const NO = { err: "not_granted" }, BAD = { err: "invalid_argument" };
function checkStock(me, coll, id, body, del, cur) {
  if (del) return can(me, "delete") || can(me, "backup") ? { body: null } : NO;
  if (full(me)) return { body: Object.assign({}, body, { _by: cur ? cur._by || "" : me.username }) };
  if (waitsForOk(me)) {                                // their Receive / Transfer goes to an approver
    if (coll === "parts" && cur && can(me, "editRef")) {
      const ks = changedKeys(cur, body);
      if (ks.length === 1 && ks[0] === "reference" && shortText(body.reference, 80)) return { body: Object.assign({}, cur, { reference: body.reference }) };
    }
    return NO;
  }
  const inP = can(me, "receive") || can(me, "approve"), outP = can(me, "transfer") || can(me, "approve");
  // without Edit all, only this month and last month
  const mo = String((cur && cur.month) || body.month || "");
  if ((coll === "parts" || coll === "transactions") && mo && mo < monthKey(-1)) return NO;
  if (coll === "transactions") {
    if (!cur) {
      const ch = Number(body.change);
      if (!slipLineOk(body)) return BAD;
      return (ch > 0 && inP) || (ch < 0 && outP) ? { body: Object.assign({}, body, { _by: me.username }) } : NO;
    }
    // a movement already saved: its maker, still allowed that direction, may only renumber the slip or set the line
    const ks = changedKeys(cur, body), dirOk = Number(cur.change) > 0 ? inP : outP;
    if (cur._by === me.username && dirOk && ks.every(k => k === "slip" || k === "line")) return slipLineOk(body) ? { body: Object.assign({}, cur, { slip: body.slip, line: body.line }) } : BAD;
    return NO;
  }
  if (!cur) {
    // a New arrival row starts empty: no stock yet, this month or last month; the stock comes with its Receive
    if (coll !== "parts" || body.arrival !== true || !inP) return NO;
    if (norm(body.quantity) !== "" || norm(body.loggedQty) !== "" || body.baseline === true) return NO;
    if (!/^\d{4}-\d{2}$/.test(String(body.month)) || body.month < monthKey(-1) || !shortText(body.machine, 40)) return NO;
    const nb = {}; PART_FIELDS.forEach(k => { if (k in body) nb[k] = body[k]; });
    return { body: Object.assign(nb, { _by: me.username }) };
  }
  if (coll === "parts" && cur._by === me.username && cur.arrival === true && inP) {
    // its maker fills it in: the description fields, and the quantity only upwards; month, machine and the rest stay
    const out = Object.assign({}, cur);
    ARRIVAL_FILL.forEach(k => { if (k in body) out[k] = body[k]; });
    const ks = changedKeys(cur, body);
    if (ks.indexOf("quantity") >= 0) {
      const a = wholeNum(norm(cur.quantity) === "" ? 0 : cur.quantity), b = wholeNum(body.quantity);
      if (a === null || b === null || b < a) return NO;
      out.quantity = body.quantity; out.loggedQty = body.quantity;
    }
    if (ks.some(k => ARRIVAL_FILL.indexOf(k) < 0 && ["quantity", "loggedQty"].indexOf(k) < 0)) return NO;
    return { body: out };
  }
  const ks = changedKeys(cur, body);
  if (!ks.length) return { body: cur };
  const allowed = [];
  if (inP || outP) allowed.push("quantity", coll === "parts" ? "loggedQty" : "", coll === "parts" ? "baseline" : "");
  if (coll === "parts" && can(me, "editRef")) allowed.push("reference");
  // the logged quantity always follows the quantity, and the opening-stock mark can only be turned off
  const newQty = ks.indexOf("quantity") >= 0 && allowed.indexOf("quantity") >= 0 ? body.quantity : cur.quantity;
  const mine = ks.filter(k => allowed.indexOf(k) >= 0 && (k !== "loggedQty" || String(body.loggedQty) === String(newQty)) && (k !== "baseline" || body.baseline === false));
  if (!mine.length) return NO;
  if (mine.indexOf("quantity") >= 0) {
    const a = wholeNum(cur.quantity), b = wholeNum(body.quantity);
    if (a === null || b === null || (b > a && !inP) || (b < a && !outP)) return NO;
  }
  const out = Object.assign({}, cur);
  mine.forEach(k => { out[k] = body[k]; });          // other fields stay as they are on the server
  return { body: out };
}
function checkWrite(me, coll, id, body, del) {
  if (!KNOWN.has(coll)) return BAD;
  const cur = load(coll).get(id);
  if (coll === "users") {
    if (!can(me, "users")) return NO;
    const users = load("users");
    if (del) {
      if (id === me.username) return BAD;
      const copy = new Map(users); copy.delete(id);
      return adminsLeft(copy) ? { body: null } : BAD;
    }
    if (!body || body.username !== id || !/^[a-z0-9._-]{2,30}$/.test(id) || RESERVED.has(id)) return BAD;
    if (!cur && !(typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash))) return BAD;
    const copy = new Map(users); copy.set(id, body);
    return adminsLeft(copy) ? { body } : BAD;
  }
  if (coll === "actlog") {
    // nobody removes or rewrites someone else's entry; the name comes from the account, not from the page
    if (del) return NO;
    if (!body || typeof body.user !== "string" || !shortText(body.what, 300)) return BAD;
    if (!["part", "from", "to"].every(k => body[k] === undefined || shortText(String(body[k]), 200))) return BAD;
    const acting = body.user !== me.username;            // an accounts manager inside someone's account
    if (acting && !can(me, "users")) return NO;
    if (cur && cur.user !== body.user) return NO;
    // the page joins quick edits of one field into one entry: allowed for 2 minutes after the entry was made
    if (cur && Date.now() - (cur._at || 0) > 120e3) return NO;
    if (overRate(me.username, "actlog", 600)) return { err: "rate_limited" };
    const now = Date.now(), near = v => typeof v === "number" && Math.abs(v - now) < 10 * 60e3 ? v : now;
    const d = { ts: near(body.ts), seq: near(body.seq), user: body.user, name: body.name, what: body.what, part: body.part || "", from: body.from || "", to: body.to || "",
      via: acting ? me.name || me.username : "", _at: cur ? cur._at : now };
    if (!acting) d.name = me.name || me.username;
    return { body: d };
  }
  if (coll === "pendops") {
    if (del) return can(me, "users") ? { body: null } : NO;
    if (!body) return BAD;
    if (!cur) {
      const acting = body.user !== me.username;
      if (acting && !can(me, "users")) return NO;
      const who = acting ? load("users").get(body.user) : me;
      if (!who || body.status !== "waiting" || (body.mode !== "in" && body.mode !== "out") || !(body.mode === "in" ? can(who, "receive") : can(who, "transfer"))) return NO;
      const store = { part: "parts", cons: "consumables", used: "usedParts", equip: "equipment" }[body.kind];
      const row = store ? load(store).get(String(body.partId)) : null, qty = wholeNum(body.qty);
      if (!row || !qty || qty > 100000 || !slipLineOk(body)) return BAD;
      if (!["date", "time", "me", "by", "to"].every(k => body[k] === undefined || shortText(String(body[k]), 80))) return BAD;
      let waiting = 0; for (const [, d] of load("pendops")) if (d.user === who.username && d.status === "waiting") waiting++;
      if (waiting >= 50 || overRate(me.username, "pendops", 120)) return { err: "rate_limited" };
      return { body: { ts: Date.now(), user: who.username, name: who.name || who.username, status: "waiting", mode: body.mode, kind: body.kind, partId: String(body.partId),
        month: row.month || "", machine: row.machine || row.section || "", partName: row.name || "", reference: row.reference || "", qty,
        line: body.mode === "in" ? "" : String(norm(body.line)), date: String(norm(body.date)), time: String(norm(body.time)),
        me: String(norm(body.me)), by: String(norm(body.by)), to: String(norm(body.to)), decidedBy: "", decidedTs: 0, note: "",
        createdBy: me.username } };
    }
    // a decision: approvers only, once, and only the decision fields
    if (!can(me, "approve") || cur.status !== "waiting" || ["approved", "rejected"].indexOf(body.status) < 0) return NO;
    // only the decision is read from the page; everything else stays as the server stored it
    if (!shortText(String(norm(body.note)), 300)) return BAD;
    return { body: Object.assign({}, cur, { status: body.status, decidedBy: me.name || me.username, decidedTs: Date.now(), note: body.note || "" }) };
  }
  if (coll === "snapshots" || coll === "snapshotChunks") {
    // copies are taken and removed by someone with Backups (the page does it when they open it), with sane names
    if (!can(me, "backup")) return NO;
    if (del) return { body: null };
    const KEY = /^(\d{4}-\d{2}-\d{2}|pre-\d{10,16})$/;
    if (coll === "snapshots") {
      const n = body && body.chunks;
      if (!KEY.test(id) || !(Number.isInteger(n) && n >= 0 && n <= 5000) || (body.kind !== "daily" && body.kind !== "pre")) return BAD;
      if (body.kind === "daily" && id > new Date(Date.now() + 86400e3).toISOString().slice(0, 10)) return BAD;
      return { body };
    }
    const m = /^(.+)-(\d+)$/.exec(id);
    return m && KEY.test(m[1]) && +m[2] <= 5000 ? { body } : BAD;
  }
  if (coll === "meta") return can(me, "backup") ? { body: del ? null : body } : NO;
  if (STOCK.has(coll)) return checkStock(me, coll, id, body, del, cur);
  return NO;
}
function applyWrite(me, coll, id, d, del) {
  const m = load(coll);
  if (del) {
    if (!m.has(id)) return;
    const old = m.get(id);
    commit(coll, id);
    audit(me, coll, id, "delete");
    if (coll === "users") { dropSessionsOf(id); closeLive(id); }
    broadcast(coll, id, undefined, old);
    return;
  }
  let hadPw = false, cur = m.get(id);
  const body = d;
  if (coll === "users") {
    const c = cur || {};
    hadPw = !!c.pw;
    d = Object.assign({}, body);
    delete d.hash;
    d.pw = typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash) ? pwMake(body.hash) : c.pw;
  }
  commit(coll, id, d);                                    // the account first; only then sign that person out
  audit(me, coll, id, cur ? "change" : "add", cur ? changedKeys(cur, d) : undefined);
  if (coll === "users" && ((body.hash && hadPw) || d.active === false)) {
    try { dropSessionsOf(id); closeLive(id); } catch (e) { console.error("[storage] could not sign out " + id + ": " + e.message); }
  }
  broadcast(coll, id, d);
}
// the Activity list keeps the newest 20000 entries (audit.log keeps the full record, 4 files of 2 MB)
function pruneActivity() {
  try {
    const m = load("actlog");
    if (broken.has("actlog") || m.size <= 22000) return;
    const old = Array.from(m).sort((a, b) => ((a[1].seq || a[1].ts || 0) - (b[1].seq || b[1].ts || 0))).slice(0, Math.min(m.size - 20000, 4000));
    old.forEach(([k]) => commit("actlog", k));
    audit(null, "actlog", "*", "pruned " + old.length);
  } catch (e) { console.error("[activity] " + e.message); }
}
// daily copies: the server keeps the last 30 days and the latest copy taken before a restore
function pruneCopies() {
  try {
    const snaps = Array.from(load("snapshots")).map(([k, v]) => Object.assign({ key: k }, v));
    const tomorrow = new Date(Date.now() + 86400e3).toISOString().slice(0, 10);
    const daily = snaps.filter(s => s.kind === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(s.key) && s.key <= tomorrow).sort((a, b) => a.key < b.key ? 1 : -1).slice(30);
    const pre = snaps.filter(s => s.kind === "pre").sort((a, b) => (b.at || 0) - (a.at || 0)).slice(1);
    daily.concat(pre).forEach(s => {
      for (let i = 0; i < Math.min(5000, s.chunks || 0); i++) if (load("snapshotChunks").has(s.key + "-" + i)) commit("snapshotChunks", s.key + "-" + i);
      commit("snapshots", s.key);
      audit(null, "snapshots", s.key, "delete");
    });
  } catch (e) { console.error("[copies] " + e.message); }
}

// ---------- http ----------
function send(res, code, obj, extra) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ "Content-Type": typeof obj === "string" ? "text/plain; charset=utf-8" : "application/json", "Cache-Control": "no-store" }, extra || {}));
  res.end(body);
}
function readBody(req, max) {
  max = max || MAX_BODY;
  return new Promise((ok, bad) => {
    let n = 0; const parts = [];
    if (parseInt(req.headers["content-length"] || "0", 10) > max) return bad(Object.assign(new Error("too big"), { code: 413 }));
    req.on("data", c => { n += c.length; if (n > max) { bad(Object.assign(new Error("too big"), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { ok(n ? JSON.parse(Buffer.concat(parts).toString("utf8")) : null); } catch (e) { bad(Object.assign(e, { code: 400 })); } });
    req.on("error", bad);
  });
}
function ipOf(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
const SECURITY = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Resource-Policy": "same-origin"
};
// The page is read once and kept in memory (checked again every 5 seconds). Its content policy lists the
// fingerprints of the page's own scripts and style, so only that code runs, nothing a person could inject.
const pageState = { buf: null, etag: "", csp: "", mtime: 0, at: 0 };
function currentPage() {
  const now = Date.now();
  if (pageState.buf && now - pageState.at < 5000) return pageState;
  pageState.at = now;
  const st = fs.statSync(PAGE);
  if (!pageState.buf || st.mtimeMs !== pageState.mtime) {
    const buf = fs.readFileSync(PAGE), html = buf.toString("utf8");
    const hashes = re => { const out = []; let m; while ((m = re.exec(html))) out.push("'sha256-" + crypto.createHash("sha256").update(m[1]).digest("base64") + "'"); return out.join(" "); };
    pageState.buf = buf; pageState.mtime = st.mtimeMs;
    pageState.etag = '"' + crypto.createHash("sha1").update(buf).digest("hex") + '"';
    pageState.csp = ["default-src 'none'", "script-src " + hashes(/<script>([\s\S]*?)<\/script>/g), "style-src " + hashes(/<style>([\s\S]*?)<\/style>/g),
      "style-src-attr 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "manifest-src 'self'",
      "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'"].join("; ");
  }
  return pageState;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), p = url.pathname;
    for (const k in SECURITY) res.setHeader(k, SECURITY[k]);

    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      if (ipRate(ipOf(req), "page", 300)) return send(res, 429, { code: "rate_limited" });
      let pg; try { pg = currentPage(); } catch (e) { return send(res, 500, "page missing"); }
      if (req.headers["if-none-match"] === pg.etag) { res.writeHead(304, { ETag: pg.etag, "Cache-Control": "no-cache" }); return res.end(); }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", ETag: pg.etag, "Content-Security-Policy": pg.csp, "Content-Length": pg.buf.length });
      return res.end(pg.buf);
    }
    if (req.method === "HEAD" && (p === "/" || p === "/index.html")) { res.writeHead(200, { "Cache-Control": "no-store" }); return res.end(); }
    // the app icon and the file that lets Edge / Chrome install the site as an app (a fixed list, nothing else)
    if (req.method === "GET" && Object.prototype.hasOwnProperty.call(ASSETS, p)) {
      if (ipRate(ipOf(req), "page", 300)) return send(res, 429, { code: "rate_limited" });
      return fs.readFile(path.join(__dirname, "public", p.slice(1)), (e, buf) => {
        if (e) return send(res, 404, "not found");
        res.writeHead(200, { "Content-Type": ASSETS[p], "Cache-Control": "public, max-age=86400" }); res.end(buf);
      });
    }
    if (!p.startsWith("/api/")) return send(res, 404, "not found");
    if (isBroken("users") || isBroken("_sessions")) return send(res, 503, { code: "unavailable" });
    // writes must come from the page itself (a cross-site form cannot set this header)
    if (req.method !== "GET" && req.headers["x-uii"] !== "1") return send(res, 403, { code: "not_granted" });

    if (p === "/api/login" && req.method === "POST") {
      const ip = ipOf(req);
      if (tooMany(ip) || ipRate(ip, "login", 20) || (pendingLogin.get(ip) || 0) >= 2 || pendingAll >= 20) return send(res, 429, { code: "rate_limited" });
      pendingLogin.set(ip, (pendingLogin.get(ip) || 0) + 1); pendingAll++;
      let b;
      try { b = await readBody(req, MAX_LOGIN_BODY) || {}; }
      finally { pendingAll--; const n = (pendingLogin.get(ip) || 1) - 1; if (n) pendingLogin.set(ip, n); else pendingLogin.delete(ip); }
      if (typeof b !== "object" || Array.isArray(b)) return send(res, 400, { code: "invalid_argument" });
      const name = String(b.username || "").trim().toLowerCase(), u = load("users").get(name);
      if (!u || !pwCheck(String(b.hash || ""), u.pw)) { wrongTry(ip); return send(res, 401, { code: "wrong" }); }
      if (u.active === false) return send(res, 403, { code: "off" });
      tries.delete(ip);
      const t = newSession(name);
      try { actlogAdd(u, "Signed in", ""); } catch (e) { console.error("[activity] sign-in of " + name + " not written to the Activity log: " + e.message); }
      return send(res, 200, { username: name }, { "Set-Cookie": COOKIE + "=" + t + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + DAYS * 86400 });
    }
    if (p === "/api/logout" && req.method === "POST") {
      const w = whoIs(req);
      if (w) { try { commit("_sessions", w.key); } catch (e) {} closeLiveKey(w.key); }
      return send(res, 200, { ok: true }, { "Set-Cookie": COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
    }

    const w = whoIs(req);
    if (!w) return send(res, 401, { code: "signed_out" });
    const me = w.user;

    if (p === "/api/me") return send(res, 200, { username: me.username });

    if (p === "/api/live" && req.method === "GET") {
      const cs = new Set(String(url.searchParams.get("c") || "").split(",").filter(c => KNOWN.has(c)));
      // at most 6 live links per person (the oldest is closed) and 100 in all
      const mine = Array.from(listeners).filter(x => x.user === me.username);
      if (mine.length >= 6) dropLive(mine[0]);
      if (listeners.size >= 100) return send(res, 503, { code: "unavailable" });
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      res.write("retry: 3000\n\n");
      const l = { res, colls: cs, user: me.username, key: w.key };
      listeners.add(l);
      req.on("close", () => listeners.delete(l));
      return;
    }

    const m = p.match(/^\/api\/c\/([^/]+)(?:\/([^/]+))?$/);
    if (!m) return send(res, 404, { code: "not_found" });
    const coll = decodeURIComponent(m[1]), id = m[2] ? decodeURIComponent(m[2]) : null;
    if (!COLL_RE.test(coll) || coll.startsWith("_") || (id !== null && (!ID_RE.test(id) || RESERVED.has(id)))) return send(res, 400, { code: "invalid_argument" });

    if (!KNOWN.has(coll)) return send(res, 400, { code: "invalid_argument" });
    if (req.method === "GET" && isBroken(coll)) return send(res, 503, { code: "unavailable" });
    if (req.method === "GET" && id === null) {
      const out = [];
      for (const [k, d] of load(coll)) if (canRead(me, coll, d)) out.push([k, publicDoc(coll, d)]);
      return send(res, 200, out);
    }
    if (req.method === "GET") {
      const d = load(coll).get(id);
      return send(res, 200, d && canRead(me, coll, d) ? { exists: true, d: publicDoc(coll, d) } : { exists: false });
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      const del = req.method === "DELETE";
      const body = del ? null : await readBody(req);
      if (!del && !validDoc(coll, body)) return send(res, 400, { code: "invalid_argument" });
      // a person who is not restoring backups may make 600 changes a minute (a busy day is far below that)
      if (!can(me, "backup") && overRate(me.username, "writes", 600, 60e3)) return send(res, 429, { code: "rate_limited" });
      const ok = checkWrite(me, coll, id, body, del);
      if (ok.err) return send(res, ok.err === "not_granted" ? 403 : ok.err === "rate_limited" ? 429 : 400, { code: ok.err });
      applyWrite(me, coll, id, ok.body, del);
      return send(res, 200, { ok: true });
    }
    return send(res, 405, { code: "invalid_argument" });
  } catch (e) {
    const st = e.code === 413 ? 413 : e.code === 400 ? 400 : e.code === 503 ? 503 : 500;
    if (!res.headersSent) send(res, st, { code: st === 413 ? "too_big" : st === 400 ? "invalid_argument" : st === 503 ? "unavailable" : "internal" });
    if (!e.code) console.error(e);
  }
});

// ---------- make or reset an admin from the shell ----------
async function makeAdmin() {
  if (typeof process.getuid === "function" && process.getuid() === 0 && !process.env.UII_ALLOW_ROOT) { console.error("Do not run this as root (the data files would become root's). Use the command: uii-admin"); process.exit(1); }
  try { openStore(); } catch (e) { console.error(e.message); process.exit(1); }
  const tty = !!process.stdin.isTTY;
  const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout, terminal: tty });
  const lines = [], waiting = [];
  let muted = false;
  if (tty) { const w = rl._writeToOutput.bind(rl); rl._writeToOutput = s => { if (!muted) w(s); }; }
  rl.on("line", l => { if (waiting.length) waiting.shift()(l); else lines.push(l); });
  const ask = (q, hide) => new Promise(ok => {
    process.stdout.write(q);
    muted = !!hide;
    const done = a => { muted = false; if (hide) process.stdout.write("\n"); ok(a); };
    if (lines.length) done(lines.shift()); else waiting.push(done);
  });
  const username = (process.env.ADMIN_USER || await ask("Admin username: ")).trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,30}$/.test(username) || RESERVED.has(username)) { console.error("Username: 2 to 30 small letters or numbers."); process.exit(1); }
  const name = username;
  const p1 = await ask("Password (at least 8 characters): ", true);
  const p2 = await ask("Password again: ", true);
  rl.close();
  if (p1.length < 8) { console.error("Too short."); process.exit(1); }
  if (p1 !== p2) { console.error("The two passwords are not the same."); process.exit(1); }
  const perms = { receive: 1, transfer: 1, edit: 1, editRef: 1, "delete": 1, order: 1, "export": 1, backup: 1, activity: 1, users: 1, approve: 1 };
  if (isBroken("users")) { console.error("The accounts file cannot be read. Nothing was changed."); closeStore(); process.exit(1); }
  const cur = load("users").get(username) || {};
  commit("users", username, Object.assign({}, cur, { username, name, role: "admin", perms, active: true, created: cur.created || Date.now(), pw: pwMake(clientHash(username, p1)) }));
  audit({ username: "shell" }, "users", username, cur.pw ? "make-admin (reset)" : "make-admin (new)");
  closeStore();
  console.log("Admin ready: " + username);
}

if (process.argv[2] === "make-admin") makeAdmin();
else { openStore(); pruneCopies(); pruneActivity(); setInterval(pruneCopies, 6 * 3600e3).unref(); setInterval(pruneActivity, 6 * 3600e3).unref();
  server.headersTimeout = 15e3; server.requestTimeout = 30e3; server.keepAliveTimeout = 5e3; server.maxConnections = 300; server.listen(PORT, "127.0.0.1", () => console.log("UII Parts on 127.0.0.1:" + PORT + ", data in " + DATA)); }
