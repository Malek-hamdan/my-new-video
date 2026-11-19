"use strict";
// UII Parts server: serves the page, keeps the data, checks sign-in.
// No packages needed: Node's own http, crypto and fs.
//   PORT  (default 3000, listens on 127.0.0.1 only; Caddy sits in front with HTTPS)
//   DATA  (default ./data) folder for the collections, accounts and sessions
// Make or reset an admin from the shell:  node server.js make-admin   (asks for name and password)
const http = require("http"), crypto = require("crypto"), fs = require("fs"), path = require("path");

const PORT = +process.env.PORT || 3000;
const DATA = path.resolve(process.env.DATA || path.join(__dirname, "data"));
const PAGE = path.join(__dirname, "public", "index.html");
const DAYS = 90, COOKIE = "uiis", MAX_BODY = 8 * 1024 * 1024;
const COLL_RE = /^[A-Za-z][A-Za-z0-9_-]{0,40}$/, ID_RE = /^[A-Za-z0-9._:-]{1,120}$/;
// what a permission lets a person write
const WRITE_PERMS = ["receive", "transfer", "edit", "editRef", "delete", "approve", "backup", "users", "order"];

fs.mkdirSync(path.join(DATA, "c"), { recursive: true });

// ---------- storage: one JSON file per collection, written whole and swapped in ----------
const colls = new Map(), dirty = new Set();
let flushTimer = null;
function load(name) {
  if (colls.has(name)) return colls.get(name);
  let m = new Map();
  try { const o = JSON.parse(fs.readFileSync(path.join(DATA, "c", name + ".json"), "utf8")); m = new Map(Object.entries(o)); } catch (e) {}
  colls.set(name, m);
  return m;
}
function writeFileSafe(file, text) {
  const tmp = file + ".tmp";
  const fd = fs.openSync(tmp, "w");
  fs.writeSync(fd, text); fs.fsyncSync(fd); fs.closeSync(fd);
  fs.renameSync(tmp, file);
}
function flush() {
  flushTimer = null;
  for (const name of dirty) {
    try { writeFileSafe(path.join(DATA, "c", name + ".json"), JSON.stringify(Object.fromEntries(load(name)))); }
    catch (e) { console.error("write failed", name, e.message); }
  }
  dirty.clear();
}
function touch(name) { dirty.add(name); if (!flushTimer) flushTimer = setTimeout(flush, 150); }
process.on("SIGTERM", () => { flush(); process.exit(0); });
process.on("SIGINT", () => { flush(); process.exit(0); });

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
  sessions().set(tokenKey(t), { user, exp: Date.now() + DAYS * 864e5 });
  touch("_sessions");
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
  if (!s || s.exp < Date.now()) { if (s) { sessions().delete(k); touch("_sessions"); } return null; }
  const u = load("users").get(s.user);
  if (!u || u.active === false) return null;
  return { key: k, user: u };
}
function dropSessionsOf(username) {
  let n = 0;
  for (const [k, s] of sessions()) if (s.user === username) { sessions().delete(k); n++; }
  if (n) touch("_sessions");
}
setInterval(() => { // clear old sessions once an hour
  let n = 0; const now = Date.now();
  for (const [k, s] of sessions()) if (s.exp < now) { sessions().delete(k); n++; }
  if (n) touch("_sessions");
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
  load("actlog").set(id, d); touch("actlog"); broadcast("actlog", id, d);
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
    m.delete(id); touch(coll);
    if (coll === "users") dropSessionsOf(id);
    broadcast(coll, id, undefined);
    return;
  }
  let d = body;
  if (coll === "users") {
    const cur = m.get(id) || {};
    d = Object.assign({}, body);
    delete d.hash;
    d.pw = typeof body.hash === "string" && /^[0-9a-f]{64}$/.test(body.hash) ? pwMake(body.hash) : cur.pw;
    if (body.hash && cur.pw) dropSessionsOf(id);          // a new password signs that person out everywhere
    if (d.active === false) dropSessionsOf(id);
  }
  m.set(id, d); touch(coll);
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
      actlogAdd(u, "Signed in", "");
      return send(res, 200, { username: name }, { "Set-Cookie": COOKIE + "=" + t + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + DAYS * 86400 });
    }
    if (p === "/api/logout" && req.method === "POST") {
      const w = whoIs(req);
      if (w) { sessions().delete(w.key); touch("_sessions"); }
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
    if (!res.headersSent) send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { code: e.code === 413 ? "too_big" : e.code === 400 ? "invalid_argument" : "internal" });
    if (!e.code) console.error(e);
  }
});

// ---------- make or reset an admin from the shell ----------
async function makeAdmin() {
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
  const name = (process.env.ADMIN_NAME || await ask("Full name: ")).trim() || username;
  const p1 = await ask("Password (at least 8 characters): ", true);
  const p2 = await ask("Password again: ", true);
  rl.close();
  if (p1.length < 8) { console.error("Too short."); process.exit(1); }
  if (p1 !== p2) { console.error("The two passwords are not the same."); process.exit(1); }
  const perms = { receive: 1, transfer: 1, edit: 1, editRef: 1, "delete": 1, order: 1, "export": 1, backup: 1, activity: 1, users: 1, approve: 1 };
  const users = load("users"), cur = users.get(username) || {};
  users.set(username, Object.assign({}, cur, { username, name, role: "admin", perms, active: true, created: cur.created || Date.now(), pw: pwMake(clientHash(username, p1)) }));
  touch("users"); flush();
  console.log("Admin ready: " + username);
}

if (process.argv[2] === "make-admin") makeAdmin();
else server.listen(PORT, "127.0.0.1", () => console.log("UII Parts on 127.0.0.1:" + PORT + ", data in " + DATA));
