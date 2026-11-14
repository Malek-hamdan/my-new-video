"""Build the accounts-and-roles demo from the real site, without touching it.

Reads  uii-parts/index.html  and writes  uii-roles-demo/index.html.
The demo keeps its own storage keys (uiird-), its own unlock code (1234)
and adds username/password sign-in, per-person permissions and an Activity log.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "uii-parts", "index.html")
OUT = os.path.join(HERE, "index.html")

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode():
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return h

s = open(SRC, encoding="utf-8").read()

def rep(old, new, n=1):
    global s
    c = s.count(old)
    if c != n:
        sys.exit("expected %d, found %d: %r" % (n, c, old[:90]))
    s = s.replace(old, new)

# its own storage keys and unlock code
s = s.replace('"uii-', '"uiird-')
rep('var UNLOCK_HASH = 0x66d60d02;', 'var UNLOCK_HASH = 0x%08x;' % fnv('uiird-lock:1234'))
rep('<title>UII Spare Parts</title>', '<title>UII Roles Demo</title>')

# ---------- CSS
rep('  /* Two areas: Spare Parts and Equipment */', '''  /* Accounts and permissions (demo) */
  .demo-strip { position: relative; z-index: 5; background: #ffd666; color: #1a1300; text-align: center; font: 700 14px system-ui, Arial; padding: 7px 12px; letter-spacing: .03em; }
  .cell.pass.ln { letter-spacing: 0.02em; text-align: left; font-size: 16px; }
  .gate-note { margin-top: 14px; color: var(--muted); font-size: 12px; }
  .me-chip { display: flex; align-items: center; gap: 10px; padding: 5px 8px 5px 6px; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--surface-2); }
  .me-chip[hidden] { display: none; }
  .me-chip .av { width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: #06101f; display: flex; align-items: center; justify-content: center; font-weight: 800; }
  .me-chip .me-txt { display: flex; flex-direction: column; line-height: 1.15; }
  .me-chip .who { font-weight: 700; font-size: 14px; }
  .me-chip .role { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .me-chip .btn { padding: 5px 10px; font-size: 12px; }
  body.signed-in:not(.can-transfer) #transferBtn, body.signed-in:not(.can-transfer) #blankBtn, body.signed-in:not(.can-transfer) .tx-print,
  body.signed-in:not(.can-receive) #receiveBtn,
  body.signed-in:not(.can-receive):not(.can-edit) #recvTop, body.signed-in:not(.can-receive):not(.can-edit) #recvBottom,
  body.signed-in:not(.can-edit) #addTop, body.signed-in:not(.can-edit) #addBottom, body.signed-in:not(.can-edit) .stepper,
  body.signed-in:not(.can-edit) #lockBtn, body.signed-in:not(.can-edit) #copyBanner,
  body.signed-in:not(.can-delete) .del,
  body.signed-in:not(.can-order) #orderBtn, body.signed-in:not(.can-export) #exportBtn, body.signed-in:not(.can-backup) #backupBtn,
  body:not(.can-activity) #actBtn, body:not(.can-users) #usersBtn { display: none !important; }
  body.signed-in:not(.can-edit) button.tx-fix { pointer-events: none; }
  body.signed-in:not(.can-edit) button.tx-fix .pen { display: none; }
  #rows input:disabled, #rows select:disabled, #rows textarea:disabled { opacity: 0.85; cursor: default; }
  body.signed-in.can-editRef:not(.can-edit) #rows input[id$="-reference"], body.signed-in.can-editRef:not(.can-edit) #rows textarea[id$="-reference"] { border-color: #e0a030; background: rgba(224,160,48,0.12); }
  .confirm .act-card, .confirm .users-card { width: min(1240px, calc(100vw - 32px)) !important; max-width: none !important; }
  #usersList, #actList { overflow-x: auto; }
  .users-table th.c { text-align: center; white-space: nowrap; padding: 8px 4px; }
  .act-filter { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
  .act-filter button { font: inherit; font-size: 13px; font-weight: 700; padding: 5px 12px; border-radius: 999px; border: 1px solid var(--border-strong); background: transparent; color: var(--muted); cursor: pointer; }
  .act-filter button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #06101f; }
  .act-table, .users-table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 14px; }
  .act-table th, .users-table th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 8px; border-bottom: 1px solid var(--border); }
  .act-table td, .users-table td { padding: 9px 8px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  .act-table td.when { color: var(--muted); white-space: nowrap; }
  .act-table td.who { font-weight: 700; white-space: nowrap; }
  .act-empty { color: var(--muted); padding: 14px 4px; }
  .users-table td.c { text-align: center; }
  .users-table input[type=checkbox] { width: 17px; height: 17px; accent-color: var(--accent); }
  .users-table select, .nu-row input, .nu-row select, .pw-row input { font: inherit; font-size: 14px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--border-strong); background: rgba(255,255,255,0.03); color: var(--text); }
  .users-table .btn { padding: 5px 10px; font-size: 12px; }
  .users-table tr.off td { opacity: 0.5; }
  @media (max-width: 640px) {
    .header-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; width: 100%; }
    .header-actions > .btn { font-size: 13px; padding: 9px 8px; justify-content: center; white-space: normal; text-align: center; min-height: 42px; }
    .header-actions .me-chip { grid-column: 1 / -1; order: -1; justify-content: space-between; }
    .header-actions .me-chip .me-txt { flex: 1; }
    .act-table thead, .users-table thead { display: none; }
    .act-table tr { display: grid !important; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 10px 2px; border-bottom: 1px solid var(--border); }
    .act-table td { display: block !important; width: auto !important; padding: 0 !important; border: 0 !important; }
    .act-table td:nth-child(n+3) { grid-column: 1 / -1; }
    .act-table td:nth-child(4) { color: var(--muted); font-size: 13px; }
    .act-table td:nth-child(5) { font-size: 13px; }
    .act-table td:empty { display: none !important; }
    .users-table tr { display: flex !important; flex-wrap: wrap; gap: 6px; padding: 12px 2px; border-bottom: 1px solid var(--border); }
    .users-table td { display: block !important; width: auto !important; padding: 0 !important; border: 0 !important; }
    .users-table td:nth-child(1) { font-size: 16px; }
    .users-table td:nth-child(2) { color: var(--muted); align-self: center; flex: 1; }
    .users-table td:nth-child(3) { flex-basis: 100%; }
    .users-table td.c { flex-basis: calc(50% - 3px); display: flex !important; align-items: center; gap: 8px; text-align: left; padding: 6px 8px !important; border: 1px solid var(--border) !important; border-radius: 8px; font-size: 13px; }
    .users-table td.c::after { content: attr(data-perm); }
    .users-table td:last-child { flex-basis: 100%; }
    .nu-row { flex-wrap: wrap; }
    .nu-row input, .nu-row select { width: 100%; }
  }
  .nu-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .pw-row { display: flex; gap: 6px; margin-top: 6px; }
  .users-scroll { overflow-x: auto; }
  /* Two areas: Spare Parts and Equipment */''')

# ---------- sign-in screen
rep('''    <p>Enter the password to open the parts register.</p>
    <input class="cell pass" id="gatePass" type="password" inputmode="numeric" aria-label="Password" placeholder="Password">
    <div class="pass-err" id="gateErr" hidden>Wrong password. Try again.</div>
    <button class="btn btn-primary gate-btn" type="submit">Open</button>''', '''    <p>Sign in with the username and password you were given.</p>
    <input class="cell pass ln" id="gateUser" autocomplete="username" autocapitalize="none" spellcheck="false" aria-label="Username" placeholder="Username">
    <input class="cell pass ln" id="gatePass" type="password" autocomplete="current-password" aria-label="Password" placeholder="Password">
    <div class="pass-err" id="gateErr" hidden>Wrong username or password.</div>
    <button class="btn btn-primary gate-btn" type="submit">Sign in</button>
    <div class="gate-note">No sign up. Accounts are made by the administrator.</div>''')
rep('<div class="wrap">\n  <header>', '<div class="demo-strip">DEMO &middot; accounts and roles test &middot; separate from the real site</div>\n<div class="wrap">\n  <header>')
rep('''      <span id="exportLabel">Export to Excel</span>
    </button>
    </div>
  </header>''', '''      <span id="exportLabel">Export to Excel</span>
    </button>
    <button class="btn" id="actBtn" type="button" title="Who changed what, and when"><span>Activity</span></button>
    <button class="btn" id="usersBtn" type="button" title="Accounts and what each person may do"><span>Users</span></button>
    <div class="me-chip" id="meChip" hidden><span class="av"></span><span class="me-txt"><span class="who"></span><span class="role"></span></span><button class="btn" id="signOut" type="button">Sign out</button></div>
    </div>
  </header>''')

# ---------- Activity and Users dialogs
rep('  <div class="confirm" id="confirm" hidden role="dialog" aria-modal="true" aria-labelledby="confirmTitle">', '''  <div class="confirm" id="actDlg" hidden role="dialog" aria-modal="true" aria-labelledby="actTitle">
    <div class="confirm-card act-card">
      <div class="dlg-head"><div><strong id="actTitle">Activity</strong><p class="muted-p">Who changed what, and when. Nobody can edit or delete this list.</p></div><button class="btn" id="actClose" type="button">Close</button></div>
      <div class="act-filter" id="actFilter"></div>
      <div class="users-scroll" id="actList"></div>
    </div>
  </div>
  <div class="confirm" id="usersDlg" hidden role="dialog" aria-modal="true" aria-labelledby="usersTitle">
    <div class="confirm-card users-card">
      <div class="dlg-head"><div><strong id="usersTitle">Users</strong><p class="muted-p">Only you make accounts. Tick what each person may do; it applies at once.</p></div><button class="btn" id="usersClose" type="button">Close</button></div>
      <div class="users-scroll" id="usersList"></div>
      <h4>New user</h4>
      <div class="nu-row">
        <input id="nuUser" placeholder="Username" autocomplete="off" autocapitalize="none" spellcheck="false">
        <input id="nuName" placeholder="Full name" autocomplete="off">
        <input id="nuPass" placeholder="Password" autocomplete="new-password">
        <select id="nuRole"></select>
        <button class="btn btn-primary" id="nuAdd" type="button">Add user</button>
      </div>
      <div class="pass-err" id="nuErr" hidden></div>
    </div>
  </div>
  <div class="confirm" id="confirm" hidden role="dialog" aria-modal="true" aria-labelledby="confirmTitle">''')

# ---------- guards on the actions themselves
rep('''  function addRow(received) {
    if (sideView) { addSide(); return; }''', '''  function addRow(received) {
    if (!(received ? can("receive") || can("edit") : can("edit"))) return;
    if (sideView) { addSide(); return; }''')
rep('''    var row = clean({ id: uid(), month: month, created: Date.now(), loggedQty: "", baseline: !received, arrival: !!received, currency: lastCurrency(), local: origin === "loc" }, active);''',
    '''    var row = clean({ id: uid(), month: month, created: Date.now(), loggedQty: "", baseline: !received, arrival: !!received, currency: lastCurrency(), local: origin === "loc" }, active);
    if (received) mineNew[row.id] = 1;''')
rep('''  function deleteRow(id) {
''', '''  function deleteRow(id) {
    if (!can("delete")) return;
''')
rep('''  function fixTx(id) {
    if (ro()) return;''', '''  function fixTx(id) {
    if (ro() || !can("edit")) return;''')
rep('''  function deleteTx(id) {
    if (ro()) return;''', '''  function deleteTx(id) {
    if (ro() || !can("delete")) return;''')
rep('''  function trOpen(mode) {
    if (ro()) return;''', '''  function trOpen(mode) {
    if (ro() || !(mode === "in" ? can("receive") : can("transfer"))) return;''')

# ---------- remember what each row was, to log the difference
rep('''    data[active].forEach(function (row, i) {
      var tr = document.createElement("tr");''', '''    data[active].forEach(function (row, i) {
      if (!prevRow[row.id]) prevRow[row.id] = rowBody(row);
      var tr = document.createElement("tr");''')
rep('''    shown.forEach(function (t, i) {
''', '''    shown.forEach(function (t, i) {
      if (txPrev[t.id] == null) txPrev[t.id] = t.change;
''')
rep('''  function saveDoc(coll, id, body) {
''', '''  function saveDoc(coll, id, body) {
    trackAct(coll, id, body);
''')
rep('''  function deleteDoc(coll, id) {
''', '''  function deleteDoc(coll, id) {
    trackDel(coll, id);
''')

# ---------- sign-in, permissions, Activity, Users
GATE_OLD = s[s.index('  // ---- Password screen: asked once per browser tab ----'):s.index('  // ---- Saving a file to the viewer\'s device ----')]
AUTH = open(os.path.join(HERE, "auth.js"), encoding="utf-8").read()
s = s.replace(GATE_OLD, AUTH + "\n")

# ---------- start accounts with the data
rep('''  if (!useClaude) loadLocal().then(function () {''', '''  if (!useClaude) authLocal();
  if (!useClaude) loadLocal().then(function () {''')
rep('''      if (!store) {
        // No shared store in this view: keep entries in this browser
''', '''      if (!store) {
        // No shared store in this view: keep entries in this browser
        authLocal();
''')
rep('''      db = store;
      setStatus("");''', '''      db = store;
      setStatus("");
      authDb();''')

open(OUT, "w", encoding="utf-8").write(s)
print("wrote", OUT, len(s))
