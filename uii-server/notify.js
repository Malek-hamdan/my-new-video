// ---- Notifications: turn them on for this device; the admin chooses who gets what and each person's shift ----
// Everything typed is put on the screen as text. The server decides what is sent; this page only asks the
// browser for permission, hands the server this device's address, and approves a request opened from a notification.
(function () {
  "use strict";
  var API = "/api/notify/";
  var S = { boot: null, reg: null, sub: null, people: null };
  var btn, dlg, body;
  var DAYS = [["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"], ["5", "Fri"], ["6", "Sat"], ["0", "Sun"]];

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function api(method, path, data) {
    return fetch(API + path, {
      method: method, credentials: "same-origin", cache: "no-store",
      headers: data !== undefined ? { "Content-Type": "application/json", "X-UII": "1" } : { "X-UII": "1" },
      body: data !== undefined ? JSON.stringify(data) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw { status: r.status, code: j && j.code }; return j; });
    });
  }
  function say(text, kind) { if (typeof window.uiiSay === "function") window.uiiSay(text, kind || "saved"); }
  var supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function keyBytes(b64) {
    var s = b64.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    var raw = atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function fmtDate(ms) { var d = new Date(ms); return d.getUTCDate() + " " + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][d.getUTCMonth()] + " " + d.getUTCFullYear(); }

  // ---- this device ----
  function currentSub() {
    if (!S.reg) return Promise.resolve(null);
    return S.reg.pushManager.getSubscription().then(function (s) { S.sub = s; return s; }, function () { return null; });
  }
  function turnOn() {
    if (!supported) return Promise.reject("This browser cannot show notifications.");
    if (isIOS && !standalone) return Promise.reject("On iPhone: Share, Add to Home Screen, then open UII Parts from the Home Screen and turn them on there.");
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw "Notifications are blocked for this site. Allow them in the browser's site settings, then try again.";
      return S.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(S.boot.key) });
    }).then(function (sub) {
      S.sub = sub;
      var j = sub.toJSON();
      return api("POST", "subscribe", { endpoint: j.endpoint, keys: j.keys, ua: navigator.userAgent.slice(0, 120) });
    });
  }
  function turnOff() {
    var s = S.sub;
    if (!s) return Promise.resolve();
    return api("POST", "unsubscribe", { endpoint: s.endpoint }).then(function () { return s.unsubscribe(); }).then(function () { S.sub = null; });
  }

  // ---- the window ----
  function openDlg() {
    dlg.hidden = false;
    body.textContent = "Loading…";
    Promise.all([api("GET", "boot"), currentSub()]).then(function (r) { S.boot = r[0]; window.uiiNotifyLive = !!S.boot.live; return S.boot.admin ? api("GET", "people") : null; })
      .then(function (p) { S.people = p ? p.people : null; render(); }, function () { body.textContent = "No connection to the server. Try again."; });
  }
  function closeDlg() { dlg.hidden = true; }
  function render() {
    var b = S.boot; body.textContent = "";
    var note = el("p", "muted-p");
    note.textContent = b.live ? (b.early && Date.now() < b.start ? "Notifications are on (started early by an administrator)." : "Notifications are on.")
      : b.admin ? "Until " + fmtDate(b.start) + " only administrators get notifications, so you can see how they look. Everyone else starts on " + fmtDate(b.start) + "."
      : "Notifications start on " + fmtDate(b.start) + ". You can turn them on for this device now and send yourself a test.";
    body.appendChild(note);

    // this device
    body.appendChild(el("h4", null, "This device"));
    var st = el("p", "nt-state"), row = el("div", "dlg-actions"), msg = el("p", "nt-msg");
    var on = !!S.sub && Notification.permission === "granted";
    st.textContent = !supported ? "This browser cannot show notifications." : on ? "On for this device." : "Off for this device.";
    body.appendChild(st);
    if (supported && !on && isIOS && !standalone) {
      var ios = el("p", "muted-p", "On iPhone: tap Share, then Add to Home Screen. Open UII Parts from the Home Screen and turn notifications on there.");
      body.appendChild(ios);
    }
    function act(label, cls, fn) {
      var x = el("button", "btn" + (cls ? " " + cls : ""), label); x.type = "button";
      x.addEventListener("click", function () {
        x.disabled = true; msg.textContent = "";
        Promise.resolve().then(fn).then(function (t) { if (typeof t === "string") msg.textContent = t; return currentSub(); })
          .then(function () { return api("GET", "boot"); }).then(function (bb) { S.boot = bb; render(); if (msg.textContent) body.querySelector(".nt-msg").textContent = msg.textContent; },
            function (e) {
              x.disabled = false;
              msg.textContent = typeof e === "string" ? e
                : e && e.name ? "This browser could not turn notifications on (" + e.name + "). Use Chrome, Edge or Safari, and allow notifications for this site."
                : "Could not do it" + (e && e.code ? " (" + e.code + ")" : "") + ". Try again.";
            });
      });
      row.appendChild(x);
    }
    if (supported && !on) act("Turn on for this device", "btn-primary", turnOn);
    if (on) {
      act("Send a test", "btn-primary", function () { return api("POST", "test").then(function (j) { return j.sent ? "Test sent. It should appear in a few seconds." : "Not delivered. Turn it off and on again on this device."; }); });
      act("Turn off for this device", "", turnOff);
    }
    body.appendChild(row); body.appendChild(msg);
    var mine = b.prefs || {};
    if (!b.admin) {
      body.appendChild(el("p", "muted-p", mine.on ? "You get: " + ["receive", "transfer", "approvals", "stock"].filter(function (k) { return mine[k]; }).map(function (k) { return { receive: "Goods Received", transfer: "Stock Issued", approvals: "Approval results", stock: "Out of Stock and Below Minimum" }[k]; }).join(", ") + "." : "The administrator has not turned notifications on for you yet."));
      return;
    }

    // admin: start early, and each person's choices
    body.appendChild(el("h4", null, "People"));
    if (Date.now() < b.start) {
      var lab = el("label", "nt-early"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!b.early;
      cb.addEventListener("change", function () { cb.disabled = true; api("POST", "switch", { on: cb.checked }).then(function (j) { S.boot.early = cb.checked; S.boot.live = j.live; window.uiiNotifyLive = !!j.live; render(); }, function () { cb.disabled = false; cb.checked = !cb.checked; }); });
      lab.appendChild(cb); lab.appendChild(document.createTextNode(" Start notifications now for everyone (before " + fmtDate(b.start) + ")"));
      body.appendChild(lab);
    }
    body.appendChild(el("p", "muted-p", "Tick who gets notifications and about what. The person who makes a movement is never notified about it. The thank-you is sent at the end of the shift (server time, the same as Accra)."));
    var wrap = el("div", "nt-scroll"), t = el("table", "act-table nt-table"), hd = el("tr");
    ["Person", "On", "Receive", "Transfer", "Approvals", "Stock", "Shift", "Days", "Devices"].forEach(function (h) { hd.appendChild(el("th", null, h)); });
    var th = el("thead"); th.appendChild(hd); t.appendChild(th);
    var tb = el("tbody");
    (S.people || []).forEach(function (p) { tb.appendChild(personRow(p)); });
    t.appendChild(tb); wrap.appendChild(t); body.appendChild(wrap);
  }
  function personRow(p) {
    var tr = el("tr"), pr = p.prefs, err = el("div", "pend-err");
    var nm = el("td", "who"); nm.appendChild(el("b", null, p.name)); nm.appendChild(el("div", "muted-p", p.username)); nm.appendChild(err); tr.appendChild(nm);
    function save() {
      var days = DAYS.filter(function (d) { return pr["d" + d[0]]; }).map(function (d) { return d[0]; }).sort().join(",");
      err.textContent = "";
      api("POST", "prefs", { username: p.username, on: pr.on, receive: pr.receive, transfer: pr.transfer, approvals: pr.approvals, stock: pr.stock, shiftStart: pr.shiftStart, shiftEnd: pr.shiftEnd, shiftDays: days })
        .then(function (j) { p.prefs = j.prefs; say("Saved: notifications for " + p.name); }, function () { err.textContent = "Not saved. Try again."; });
    }
    String(pr.shiftDays || "").split(",").forEach(function (d) { if (d) pr["d" + d] = true; });
    ["on", "receive", "transfer", "approvals", "stock"].forEach(function (k) {
      var td = el("td", "nt-c"), cb = el("input"); cb.type = "checkbox"; cb.checked = !!pr[k];
      cb.setAttribute("aria-label", k + " for " + p.name);
      if (k === "approvals" && !p.approver) td.title = "Gets the result of their own requests. Only approvers get Approval Required.";
      cb.addEventListener("change", function () { pr[k] = cb.checked; save(); });
      td.appendChild(cb); tr.appendChild(td);
    });
    var sh = el("td", "nt-shift"), a = el("input"), b = el("input");
    a.type = b.type = "time"; a.value = pr.shiftStart || ""; b.value = pr.shiftEnd || "";
    a.setAttribute("aria-label", "Shift start for " + p.name); b.setAttribute("aria-label", "Shift end for " + p.name);
    a.addEventListener("change", function () { pr.shiftStart = a.value; save(); });
    b.addEventListener("change", function () { pr.shiftEnd = b.value; save(); });
    sh.appendChild(a); sh.appendChild(el("span", null, " to ")); sh.appendChild(b); tr.appendChild(sh);
    var dd = el("td", "nt-days");
    DAYS.forEach(function (d) {
      var l = el("label"), c = el("input"); c.type = "checkbox"; c.checked = !!pr["d" + d[0]];
      c.addEventListener("change", function () { pr["d" + d[0]] = c.checked; save(); });
      l.appendChild(c); l.appendChild(document.createTextNode(d[1])); dd.appendChild(l);
    });
    tr.appendChild(dd);
    tr.appendChild(el("td", "nt-c", String(p.devices)));
    return tr;
  }

  // ---- a request opened from a notification (Approve / Reject pressed, or the notification tapped) ----
  function handlePend(id, act) {
    if (!id || typeof window.uiiPendAct !== "function") return;
    var tries = 0;
    (function wait() {
      if (window.uiiPendHas && window.uiiPendHas(id)) {
        if (!act) { var pb = document.getElementById("pendBtn"); if (pb) pb.click(); return; }
        window.uiiPendAct(id, act).then(function (e) {
          say(e ? e : act === "approve" ? "Approved from the notification." : "Rejected from the notification.", e ? "error" : "saved");
          var pb = document.getElementById("pendBtn"); if (pb && e) pb.click();
        });
        return;
      }
      if (++tries < 60) setTimeout(wait, 500); else say("That request is no longer here.", "error");
    })();
  }

  function build() {
    btn = el("button", "btn nt-btn", "Notifications"); btn.type = "button"; btn.id = "ntBtn"; btn.hidden = true;
    var host = document.querySelector("header .header-actions"), theme = document.getElementById("themeBtn");
    if (host) host.insertBefore(btn, theme || host.firstChild);
    btn.addEventListener("click", openDlg);
    dlg = el("div", "confirm"); dlg.id = "ntDlg"; dlg.hidden = true; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-label", "Notifications");
    var card = el("div", "confirm-card wide nt-card"), head = el("div", "dlg-head");
    head.appendChild(el("strong", null, "Notifications"));
    var x = el("button", "btn", "Close"); x.type = "button"; x.addEventListener("click", closeDlg); head.appendChild(x);
    card.appendChild(head); body = el("div", "nt-body"); card.appendChild(body); dlg.appendChild(card);
    dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDlg(); });
    document.body.appendChild(dlg);
    // also from the Users window
    var uh = document.querySelector("#usersDlg .dlg-head");
    if (uh) { var ub = el("button", "btn", "Notifications"); ub.type = "button"; ub.id = "usersNtBtn"; ub.hidden = true; ub.addEventListener("click", openDlg); uh.insertBefore(ub, uh.lastChild); }
  }
  function init() {
    build();
    if (supported) {
      navigator.serviceWorker.register("/sw.js").then(function (r) { S.reg = r; return currentSub(); }).catch(function () {});
      navigator.serviceWorker.addEventListener("message", function (e) { var d = e.data || {}; if (d.type === "uii-open" && d.pend) handlePend(d.pend, d.act); });
    }
    api("GET", "boot").then(function (b) {
      S.boot = b; window.uiiNotifyLive = !!b.live;
      // the admin always; anyone else once the admin has turned notifications on for them
      btn.hidden = !(b.admin || (b.prefs && b.prefs.on));
      var ub = document.getElementById("usersNtBtn"); if (ub) ub.hidden = !b.admin;
    }, function () {});
    var q = new URLSearchParams(location.search), pid = q.get("pend");
    if (pid) {
      history.replaceState(null, "", location.pathname);
      handlePend(pid, q.get("do") === "approve" || q.get("do") === "reject" ? q.get("do") : "");
    }
  }
  if (window.claude && window.claude.use) window.claude.use("db").then(init);
})();
