"use strict";
// UII Parts server: serves the page, keeps the data, checks sign-in.
// No packages needed: Node's own http, crypto and fs.
//   PORT  (default 3000, listens on 127.0.0.1 only; Caddy sits in front with HTTPS)
//   DATA  (default ./data) folder for the collections, accounts and sessions
// Make or reset an admin from the shell:  uii-admin   (stops the service, runs "server.js make-admin", starts it again)
const http = require("http"), crypto = require("crypto"), fs = require("fs"), path = require("path");

const PORT = +process.env.PORT || 3000;
const DATA = path.resolve(process.env.DATA || path.join(__dirname, "data"));
const PAGE = path.join(__dirname, "public", "index.html");
const DAYS = 90, COOKIE = "uiis", MAX_BODY = 8 * 1024 * 1024;
const COLL_RE = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/, ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;
// what a permission lets a person write
const WRITE_PERMS = ["receive", "transfer", "edit", "editRef", "delete", "approve", "backup", "users", "order"];

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
function wrongTry(ip) { const t = tries.get(ip); if (!t || Date.now() - t.at > 15 * 60e3) tries.set(ip, { n: 1, at: Date.now() }); else t.n++; }

// ---------- live updates (Server-Sent Events) ----------
const listeners = new Set();
function broadcast(coll, id, data) {
  const msg = "data: " + JSON.stringify({ c: coll, id, d: data === undefined ? null : publicDoc(coll, data), del: data === undefined }) + "\n\n";
  for (const l of listeners) if (l.colls.has(coll)) l.res.write(msg);
}
setInterval(() => { for (const l of listeners) l.res.write(": ping\n\n"); }, 25e3).unref();

// accounts go out without their password hash
function publicDoc(coll, d) {
  if (coll !== "users") return d;
  const o = Object.assign({}, d); delete o.pw; delete o.hash; return o;
}
function can(u, p) { return !!(u && u.active !== false && u.perms && u.perms[p]); }
function adminsLeft(users) { let n = 0; for (const [, u] of users) if (u.active !== false && u.perms && u.perms.users) n++; return n; }

function actlogAdd(u, what, part) {
  const id = "srv" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), now = Date.now();
  const d = { ts: now, seq: now, user: u.username, name: u.name || u.username, via: "", what, part: part || "", from: "", to: "" };
  commit("actlog", id, d); broadcast("actlog", id, d);
}

// ---------- the rules for each write ----------
function checkWrite(me, coll, id, body, del) {
  if (coll.startsWith("_")) return "not_granted";
  const cur = load(coll).get(id);
  if (coll === "users") {
    if (!can(me, "users")) return "not_granted";
    const users = load("users");
    if (del) {
      if (id === me.username) return "invalid_argument";
      const copy = new Map(users); copy.delete(id);
      return adminsLeft(copy) ? "" : "invalid_argument";
    }
    if (!body || body.username !== id || !/^[a-z0-9._-]{2,30}$/.test(id)) return "invalid_argument";
    if (!cur && !(typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash))) return "invalid_argument";
    const copy = new Map(users); copy.set(id, body);
    return adminsLeft(copy) ? "" : "invalid_argument";
  }
  if (coll === "actlog") {
    if (del) return "not_granted";
    if (!body || typeof body.user !== "string") return "invalid_argument";
    if (cur && cur.user !== body.user) return "not_granted";
    return "";
  }
  if (!WRITE_PERMS.some(p => can(me, p))) return "not_granted";
  return "";
}
function applyWrite(me, coll, id, body, del) {
  const m = load(coll);
  if (del) {
    if (!m.has(id)) return;
    commit(coll, id);
    if (coll === "users") dropSessionsOf(id);
    broadcast(coll, id, undefined);
    return;
  }
  let d = body, hadPw = false;
  if (coll === "users") {
    const cur = m.get(id) || {};
    hadPw = !!cur.pw;
    d = Object.assign({}, body);
    delete d.hash;
    d.pw = typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash) ? pwMake(body.hash) : cur.pw;
  }
  commit(coll, id, d);                                    // the account first; only then sign that person out
  if (coll === "users" && ((body.hash && hadPw) || d.active === false)) {
    try { dropSessionsOf(id); } catch (e) { console.error("[storage] could not sign out " + id + ": " + e.message); }
  }
  broadcast(coll, id, d);
}

// ---------- http ----------
function send(res, code, obj, extra) {
  const body = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ "Content-Type": typeof obj === "string" ? "text/plain; charset=utf-8" : "application/json", "Cache-Control": "no-store" }, extra || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let n = 0; const parts = [];
    req.on("data", c => { n += c.length; if (n > MAX_BODY) { bad(Object.assign(new Error("too big"), { code: 413 })); req.destroy(); } else parts.push(c); });
    req.on("end", () => { try { ok(n ? JSON.parse(Buffer.concat(parts).toString("utf8")) : null); } catch (e) { bad(Object.assign(e, { code: 400 })); } });
    req.on("error", bad);
  });
}
function ipOf(req) { return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim(); }
const SECURITY = {
  "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Frame-Options": "SAMEORIGIN",
  "Strict-Transport-Security": "max-age=31536000"
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), p = url.pathname;
    for (const k in SECURITY) res.setHeader(k, SECURITY[k]);

    if (req.method === "GET" && (p === "/" || p === "/index.html")) {
      return fs.readFile(PAGE, (e, buf) => {
        if (e) return send(res, 500, "page missing");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); res.end(buf);
      });
    }
    if (req.method === "HEAD" && (p === "/" || p === "/index.html")) { res.writeHead(200, { "Cache-Control": "no-store" }); return res.end(); }
    if (!p.startsWith("/api/")) return send(res, 404, "not found");
    if (isBroken("users") || isBroken("_sessions")) return send(res, 503, { code: "unavailable" });
    // writes must come from the page itself (a cross-site form cannot set this header)
    if (req.method !== "GET" && req.headers["x-uii"] !== "1") return send(res, 403, { code: "not_granted" });

    if (p === "/api/login" && req.method === "POST") {
      const ip = ipOf(req);
      if (tooMany(ip)) return send(res, 429, { code: "rate_limited" });
      const b = await readBody(req) || {};
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
      if (w) { try { commit("_sessions", w.key); } catch (e) {} }
      return send(res, 200, { ok: true }, { "Set-Cookie": COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
    }

    const w = whoIs(req);
    if (!w) return send(res, 401, { code: "signed_out" });
    const me = w.user;

    if (p === "/api/me") return send(res, 200, { username: me.username });

    if (p === "/api/live" && req.method === "GET") {
      const cs = new Set(String(url.searchParams.get("c") || "").split(",").filter(c => COLL_RE.test(c) && !c.startsWith("_")));
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
      res.write("retry: 3000\n\n");
      const l = { res, colls: cs, user: me.username };
      listeners.add(l);
      req.on("close", () => listeners.delete(l));
      return;
    }

    const m = p.match(/^\/api\/c\/([^/]+)(?:\/([^/]+))?$/);
    if (!m) return send(res, 404, { code: "not_found" });
    const coll = decodeURIComponent(m[1]), id = m[2] ? decodeURIComponent(m[2]) : null;
    if (!COLL_RE.test(coll) || coll.startsWith("_") || (id !== null && !ID_RE.test(id))) return send(res, 400, { code: "invalid_argument" });

    if (req.method === "GET" && isBroken(coll)) return send(res, 503, { code: "unavailable" });
    if (req.method === "GET" && id === null) {
      const out = [];
      for (const [k, d] of load(coll)) out.push([k, publicDoc(coll, d)]);
      return send(res, 200, out);
    }
    if (req.method === "GET") {
      const d = load(coll).get(id);
      return send(res, 200, d ? { exists: true, d: publicDoc(coll, d) } : { exists: false });
    }
    if (req.method === "PUT" || req.method === "DELETE") {
      const del = req.method === "DELETE";
      const body = del ? null : await readBody(req);
      if (!del && (!body || typeof body !== "object" || Array.isArray(body))) return send(res, 400, { code: "invalid_argument" });
      const why = checkWrite(me, coll, id, body, del);
      if (why) return send(res, why === "not_granted" ? 403 : 400, { code: why });
      applyWrite(me, coll, id, body, del);
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
  if (!/^[a-z0-9._-]{2,30}$/.test(username)) { console.error("Username: 2 to 30 small letters or numbers."); process.exit(1); }
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
  closeStore();
  console.log("Admin ready: " + username);
}

if (process.argv[2] === "make-admin") makeAdmin();
else { openStore(); server.listen(PORT, "127.0.0.1", () => console.log("UII Parts on 127.0.0.1:" + PORT + ", data in " + DATA)); }
