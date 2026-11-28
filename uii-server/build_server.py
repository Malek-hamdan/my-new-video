"""Build the page the server hands out, from the accounts demo (which is built from the real site).

Reads  uii-roles-demo/index.html  and writes  uii-server/public/index.html.
Changes: own storage keys (uiip-), the real unlock code, no demo strip, no sample accounts,
sign-in checked by the server, and shim.js in front so the page's "db" talks to the server.
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "uii-roles-demo", "index.html")
OUT = os.path.join(HERE, "public", "index.html")
s = open(SRC, encoding="utf-8").read()

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit("expected %d, found %d: %r" % (n, c, old[:90]))
    s = s.replace(old, new)

s = s.replace('"uiird-', '"uiip-')
# the month unlock code is the same as on the original site
rep('"uiip-lock:', '"uii-lock:')
s, k = re.subn(r"var UNLOCK_HASH = 0x[0-9a-f]{8};", "var UNLOCK_HASH = 0x66d60d02;", s)
if k != 1: sys.exit("unlock hash not found")
rep('<title>UII Roles Demo</title>', '<title>UII Parts</title>')
rep('<meta name="theme-color" content="#0b0d12">', '<meta name="theme-color" content="#0f4c81">')
# installable as an app (Edge / Chrome: Install this site as an app), with the UII icon
rep('<title>UII Parts</title>', '<title>UII Parts</title>\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
rep('<div class="demo-strip">DEMO &middot; accounts and roles test &middot; separate from the real site</div>\n', '')
rep('  // Demo only: the checks run in this page. The real version keeps them on a server.\n',
    '  // The server checks the password and keeps the accounts; the page shows what each person may do.\n')
# no sample accounts: the first admin is made on the server
rep('    if (!Object.keys(users).length) { seedUsers(); return; }\n', '')
# sign-in goes to the server
a = s.index('    if (!usersLoaded) { fail("Loading accounts. Try again in a moment."); return; }')
b = s.index('}, function () { fail("This browser can\'t check passwords here."); });', a) + len('}, function () { fail("This browser can\'t check passwords here."); });')
s = s[:a] + '''    if (!name || !pass) { fail("Enter your username and password."); return; }
    passHash(name, pass).then(function (h) { return window.uiiServer.login(name, h); }).then(function (r) {
      if (!r.ok) {
        fail(r.code === "off" ? "This account is turned off. Ask the administrator." : r.code === "rate_limited" ? "Too many wrong tries. Wait 15 minutes." : "Wrong username or password.");
        return;
      }
      try { sessionStorage.setItem(SESSION_KEY, name); } catch (er) {}
      err.hidden = true; pIn.value = "";
      if (usersLoaded) { refreshMe(); renderRows(); }
    }, function () { fail("No connection to the server. Try again."); });''' + s[b:]
rep('''    me = null; mineNew = {};
    refreshMe();''', '''    me = null; mineNew = {};
    refreshMe();
    window.uiiServer.logout();''')
s = re.sub(r"  /\* Accounts and permissions \(demo\) \*/\n  \.demo-strip \{[^\n]*\n", "  /* Accounts and permissions */\n", s)
rep("  // the first time, the demo starts with five people\n", "")
shim = open(os.path.join(HERE, "shim.js"), encoding="utf-8").read()
rep('<script>\n', '<script>\n' + shim + '</script>\n<script>\n')
# Messages (private chats and groups): its style and its script, at the end of the page
msgcss = open(os.path.join(HERE, "messages.css"), encoding="utf-8").read()
msgjs = open(os.path.join(HERE, "messages.js"), encoding="utf-8").read()
rep('</head>', '<style>\n' + msgcss + '</style>\n</head>')
rep('</body>', '<script>\n' + msgjs + '</script>\n</body>')
# Notifications (device on/off, who gets what, shifts; approving a request from a notification)
ntcss = open(os.path.join(HERE, "notify.css"), encoding="utf-8").read()
ntjs = open(os.path.join(HERE, "notify.js"), encoding="utf-8").read()
rep('</head>', '<style>\n' + ntcss + '</style>\n</head>')
rep('</body>', '<script>\n' + ntjs + '</script>\n</body>')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(s)
print("wrote", OUT, len(s))
