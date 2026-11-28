"use strict";
// UII Parts server: serves the page, keeps the data, checks sign-in.
// No packages needed: Node's own http, crypto and fs.
//   PORT  (default 3000, listens on 127.0.0.1 only; Caddy sits in front with HTTPS)
//   DATA  (default ./data) folder for the collections, accounts and sessions
// Make or reset an admin from the shell:  uii-admin   (stops the service, runs "server.js make-admin" as the uii user, starts it again)
const http = require("http"), https = require("https"), crypto = require("crypto"), fs = require("fs"), path = require("path");

const PORT = +process.env.PORT || 3000;
const DATA = path.resolve(process.env.DATA || path.join(__dirname, "data"));
const PAGE = path.join(__dirname, "public", "index.html");
const ASSETS = { "/manifest.webmanifest": "application/manifest+json", "/icon-192.png": "image/png", "/icon-512.png": "image/png",
  "/icon-maskable-512.png": "image/png", "/apple-touch-icon.png": "image/png", "/favicon-32.png": "image/png", "/favicon.ico": "image/png",
  "/sw.js": "text/javascript; charset=utf-8" };
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
  try { notifyAfterWrite(me, coll, id, d, cur); } catch (e) { console.error("[notify] " + e.message); }
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
      "style-src-attr 'unsafe-inline'", "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'",
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
        res.writeHead(200, { "Content-Type": ASSETS[p], "Cache-Control": p === "/sw.js" ? "no-cache" : "public, max-age=86400" }); res.end(buf);
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
    if (p === "/api/chat" || p.startsWith("/api/chat/")) return await handleChat(req, res, me, url, p);
    if (p === "/api/notify" || p.startsWith("/api/notify/")) return await handleNotify(req, res, me, url, p);

    if (p === "/api/live" && req.method === "GET") {
      const cs = new Set(String(url.searchParams.get("c") || "").split(",").filter(c => KNOWN.has(c) || c === "chat"));
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


// ---------- messages: private chats and groups ----------
// People write to people (one to one, or in a group they make). The admin (a person who may manage accounts) can read
// every conversation, and sees who has seen what; nobody else sees who saw their or anyone's messages except the sender.
// Kept like the other lists, but reachable only through /api/chat/...: "chats", "chatreads" (one document per person:
// what they have read, which chats they muted) and one "msgs_YYYYMM" per month for the messages themselves.
// Until 1 Jan 2027 only an admin can use it, unless an admin switches it on for everyone.
const CHAT_START = Date.UTC(2027, 0, 1), MSG_MAX = 2000, CHAT_BODY = 16 * 1024;
const chatIndex = new Map();                                // chat id -> [{ ts, id, from }], oldest first
let lastMsgTs = 0;
function monthOf(ts) { const d = new Date(ts); return "msgs_" + d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, "0"); }
function indexMsg(m) {
  let a = chatIndex.get(m.chat); if (!a) { a = []; chatIndex.set(m.chat, a); }
  a.push({ ts: m.ts, id: m.id, from: m.from });
  if (m.ts > lastMsgTs) lastMsgTs = m.ts;
}
function buildChatIndex() {
  const names = new Set(Array.from(manifest()).concat(Array.from(colls.keys())));
  for (const name of names) {
    if (!/^msgs_\d{6}$/.test(name)) continue;
    const m = load(name);
    if (broken.has(name)) continue;
    for (const [, d] of m) if (d && d.chat && d.ts) indexMsg(d);
  }
  for (const a of chatIndex.values()) a.sort((x, y) => x.ts - y.ts);
}
function getMsg(e) { return load(monthOf(e.ts)).get(e.id) || null; }
function nextTs() { lastMsgTs = Math.max(Date.now(), lastMsgTs + 1); return lastMsgTs; }
function chatFeature() { return load("meta").get("features") || {}; }
function messagesOn(me) { return can(me, "users") || Date.now() >= CHAT_START || chatFeature().messages === true; }
function activePerson(name) { const u = load("users").get(name); return u && u.active !== false ? u : null; }
function directory() { return Array.from(load("users")).filter(([, u]) => u.active !== false).map(([k, u]) => ({ username: k, name: u.name || k })); }
function admins() { return Array.from(load("users")).filter(([, u]) => u.active !== false && can(u, "users")).map(([k]) => k); }
function liveChat(id) { const c = load("chats").get(id); return c && !c.deleted ? c : null; }
function isMember(c, user) { return c.members.indexOf(user) >= 0; }
function readsOf(user) { const r = load("chatreads").get(user); return { c: Object.assign({}, r && r.c), m: Object.assign({}, r && r.m) }; }
function joinedAt(c, user) { return (c.joined && c.joined[user]) || 0; }
function msgOut(m, c, me, seeSeen) {
  const o = { id: m.id, chat: m.chat, from: m.from, ts: m.ts, text: m.text, reply: m.reply || null, part: m.part || null };
  if (m.from === me || seeSeen) {            // who has seen it: only the sender, and an admin
    const others = c.members.filter(x => x !== m.from); o.seen = {};
    for (const u of others) if (m.seen && m.seen[u]) o.seen[u] = m.seen[u];
    o.total = others.length;
  }
  return o;
}
function unreadCount(c, me) {
  const a = chatIndex.get(c.id) || [], rd = readsOf(me).c[c.id] || 0, from = joinedAt(c, me);
  let n = 0;
  for (let i = a.length - 1; i >= 0; i--) { const e = a[i]; if (e.ts <= rd || e.ts < from) break; if (e.from !== me) n++; }
  return n;
}
function chatOut(c, me, seeSeen, member) {
  const a = chatIndex.get(c.id) || [], from = member ? joinedAt(c, me) : 0;
  let last = null;
  for (let i = a.length - 1; i >= 0; i--) if (a[i].ts >= from) { last = getMsg(a[i]); break; }
  return { id: c.id, type: c.type, name: c.name || "", members: c.members, by: c.by || "", created: c.created || 0, deleted: !!c.deleted,
    last: last ? msgOut(last, c, me, seeSeen) : null, unread: member ? unreadCount(c, me) : 0, muted: member && !!readsOf(me).m[c.id], member };
}
function chatPushTo(user, payload) {
  const msg = "data: " + JSON.stringify(Object.assign({ c: "chat" }, payload)) + "\n\n";
  for (const l of Array.from(listeners)) if (l.user === user && l.colls.has("chat")) liveWrite(l, msg);
}
function chatPushAll(payload) { const seen = new Set(); for (const l of Array.from(listeners)) if (l.colls.has("chat") && !seen.has(l.user)) { seen.add(l.user); chatPushTo(l.user, payload); } }
function cleanText(v, max) {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  if (!t || t.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t)) return null;
  return t;
}
const adminReadAt = new Map();
async function handleChat(req, res, me, url, p) {
  const admin = can(me, "users"), name = me.username, sub = p.slice("/api/chat".length).replace(/^\//, "");
  const bad = c => send(res, c || 400, { code: c === 403 ? "not_granted" : c === 404 ? "not_found" : c === 429 ? "rate_limited" : "invalid_argument" });
  if (sub === "switch" && !admin) return bad(403);
  if (!messagesOn(me)) return send(res, 200, { on: false });
  const body = async () => { const b = await readBody(req, CHAT_BODY); return b && typeof b === "object" && !Array.isArray(b) ? b : null; };
  const getMethod = req.method === "GET", post = req.method === "POST";
  if (isBroken("chats") || isBroken("chatreads") || isBroken("meta")) return send(res, 503, { code: "unavailable" });

  if (sub === "boot" && getMethod) {
    const mine = Array.from(load("chats").values()).filter(c => !c.deleted && isMember(c, name)).map(c => chatOut(c, name, admin, true))
      .sort((a, b) => (b.last ? b.last.ts : b.created) - (a.last ? a.last.ts : a.created));
    return send(res, 200, { on: true, me: { username: name, name: me.name || name, admin }, people: directory(), chats: mine,
      features: { staffOn: chatFeature().messages === true || Date.now() >= CHAT_START, auto: Date.now() >= CHAT_START, start: CHAT_START } });
  }
  if (sub === "all" && getMethod) {
    if (!admin) return bad(403);
    const all = Array.from(load("chats").values()).map(c => chatOut(c, name, true, isMember(c, name)))
      .sort((a, b) => (b.last ? b.last.ts : b.created) - (a.last ? a.last.ts : a.created));
    return send(res, 200, { chats: all });
  }
  if (sub === "switch" && post) {
    if (!admin) return bad(403);
    const b = await body(); if (!b || typeof b.on !== "boolean") return bad();
    commit("meta", "features", Object.assign({}, chatFeature(), { messages: b.on, by: name, at: Date.now() }));
    audit(me, "meta", "features", "messages " + (b.on ? "on" : "off"));
    chatPushAll({ kind: "chat" });
    return send(res, 200, { ok: true });
  }
  if (sub === "dm" && post) {
    const b = await body(); if (!b || typeof b.with !== "string") return bad();
    const other = b.with;
    if (other === name || !activePerson(other)) return bad();
    const id = "dm:" + [name, other].sort().join(":"); let c = load("chats").get(id);
    if (!c) { c = { id, type: "dm", name: "", members: [name, other].sort(), by: name, created: Date.now(), joined: {} }; commit("chats", id, c); chatPushTo(other, { kind: "chat", chat: id }); }
    return send(res, 200, { chat: chatOut(c, name, admin, true) });
  }
  if (sub === "group" && post) {
    if (overRate(name, "groups", 10, 3600e3)) return bad(429);
    const b = await body(); if (!b) return bad();
    const gname = cleanText(b.name, 40); if (!gname || !Array.isArray(b.members)) return bad();
    const members = Array.from(new Set(b.members.filter(x => typeof x === "string" && x !== name && activePerson(x))));
    if (!members.length || members.length > 29) return bad();
    const id = "g" + crypto.randomBytes(6).toString("hex"), now = Date.now(), joined = {};
    members.concat([name]).forEach(u => { joined[u] = now; });
    const c = { id, type: "group", name: gname, members: [name].concat(members), by: name, created: now, joined };
    commit("chats", id, c); audit(me, "chats", id, "group created", members);
    members.forEach(u => chatPushTo(u, { kind: "chat", chat: id }));
    return send(res, 200, { chat: chatOut(c, name, admin, true) });
  }
  if (sub === "parts" && getMethod) {
    // the parts of the newest month, found by name, reference or machine
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60), all = Array.from(load("parts"));
    let latest = ""; for (const [, r] of all) if (r.month && r.month > latest) latest = r.month;
    const items = all.filter(([, r]) => r.month === latest && (!q || (String(r.name || "") + " " + String(r.reference || "") + " " + String(r.machine || "")).toLowerCase().indexOf(q) >= 0))
      .sort((x, y) => String(x[1].name || "").localeCompare(String(y[1].name || ""))).slice(0, 20)
      .map(([k, r]) => ({ id: k, name: r.name || "", reference: r.reference || "", machine: r.machine || "", month: r.month, quantity: String(r.quantity == null ? "" : r.quantity) }));
    return send(res, 200, { month: latest, items });
  }
  if (sub === "search" && getMethod) {
    if (overRate(name, "msearch", 60, 60e3)) return bad(429);
    const q = String(url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 60); if (q.length < 2) return send(res, 200, { results: [] });
    const found = []; let scanned = 0;
    for (const c of load("chats").values()) {
      if (c.deleted || !isMember(c, name)) continue;
      const a = chatIndex.get(c.id) || [], from = joinedAt(c, name);
      for (let i = a.length - 1; i >= 0 && scanned < 20000; i--, scanned++) {
        if (a[i].ts < from) break;
        const m = getMsg(a[i]); if (!m) continue;
        const hay = (m.text + " " + (m.part ? m.part.name + " " + m.part.reference : "")).toLowerCase();
        if (hay.indexOf(q) >= 0) found.push({ chat: c.id, msg: msgOut(m, c, name, admin) });
      }
    }
    found.sort((x, y) => y.msg.ts - x.msg.ts);
    return send(res, 200, { results: found.slice(0, 30) });
  }
  const mm = sub.match(/^c\/([^/]+)\/(messages|send|read|mute|members)$/), md = sub.match(/^c\/([^/]+)$/);
  if (md && req.method === "DELETE") {
    const c = liveChat(decodeURIComponent(md[1])); if (!c || c.type !== "group") return bad(404);
    if (!admin && c.by !== name) return bad(403);
    commit("chats", c.id, Object.assign({}, c, { deleted: Date.now() })); audit(me, "chats", c.id, "group deleted");
    c.members.forEach(u => chatPushTo(u, { kind: "chat", chat: c.id }));
    return send(res, 200, { ok: true });
  }
  if (!mm) return bad(404);
  const id = decodeURIComponent(mm[1]), act = mm[2], c = liveChat(id) || (admin ? load("chats").get(id) : null);
  if (!c) return bad(404);
  const member = isMember(c, name);

  if (act === "messages" && getMethod) {
    if (!member && !admin) return bad(403);
    if (!member) {        // an admin reading someone else's conversation is written down (once in 10 minutes)
      const k = name + "|" + id, now = Date.now();
      if (!adminReadAt.has(k) || now - adminReadAt.get(k) > 600e3) { adminReadAt.set(k, now); audit(me, "chats", id, "admin read"); }
    }
    const before = Number(url.searchParams.get("before")) || Infinity, limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 40));
    const a = chatIndex.get(id) || [], from = member ? joinedAt(c, name) : 0, picked = [];
    for (let i = a.length - 1; i >= 0 && picked.length < limit; i--) { if (a[i].ts >= before) continue; if (a[i].ts < from) break; picked.push(a[i]); }
    const more = picked.length === limit && a.some(e => e.ts < picked[picked.length - 1].ts && e.ts >= from);
    const msgs = picked.reverse().map(getMsg).filter(Boolean).map(m => msgOut(m, c, name, admin));
    return send(res, 200, { messages: msgs, more, chat: chatOut(c, name, admin, member) });
  }
  if (!member || c.deleted) return bad(403);

  if (act === "send" && post) {
    if (overRate(name, "msg", 60, 60e3) || overRate(name, "msgday", 1500, 86400e3)) return bad(429);
    const b = await body(); if (!b) return bad();
    const text = cleanText(b.text, MSG_MAX); if (!text) return bad();
    if (!c.members.some(u => u !== name && activePerson(u))) return bad();
    let reply = null, part = null;
    if (b.reply !== undefined && b.reply !== null) {
      if (typeof b.reply !== "string") return bad();
      const e = (chatIndex.get(id) || []).find(x => x.id === b.reply), src = e && e.ts >= joinedAt(c, name) ? getMsg(e) : null;
      if (!src) return bad();
      reply = { id: src.id, from: src.from, text: src.text.slice(0, 120) };
    }
    if (b.part !== undefined && b.part !== null) {
      const pid = b.part && typeof b.part.id === "string" ? b.part.id : null, r = pid ? load("parts").get(pid) : null;
      if (!r) return bad();
      part = { id: pid, name: String(r.name || "").slice(0, 120), reference: String(r.reference || "").slice(0, 80), machine: String(r.machine || "").slice(0, 40), month: String(r.month || ""), quantity: String(r.quantity == null ? "" : r.quantity).slice(0, 12) };
    }
    const ts = nextTs(), m = { id: ts + "-" + crypto.randomBytes(3).toString("hex"), chat: id, from: name, ts, text, reply, part, seen: {} };
    commit(monthOf(ts), m.id, m); indexMsg(m);
    const rd = load("chatreads").get(name) || { c: {}, m: {} }; commit("chatreads", name, { c: Object.assign({}, rd.c, { [id]: ts }), m: rd.m || {} });
    const to = new Set(c.members.concat(admins()));
    for (const u of to) { const uu = load("users").get(u); chatPushTo(u, { kind: "msg", chat: id, msg: msgOut(m, c, u, can(uu, "users")) }); }
    return send(res, 200, { ok: true, msg: msgOut(m, c, name, admin) });
  }
  if (act === "read" && post) {
    const b = await body(); const upTo = Math.min(Number(b && b.upTo) || 0, lastMsgTs);
    if (!upTo) return bad();
    const a = chatIndex.get(id) || [], from = joinedAt(c, name), now = Date.now(), done = [], authors = new Set();
    for (let i = a.length - 1; i >= 0 && done.length < 300; i--) {
      const e = a[i]; if (e.ts > upTo) continue; if (e.ts < from) break;
      if (e.from === name) continue;
      const m = getMsg(e); if (!m || (m.seen && m.seen[name])) { if (m) break; continue; }
      commit(monthOf(m.ts), m.id, Object.assign({}, m, { seen: Object.assign({}, m.seen, { [name]: now }) })); done.push(m.id); authors.add(m.from);
    }
    const rd = readsOf(name), prev = rd.c[id] || 0;
    if (upTo > prev) { rd.c[id] = upTo; commit("chatreads", name, rd); }
    if (done.length) for (const u of new Set(Array.from(authors).concat(admins()))) chatPushTo(u, { kind: "seen", chat: id, ids: done, by: name, at: now });
    chatPushTo(name, { kind: "read", chat: id });
    return send(res, 200, { ok: true, unread: unreadCount(c, name) });
  }
  if (act === "mute" && post) {
    const b = await body(); if (!b || typeof b.muted !== "boolean") return bad();
    const rd = readsOf(name); if (b.muted) rd.m[id] = true; else delete rd.m[id];
    commit("chatreads", name, rd); chatPushTo(name, { kind: "read", chat: id });
    return send(res, 200, { ok: true });
  }
  if (act === "members" && post) {
    if (c.type !== "group") return bad();
    const b = await body(); if (!b) return bad();
    const add = Array.isArray(b.add) ? b.add.filter(x => typeof x === "string") : [], rem = Array.isArray(b.remove) ? b.remove.filter(x => typeof x === "string") : [];
    const leaving = rem.length === 1 && rem[0] === name && !add.length;
    if (!admin && c.by !== name && !leaving) return bad(403);
    let members = c.members.slice(); const joined = Object.assign({}, c.joined), now = Date.now(), newcomers = [];
    for (const u of add) if (activePerson(u) && members.indexOf(u) < 0) { members.push(u); joined[u] = now; newcomers.push(u); }
    for (const u of rem) { if (u === c.by && !admin && !leaving) continue; members = members.filter(x => x !== u); }
    if (members.length < 2 || members.length > 30) return bad();
    const next = Object.assign({}, c, { members, joined }); commit("chats", id, next); audit(me, "chats", id, "members", add.concat(rem.map(x => "-" + x)));
    for (const u of new Set(c.members.concat(members))) chatPushTo(u, { kind: "chat", chat: id });
    return send(res, 200, { chat: chatOut(next, name, admin, isMember(next, name)) });
  }
  return bad(404);
}

// ---------- notifications (Web Push to phones and computers) ----------
// Off for everyone until 1 Jan 2027 (or until an admin starts them early); a test to one's own device works any time.
// Who gets what is set per person by an admin (notifyprefs); the devices are in pushsubs; both stay on the server.
// The message is encrypted for each device (RFC 8291) and signed with this server's own key (VAPID, vapid.json).
const NOTIFY_START = Date.UTC(2027, 0, 1);
const VAPID_FILE = path.join(DATA, "vapid.json");
let vapid = null;
function vapidKeys() {
  if (vapid) return vapid;
  let v = null;
  try { v = JSON.parse(fs.readFileSync(VAPID_FILE, "utf8")); } catch (e) {}
  if (!v || !v.jwk || !v.pub) {
    const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = privateKey.export({ format: "jwk" });
    v = { jwk, pub: Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url"), made: Date.now() };
    writeFileDurable(VAPID_FILE, JSON.stringify(v));
  }
  v.key = crypto.createPrivateKey({ key: v.jwk, format: "jwk" });
  vapid = v;
  return vapid;
}
const hmac256 = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
// RFC 8291 / RFC 8188 "aes128gcm": one record; opts (fixed salt and key) only for the test against the RFC example
function pushEncrypt(payload, uaPublic, authSecret, opts) {
  opts = opts || {};
  const ecdh = crypto.createECDH("prime256v1");
  if (opts.asPriv) ecdh.setPrivateKey(opts.asPriv); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(), secret = ecdh.computeSecret(uaPublic);
  const ikm = hmac256(hmac256(authSecret, secret), Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const salt = opts.salt || crypto.randomBytes(16), prk = hmac256(salt, ikm);
  const cek = hmac256(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16);
  const nonce = hmac256(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPublic.length;
  return Buffer.concat([head, asPublic, ct]);
}
const vapidCache = new Map();
function vapidAuth(endpoint) {
  const aud = new URL(endpoint).origin, now = Math.floor(Date.now() / 1000), c = vapidCache.get(aud);
  if (c && c.exp - now > 3600) return c.h;
  const v = vapidKeys(), exp = now + 12 * 3600, enc = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const st = load("notifystate").get("site") || {};
  const data = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud, exp, sub: st.origin || "https://localhost" });
  const sig = crypto.sign("sha256", Buffer.from(data), { key: v.key, dsaEncoding: "ieee-p1363" }).toString("base64url");
  const h = "vapid t=" + data + "." + sig + ", k=" + v.pub;
  vapidCache.set(aud, { exp, h });
  return h;
}
// only the browsers' own push services: nothing else on the internet (or on this machine) can be made a target
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^[a-z0-9-]+\.notify\.windows\.com$/, /^([a-z0-9-]+\.)*push\.apple\.com$/];
function pushEndpointOk(u) {
  if (typeof u !== "string" || u.length > 1000) return false;
  try {
    const x = new URL(u);
    if (process.env.UII_PUSH_TEST === "1" && x.protocol === "http:" && x.hostname === "127.0.0.1") return true;   // tests only
    return x.protocol === "https:" && !x.port && !x.username && !x.password && PUSH_HOSTS.some(r => r.test(x.hostname));
  } catch (e) { return false; }
}
function pushSend(sub, payload, urgency) {
  return new Promise(resolve => {
    let body;
    try { body = pushEncrypt(JSON.stringify(payload), Buffer.from(sub.p256dh, "base64url"), Buffer.from(sub.auth, "base64url")); } catch (e) { return resolve(0); }
    let u; try { u = new URL(sub.endpoint); } catch (e) { return resolve(0); }
    const req = (u.protocol === "http:" ? http : https).request(u, { method: "POST", timeout: 15000, headers: {
      "Content-Type": "application/octet-stream", "Content-Encoding": "aes128gcm", "Content-Length": body.length, TTL: "86400",
      Urgency: urgency || "normal", Authorization: vapidAuth(sub.endpoint) } }, r => { r.resume(); resolve(r.statusCode || 0); });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(0));
    req.end(body);
  });
}
async function pushToUser(username, payload, urgency) {
  if (isBroken("pushsubs")) return 0;
  let sent = 0;
  for (const [id, s] of Array.from(load("pushsubs")).filter(([, x]) => x.user === username)) {
    const code = await pushSend(s, payload, urgency);
    if (code === 404 || code === 410) commit("pushsubs", id);           // the device let it go
    else if (code >= 200 && code < 300) sent++;
    else console.error("[notify] push to a device of " + username + " answered " + code);
  }
  return sent;
}
function notifyFeature() { return (load("meta").get("features") || {}).notify === true; }
function notifyLive() { return Date.now() >= NOTIFY_START || notifyFeature(); }
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/, DAYS_RE = /^([0-6](,[0-6]){0,6})?$/;
function prefsOf(u) {
  const p = load("notifyprefs").get(u) || {};
  return { on: p.on === true, receive: p.receive !== false, transfer: p.transfer !== false, approvals: p.approvals !== false, stock: p.stock !== false,
    shiftStart: HM_RE.test(p.shiftStart || "") ? p.shiftStart : "", shiftEnd: HM_RE.test(p.shiftEnd || "") ? p.shiftEnd : "", shiftDays: DAYS_RE.test(p.shiftDays || "") ? p.shiftDays || "" : "" };
}
function notifyPeople(cat, exclude, also) {
  const out = [];
  for (const [k, u] of load("users")) {
    if (u.active === false || exclude.has(k)) continue;
    const p = prefsOf(k);
    if (!p.on || (cat && !p[cat]) || (also && !also(u))) continue;
    out.push(k);
  }
  return out;
}
function notifyAll(people, payload, urgency) { people.forEach(k => { pushToUser(k, payload, urgency).catch(e => console.error("[notify] " + e.message)); }); }
const firstName = n => String(n || "").trim().split(/\s+/)[0] || "";
const signed = (q, inn) => (inn ? "+" : "−") + q;
// A movement waits 4 seconds before it is announced: when it is an approver applying someone's request,
// the request's decision arrives right with it and the notice then carries the requester's name.
const recentDecisions = [];
function notifyAfterWrite(me, coll, id, d, cur) {
  if (!notifyLive() || !d) return;
  if (coll === "transactions" && !cur && !d.source && Number(d.change)) {
    const item = { d, at: Date.now(), actor: me.name || me.username, user: me.username };
    const t = setTimeout(() => { try { announceMove(item); } catch (e) { console.error("[notify] " + e.message); } }, 4000); if (t.unref) t.unref();
  }
  if (coll === "pendops" && !cur && d.status === "waiting") announceRequest(id, d);
  if (coll === "pendops" && cur && cur.status === "waiting" && (d.status === "approved" || d.status === "rejected")) {
    recentDecisions.push({ at: Date.now(), d, by: me.username });
    while (recentDecisions.length && Date.now() - recentDecisions[0].at > 60e3) recentDecisions.shift();
    const p = prefsOf(d.user), ok = d.status === "approved";
    if (p.on) notifyAll([d.user], { title: "Request " + (ok ? "Approved" : "Rejected") + " – " + (d.partName || "Part"),
      body: (d.mode === "in" ? "Receive " : "Transfer ") + signed(d.qty, d.mode === "in") + (d.machine ? " · Machine " + d.machine : "") + "\n" + (ok ? "Approved" : "Rejected") + " by " + (me.name || me.username),
      tag: "req-" + id }, ok ? "normal" : "high");
  }
}
function announceMove(item) {
  const t = item.d, ch = Number(t.change), inn = ch > 0, q = Math.abs(ch);
  const dec = recentDecisions.find(x => !x.used && x.d.status === "approved" && x.by === item.user && String(x.d.partId) === String(t.partId) &&
    Number(x.d.qty) === q && (x.d.mode === "in") === inn && Math.abs(x.at - item.at) < 20e3);
  let actor = item.actor; const ex = new Set([item.user]);
  if (dec) { dec.used = true; actor = dec.d.name || dec.d.user; ex.add(dec.d.user); }
  const part = load("parts").get(String(t.partId)) || {};
  const name = part.name || t.name || "Part", ref = part.reference || t.reference || "", mach = t.machine || part.machine || "";
  const after = wholeNum(t.after);
  notifyAll(notifyPeople(inn ? "receive" : "transfer", ex), { title: actor + " – " + (inn ? "Goods Received" : "Stock Issued"),
    body: name + (ref ? " · Ref " + ref : "") + "\n" + (mach ? "Machine " + mach + " · " : "") + "Quantity " + signed(q, inn) + (after === null ? "" : " · Available " + after) });
  if (!inn && after !== null) {
    const min = wholeNum(part.min), out = after === 0, low = !out && min !== null && after < min;
    if (out || low) notifyAll(notifyPeople("stock", ex), { title: name + " – " + (out ? "Out of Stock" : "Below Minimum"),
      body: (ref ? "Ref " + ref + "\n" : "") + (mach ? "Machine " + mach + " · " : "") + "Available " + after + (min !== null ? " · Min " + min : ""), tag: "stock-" + t.partId }, "high");
  }
}
function announceRequest(id, d) {
  const part = load("parts").get(String(d.partId)) || {}, avail = wholeNum(part.quantity);
  notifyAll(notifyPeople("approvals", new Set([d.user, d.createdBy]), u => can(u, "approve")), {
    title: (d.name || d.user) + " – Approval Required",
    body: (d.partName || "Part") + (d.reference ? " · Ref " + d.reference : "") + "\n" + (d.machine ? "Machine " + d.machine + " · " : "") +
      (d.mode === "in" ? "Receive " : "Transfer ") + signed(d.qty, d.mode === "in") + (avail === null ? "" : " · Available " + avail),
    tag: "req-" + id, pend: id }, "high");
}
// ---- the thank-you at the end of each person's shift (times are the server's clock: UTC, the same as Accra) ----
function hmToMin(v) { return HM_RE.test(v || "") ? +v.slice(0, 2) * 60 + +v.slice(3) : null; }
function shiftSummary(user, from, to) {
  let inn = 0, out = 0;
  const approved = [];
  for (const [, p] of load("pendops")) {
    if (p.status === "approved" && p.decidedTs >= from - 60e3) approved.push(p);
    if (p.user === user && p.ts >= from && p.ts <= to && p.status !== "rejected") { if (p.mode === "in") inn++; else out++; }
  }
  for (const [, t] of load("transactions")) {
    if (t._by !== user || t.source || !(t.ts >= from && t.ts <= to)) continue;
    const ch = Number(t.change); if (!ch) continue;
    // an approver applying someone else's request: that movement counts for the person who asked
    if (approved.some(p => String(p.partId) === String(t.partId) && Number(p.qty) === Math.abs(ch) && Math.abs(p.decidedTs - t.ts) < 30e3)) continue;
    if (ch > 0) inn++; else out++;
  }
  return { inn, out };
}
function shiftTick(nowMs) {
  if (!notifyLive() || isBroken("notifystate")) return;
  const now = new Date(nowMs || Date.now()), hm = now.getUTCHours() * 60 + now.getUTCMinutes();
  for (const [k, u] of load("users")) {
    if (u.active === false) continue;
    const p = prefsOf(k), s = hmToMin(p.shiftStart), e = hmToMin(p.shiftEnd);
    if (!p.on || s === null || e === null || s === e || hm < e || hm > e + 30) continue;   // up to 30 minutes late (a restart)
    const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (e < s) startDay.setUTCDate(startDay.getUTCDate() - 1);                          // a night shift began yesterday
    if (p.shiftDays.split(",").indexOf(String(startDay.getUTCDay())) < 0) continue;
    const id = "thx-" + k + "-" + startDay.toISOString().slice(0, 10);
    if (load("notifystate").get(id)) continue;
    commit("notifystate", id, { at: now.getTime() });
    const from = startDay.getTime() + s * 60e3, to = startDay.getTime() + (e < s ? 1440 + e : e) * 60e3;
    const c = shiftSummary(k, from, to), n = c.inn + c.out;
    const parts = [n + (n === 1 ? " movement" : " movements") + " recorded"];
    if (c.inn) parts.push(c.inn + " received");
    if (c.out) parts.push(c.out + " issued");
    notifyAll([k], { title: "Thank you for today, " + firstName(u.name || k),
      body: (n ? parts.join(" · ") + "\n" : "") + (e < 12 * 60 ? "Have a good rest." : "Have a good evening."), tag: "thanks" });
  }
  // old markers go after two weeks
  if (now.getUTCMinutes() === 0) for (const [id, v] of Array.from(load("notifystate"))) if (id.startsWith("thx-") && now.getTime() - v.at > 14 * 86400e3) commit("notifystate", id);
}
async function handleNotify(req, res, me, url, p) {
  const admin = can(me, "users"), sub = p.slice("/api/notify".length).replace(/^\//, ""), getMethod = req.method === "GET", post = req.method === "POST";
  const bad = c => send(res, c || 400, { code: c === 403 ? "not_granted" : c === 404 ? "not_found" : c === 429 ? "rate_limited" : "invalid_argument" });
  if (["pushsubs", "notifyprefs", "notifystate", "meta"].some(isBroken)) return send(res, 503, { code: "unavailable" });
  const body = async () => { const b = await readBody(req, 8192); return b && typeof b === "object" && !Array.isArray(b) ? b : null; };
  const mySubs = () => Array.from(load("pushsubs")).filter(([, x]) => x.user === me.username);
  if (sub === "boot" && getMethod) {
    return send(res, 200, { live: notifyLive(), early: notifyFeature(), start: NOTIFY_START, key: vapidKeys().pub, admin, prefs: prefsOf(me.username), devices: mySubs().length });
  }
  if (sub === "subscribe" && post) {
    const b = await body(); if (!b) return bad();
    const k = b.keys || {}, pk = typeof k.p256dh === "string" ? Buffer.from(k.p256dh, "base64url") : null, au = typeof k.auth === "string" ? Buffer.from(k.auth, "base64url") : null;
    if (!pushEndpointOk(b.endpoint) || !pk || pk.length !== 65 || pk[0] !== 4 || !au || au.length !== 16) return bad();
    if (overRate(me.username, "pushsub", 30)) return bad(429);
    const host = String(req.headers.host || "");
    if (/^[a-z0-9.-]{1,200}$/i.test(host) && host !== "127.0.0.1" && host !== "localhost") {
      const st = load("notifystate").get("site") || {};
      if (st.origin !== "https://" + host) { commit("notifystate", "site", { origin: "https://" + host, at: Date.now() }); vapidCache.clear(); }
    }
    const id = "s" + crypto.createHash("sha256").update(b.endpoint).digest("hex").slice(0, 32);
    const mine = mySubs().filter(([sid]) => sid !== id).sort((a, c) => a[1].created - c[1].created);
    while (mine.length >= 8) commit("pushsubs", mine.shift()[0]);   // at most 8 devices a person
    const cur = load("pushsubs").get(id);
    if (cur && cur.user !== me.username) commit("pushsubs", id);   // the device changed hands
    commit("pushsubs", id, { user: me.username, endpoint: b.endpoint, p256dh: k.p256dh, auth: k.auth, created: Date.now(), ua: shortText(String(b.ua || ""), 120) ? String(b.ua || "") : "" });
    audit(me, "pushsubs", id, "device on");
    return send(res, 200, { ok: true, devices: mySubs().length });
  }
  if (sub === "unsubscribe" && post) {
    const b = await body(); if (!b || typeof b.endpoint !== "string") return bad();
    const id = "s" + crypto.createHash("sha256").update(b.endpoint).digest("hex").slice(0, 32), cur = load("pushsubs").get(id);
    if (cur && cur.user === me.username) { commit("pushsubs", id); audit(me, "pushsubs", id, "device off"); }
    return send(res, 200, { ok: true, devices: mySubs().length });
  }
  if (sub === "test" && post) {
    if (overRate(me.username, "pushtest", 10)) return bad(429);
    const n = await pushToUser(me.username, { title: "UII Parts – Test", body: "Notifications work on this device.", tag: "test" });
    return send(res, 200, { ok: true, sent: n, devices: mySubs().length });
  }
  if (sub === "people" && getMethod) {
    if (!admin) return bad(403);
    const devs = {}; for (const [, x] of load("pushsubs")) devs[x.user] = (devs[x.user] || 0) + 1;
    const people = Array.from(load("users")).filter(([, u]) => u.active !== false).map(([k, u]) => ({ username: k, name: u.name || k, approver: can(u, "approve"), prefs: prefsOf(k), devices: devs[k] || 0 }));
    return send(res, 200, { people });
  }
  if (sub === "prefs" && post) {
    if (!admin) return bad(403);
    const b = await body(); if (!b || typeof b.username !== "string" || !load("users").get(b.username)) return bad();
    const v = {};
    for (const f of ["on", "receive", "transfer", "approvals", "stock"]) { if (typeof b[f] !== "boolean") return bad(); v[f] = b[f]; }
    for (const f of ["shiftStart", "shiftEnd"]) { const x = String(b[f] || ""); if (x && !HM_RE.test(x)) return bad(); v[f] = x; }
    const days = String(b.shiftDays || ""); if (!DAYS_RE.test(days)) return bad(); v.shiftDays = days;
    commit("notifyprefs", b.username, Object.assign(v, { by: me.username, at: Date.now() }));
    audit(me, "notifyprefs", b.username, "change");
    return send(res, 200, { ok: true, prefs: prefsOf(b.username) });
  }
  if (sub === "tick" && post && process.env.UII_PUSH_TEST === "1" && admin) {   // tests only: run the end-of-shift check at a given time
    const b = await body(); shiftTick(b && b.now); return send(res, 200, { ok: true });
  }
  if (sub === "switch" && post) {
    if (!admin) return bad(403);
    const b = await body(); if (!b || typeof b.on !== "boolean") return bad();
    commit("meta", "features", Object.assign({}, load("meta").get("features") || {}, { notify: b.on, notifyBy: me.username, notifyAt: Date.now() }));
    audit(me, "meta", "features", "notify " + (b.on ? "on" : "off"));
    return send(res, 200, { ok: true, live: notifyLive() });
  }
  return bad(404);
}

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
else { openStore(); buildChatIndex(); pruneCopies(); pruneActivity(); setInterval(() => { try { shiftTick(); } catch (e) { console.error("[notify] " + e.message); } }, 60e3).unref(); setInterval(pruneCopies, 6 * 3600e3).unref(); setInterval(pruneActivity, 6 * 3600e3).unref();
  server.headersTimeout = 15e3; server.requestTimeout = 30e3; server.keepAliveTimeout = 5e3; server.maxConnections = 300; server.listen(PORT, "127.0.0.1", () => console.log("UII Parts on 127.0.0.1:" + PORT + ", data in " + DATA)); }
