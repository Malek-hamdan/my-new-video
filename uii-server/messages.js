// ---- Messages: private chats and groups, on the server page only ----
// Everything a person typed is put on the screen as text (never as HTML).
(function () {
  "use strict";
  var API = "/api/chat/";
  var S = { on: false, me: null, people: {}, chats: [], all: [], tab: "mine", cur: null, info: null, msgs: [], more: false,
    readonly: false, pendPart: null, pendReply: null, open: false, es: null, features: null, around: 0 };
  var panel, btn, badge, listEl, convEl, headEl, msgsEl, inputEl, sendBtn, partChip, replyBar, partBox, popEl, searchEl, tabsEl, adminEl;
  var baseTitle = document.title, readTimer = 0, searchTimer = 0, partTimer = 0;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function api(method, path, body) {
    return fetch(API + path, {
      method: method, credentials: "same-origin", cache: "no-store",
      headers: body !== undefined ? { "Content-Type": "application/json", "X-UII": "1" } : { "X-UII": "1" },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw { status: r.status, code: j && j.code };
        return j;
      });
    });
  }
  function nameOf(u) { var p = S.people[u]; return p ? p.name : (u ? u.charAt(0).toUpperCase() + u.slice(1) : ""); }
  function initial(t) { return (t || "?").trim().charAt(0).toUpperCase(); }
  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function hhmm(ts) { var d = new Date(ts); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts), now = new Date(), y = new Date(now.getTime() - 864e5);
    if (dayKey(ts) === dayKey(now.getTime())) return "Today";
    if (dayKey(ts) === dayKey(y.getTime())) return "Yesterday";
    return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1) + "/" + d.getFullYear();
  }
  function short(ts) {
    var now = Date.now();
    if (dayKey(ts) === dayKey(now)) return hhmm(ts);
    if (dayKey(ts) === dayKey(now - 864e5)) return "Yesterday";
    var d = new Date(ts); return pad2(d.getDate()) + "/" + pad2(d.getMonth() + 1);
  }
  function chatTitle(c) {
    if (c.type === "group") return c.name;
    if (c.members.indexOf(S.me.username) < 0) return c.members.map(nameOf).join(" and ");
    var o = c.members.filter(function (u) { return u !== S.me.username; })[0] || c.members[0];
    return nameOf(o);
  }
  function chatMembersText(c) { return c.members.map(nameOf).join(", "); }
  var CHECK = '<svg viewBox="0 0 16 11" width="11" height="8" aria-hidden="true"><path d="M1.5 5.8 5 9.3 14.5 1.2" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function checks(n, seen) {
    var s = el("span", "mp-ck" + (n === 2 ? " two" : "") + (seen ? " seen" : ""));
    s.innerHTML = n === 2 ? CHECK + CHECK : CHECK;     // fixed icons, no typed text in here
    return s;
  }

  // ---------- state helpers ----------
  function seenCount(m) { return m.seen ? Object.keys(m.seen).length : 0; }
  function statusOf(m) {      // "sent", "some" or "all", for a message whose seen marks I may see
    if (!m.seen) return null;
    var n = seenCount(m);
    return n === 0 ? "sent" : n >= m.total ? "all" : "some";
  }
  function seenText(c, m) {
    if (!m.seen) return "";
    var n = seenCount(m);
    if (c && c.type === "dm" || m.total === 1) {
      var first = Object.keys(m.seen)[0];
      return n ? "Seen " + hhmm(m.seen[first]) : "Sent";
    }
    return n === 0 ? "Sent" : n >= m.total ? "Seen by all " + m.total : "Seen by " + n + " of " + m.total;
  }
  function unreadTotal() { var n = 0; S.chats.forEach(function (c) { if (!c.muted) n += c.unread; }); return n; }
  function renderBadge() {
    var n = unreadTotal();
    badge.textContent = String(n); badge.hidden = !n;
    document.title = (n ? "(" + n + ") " : "") + baseTitle;
    var md = document.querySelector("#menuBtn .menu-dot"); if (md && !md.hidden === false) { /* the page's own count is left alone */ }
    document.body.classList.toggle("has-unread-msg", n > 0);
  }

  // ---------- list ----------
  function rowFor(c, tab) {
    var row = el("div", "mp-row" + (c.unread && !c.muted && tab === "mine" ? " un" : "") + (S.cur === c.id ? " on" : ""));
    row.setAttribute("role", "button"); row.tabIndex = 0;
    var av = el("div", "mp-av" + (c.type === "group" ? " g" : ""), c.type === "group" ? (c.name || "G").slice(0, 2).toUpperCase() : initial(chatTitle(c)));
    var mid = el("div", "mp-mid");
    var title = tab === "all" ? (c.type === "group" ? c.name : c.members.map(nameOf).join(" and ")) : chatTitle(c);
    mid.appendChild(el("b", null, title + (c.deleted ? " (deleted)" : "")));
    var pv = el("small");
    if (c.last) {
      var mine = c.last.from === S.me.username;
      if (mine && c.last.seen) { var st = statusOf(c.last); pv.appendChild(checks(st === "sent" ? 1 : 2, st === "all")); }
      pv.appendChild(document.createTextNode((mine ? "You: " : (c.type === "group" || tab === "all" ? nameOf(c.last.from) + ": " : "")) + (c.last.part ? "[" + c.last.part.name + "] " : "") + c.last.text));
    } else pv.textContent = c.type === "group" ? chatMembersText(c) : "No messages yet";
    mid.appendChild(pv);
    var rt = el("div", "mp-rt");
    if (c.last) rt.appendChild(el("span", null, short(c.last.ts)));
    if (tab === "mine") {
      if (c.unread) { var b = el("span", "mp-dot" + (c.muted ? " mute" : ""), String(c.unread)); rt.appendChild(b); }
      else if (c.last && c.last.from === S.me.username && c.last.seen) rt.appendChild(el("span", "mp-sn " + (statusOf(c.last) === "sent" ? "no" : "ok"), seenText(c, c.last)));
      if (c.muted && !c.unread) rt.appendChild(el("span", "mp-sn no", "Muted"));
    } else if (c.last && c.last.seen) rt.appendChild(el("span", "mp-sn no", seenText(c, c.last)));
    row.appendChild(av); row.appendChild(mid); row.appendChild(rt);
    var go = function () { openChat(c.id, { readonly: tab === "all" && !c.member }); };
    row.addEventListener("click", go);
    row.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    return row;
  }
  function renderList() {
    if (!listEl) return;
    listEl.textContent = "";
    var rows = S.tab === "all" ? S.all : S.chats;
    if (!rows.length) listEl.appendChild(el("div", "mp-empty", S.tab === "all" ? "No conversations yet." : "No conversations yet. Press New message."));
    rows.forEach(function (c) { listEl.appendChild(rowFor(c, S.tab)); });
  }
  function renderSearchResults(results) {
    listEl.textContent = "";
    if (!results.length) { listEl.appendChild(el("div", "mp-empty", "Nothing found.")); return; }
    results.forEach(function (r) {
      var c = S.chats.filter(function (x) { return x.id === r.chat; })[0]; if (!c) return;
      var row = el("div", "mp-res"); row.tabIndex = 0;
      row.appendChild(el("b", null, chatTitle(c) + " · " + short(r.msg.ts)));
      var t = r.msg.text + (r.msg.part ? " [" + r.msg.part.name + " " + r.msg.part.reference + "]" : "");
      row.appendChild(el("span", null, (r.msg.from === S.me.username ? "You: " : nameOf(r.msg.from) + ": ") + t));
      row.addEventListener("click", function () { searchEl.value = ""; openChat(c.id, { around: r.msg.ts, focus: r.msg.id }); });
      listEl.appendChild(row);
    });
  }

  // ---------- conversation ----------
  function renderHead() {
    headEl.textContent = "";
    var c = S.info; if (!c) { headEl.appendChild(el("b", null, "Select a conversation")); return; }
    var back = el("button", "mp-back", "←"); back.type = "button"; back.title = "Back"; back.addEventListener("click", function () { panel.classList.remove("show-conv"); S.cur = null; renderList(); });
    headEl.appendChild(back);
    var t = el("div", "mp-ht");
    var title = S.readonly ? (c.type === "group" ? c.name : c.members.map(nameOf).join(" and ")) : chatTitle(c);
    t.appendChild(el("b", null, title));
    t.appendChild(el("small", null, c.type === "group" ? chatMembersText(c) : ""));
    if (c.type === "group") { t.style.cursor = "pointer"; t.title = "Members"; t.addEventListener("click", showMembers); }
    headEl.appendChild(t);
    if (!S.readonly) {
      var mute = el("button", "mp-mini", c.muted ? "Muted" : "Mute"); mute.type = "button"; mute.title = "No notifications from this conversation";
      mute.addEventListener("click", function () { api("POST", "c/" + encodeURIComponent(c.id) + "/mute", { muted: !c.muted }).then(function () { c.muted = !c.muted; var x = S.chats.filter(function (y) { return y.id === c.id; })[0]; if (x) x.muted = c.muted; renderHead(); renderList(); renderBadge(); }); });
      headEl.appendChild(mute);
    }
  }
  function openChat(id, opts) {
    opts = opts || {};
    S.cur = id; S.readonly = !!opts.readonly; S.pendReply = null; S.pendPart = null; S.around = opts.around || 0;
    panel.classList.add("show-conv");
    var q = "c/" + encodeURIComponent(id) + "/messages?limit=40" + (opts.around ? "&before=" + (opts.around + 1) : "");
    return api("GET", q).then(function (r) {
      S.info = r.chat; S.msgs = r.messages; S.more = r.more;
      renderHead(); renderMsgs(opts.focus); renderComposer(); renderList();
      if (!S.readonly && !opts.around) scheduleRead();
      if (!S.readonly && !isTouch()) inputEl.focus();
    }, function () { S.cur = null; });
  }
  function isTouch() { return window.matchMedia && matchMedia("(hover: none)").matches; }
  function renderComposer() {
    convEl.classList.toggle("ro", S.readonly);
    partChip.textContent = ""; replyBar.textContent = "";
    partChip.hidden = !S.pendPart; replyBar.hidden = !S.pendReply;
    if (S.pendPart) {
      partChip.appendChild(el("b", null, S.pendPart.name)); partChip.appendChild(document.createTextNode(" · Ref " + S.pendPart.reference + " · " + S.pendPart.machine + " · Available " + S.pendPart.quantity));
      var x = el("button", "mp-x", "✕"); x.type = "button"; x.title = "Remove"; x.addEventListener("click", function () { S.pendPart = null; renderComposer(); }); partChip.appendChild(x);
    }
    if (S.pendReply) {
      replyBar.appendChild(el("b", null, "Replying to " + (S.pendReply.from === S.me.username ? "yourself" : nameOf(S.pendReply.from))));
      replyBar.appendChild(el("span", null, S.pendReply.text.slice(0, 100)));
      var y = el("button", "mp-x", "✕"); y.type = "button"; y.title = "Cancel"; y.addEventListener("click", function () { S.pendReply = null; renderComposer(); }); replyBar.appendChild(y);
    }
  }
  function partCard(p) {
    var c = el("div", "mp-part"); c.tabIndex = 0; c.title = "Open this part";
    c.appendChild(el("b", null, p.name || "(no name)"));
    c.appendChild(el("span", null, "Ref " + p.reference + " · " + p.machine + " · Available " + p.quantity));
    c.addEventListener("click", function () { closePanel(); if (window.uiiOpenPart) window.uiiOpenPart(p.month, p.id); });
    return c;
  }
  function msgNode(m, prev, isLast) {
    var mine = m.from === S.me.username, c = S.info, grp = c.type === "group";
    var wrap = el("div", "mp-m " + (mine ? "me" : "th")); wrap.dataset.id = m.id;
    if (!mine && (grp || S.readonly)) wrap.appendChild(el("div", "mp-who", nameOf(m.from)));
    if (S.readonly && mine) wrap.appendChild(el("div", "mp-who", nameOf(m.from)));
    if (m.reply) {
      var q = el("div", "mp-q"); q.appendChild(el("b", null, nameOf(m.reply.from))); q.appendChild(el("span", null, m.reply.text));
      q.addEventListener("click", function () { var t = msgsEl.querySelector('[data-id="' + m.reply.id.replace(/"/g, "") + '"]'); if (t) { t.scrollIntoView({ block: "center", behavior: "smooth" }); t.classList.remove("hl"); void t.offsetWidth; t.classList.add("hl"); } });
      wrap.appendChild(q);
    }
    wrap.appendChild(el("div", "mp-tx", m.text));
    if (m.part) wrap.appendChild(partCard(m.part));
    var meta = el("div", "mp-t");
    meta.appendChild(document.createTextNode(hhmm(m.ts)));
    var st = statusOf(m);
    if (mine && st) { var ck = checks(st === "sent" ? 1 : 2, st === "all"); meta.appendChild(ck); }
    wrap.appendChild(meta);
    if (m.seen && ((mine && isLast) || S.readonly || (!mine && grp))) {          // the sender (and the admin) see who has seen it
      var lab = el("button", "mp-seen " + (statusOf(m) === "sent" ? "no" : "ok"), seenText(c, m)); lab.type = "button";
      if (grp && m.total > 1) lab.addEventListener("click", function (e) { e.stopPropagation(); showSeenBy(m, lab); }); else lab.disabled = true;
      wrap.appendChild(lab);
    }
    if (!S.readonly) {
      var rb = el("button", "mp-rb", "Reply"); rb.type = "button"; rb.title = "Reply to this message";
      rb.addEventListener("click", function () { S.pendReply = m; renderComposer(); inputEl.focus(); });
      wrap.appendChild(rb);
    }
    return wrap;
  }
  function renderMsgs(focusId) {
    msgsEl.textContent = "";
    var c = S.info; if (!c) return;
    if (S.more) { var more = el("button", "mp-more", "Show older messages"); more.type = "button"; more.addEventListener("click", loadOlder); msgsEl.appendChild(more); }
    var lastDay = "", lastMine = -1;
    S.msgs.forEach(function (m, i) { if (m.from === S.me.username) lastMine = i; });
    S.msgs.forEach(function (m, i) {
      var k = dayKey(m.ts);
      if (k !== lastDay) { msgsEl.appendChild(el("div", "mp-day", dayLabel(m.ts))); lastDay = k; }
      msgsEl.appendChild(msgNode(m, S.msgs[i - 1], i === lastMine));
    });
    if (!S.msgs.length) msgsEl.appendChild(el("div", "mp-empty", "No messages yet. Say hello."));
    if (S.around) { var bk = el("button", "mp-more", "Back to the newest messages"); bk.type = "button"; bk.addEventListener("click", function () { openChat(S.cur, { readonly: S.readonly }); }); msgsEl.appendChild(bk); }
    var f = focusId ? msgsEl.querySelector('[data-id="' + String(focusId).replace(/"/g, "") + '"]') : null;
    if (f) { f.scrollIntoView({ block: "center" }); f.classList.add("hl"); } else msgsEl.scrollTop = msgsEl.scrollHeight;
  }
  function loadOlder() {
    if (!S.msgs.length) return;
    var h = msgsEl.scrollHeight;
    api("GET", "c/" + encodeURIComponent(S.cur) + "/messages?limit=40&before=" + S.msgs[0].ts).then(function (r) {
      S.msgs = r.messages.concat(S.msgs); S.more = r.more; renderMsgs(); msgsEl.scrollTop = msgsEl.scrollHeight - h;
    });
  }
  function nearBottom() { return msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120; }

  // ---------- popovers ----------
  function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
  function showSeenBy(m, anchor) {
    closePop();
    popEl = el("div", "mp-pop");
    popEl.appendChild(el("div", "mp-ph", "Seen by"));
    S.info.members.filter(function (u) { return u !== m.from; }).forEach(function (u) {
      var r = el("div", "mp-pr"); r.appendChild(el("span", null, nameOf(u)));
      var t = m.seen[u]; r.appendChild(el("span", t ? "ok" : "no", t ? hhmm(t) + (dayKey(t) === dayKey(Date.now()) ? "" : " " + dayLabel(t)) : "not yet"));
      popEl.appendChild(r);
    });
    panel.appendChild(popEl);
    var ar = anchor.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    popEl.style.left = Math.max(8, Math.min(ar.left - pr.left, pr.width - 250)) + "px";
    popEl.style.top = Math.max(8, ar.top - pr.top - popEl.offsetHeight - 6) + "px";
  }
  function showMembers() {
    var c = S.info; if (!c || c.type !== "group") return;
    var can = !S.readonly && (c.by === S.me.username || S.me.admin);
    modal("Members of " + c.name, function (body, close) {
      var list = el("div", "mp-mlist");
      c.members.forEach(function (u) {
        var r = el("div", "mp-pr"); r.appendChild(el("span", null, nameOf(u) + (u === c.by ? " (made the group)" : "")));
        if (can && u !== S.me.username) { var rm = el("button", "mp-mini", "Remove"); rm.type = "button"; rm.addEventListener("click", function () { api("POST", "c/" + encodeURIComponent(c.id) + "/members", { remove: [u] }).then(function (x) { close(); refresh().then(function () { openChat(c.id); }); }); }); r.appendChild(rm); }
        list.appendChild(r);
      });
      body.appendChild(list);
      if (can) {
        var others = Object.keys(S.people).filter(function (u) { return c.members.indexOf(u) < 0; });
        if (others.length) {
          body.appendChild(el("div", "mp-ph", "Add people"));
          others.forEach(function (u) { var r = el("div", "mp-pr"); r.appendChild(el("span", null, nameOf(u))); var ad = el("button", "mp-mini", "Add"); ad.type = "button"; ad.addEventListener("click", function () { api("POST", "c/" + encodeURIComponent(c.id) + "/members", { add: [u] }).then(function () { close(); refresh().then(function () { openChat(c.id); }); }); }); r.appendChild(ad); body.appendChild(r); });
        }
      }
      var row = el("div", "mp-mrow");
      if (!S.readonly) { var lv = el("button", "mp-mini", "Leave group"); lv.type = "button"; lv.addEventListener("click", function () { api("POST", "c/" + encodeURIComponent(c.id) + "/members", { remove: [S.me.username] }).then(function () { close(); S.cur = null; S.info = null; refresh().then(function () { renderHead(); renderMsgs(); }); }); }); row.appendChild(lv); }
      if (can) { var del = el("button", "mp-mini danger", "Delete group"); del.type = "button"; del.addEventListener("click", function () { if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "Sure? Delete"; return; } api("DELETE", "c/" + encodeURIComponent(c.id)).then(function () { close(); S.cur = null; S.info = null; refresh().then(function () { renderHead(); renderMsgs(); panel.classList.remove("show-conv"); }); }); }); row.appendChild(del); }
      body.appendChild(row);
    });
  }
  function modal(title, build) {
    var ov = el("div", "mp-modal"), box = el("div", "mp-box");
    var close = function () { ov.remove(); };
    box.appendChild(el("h3", null, title)); build(box, close);
    var x = el("button", "mp-mini", "Close"); x.type = "button"; x.addEventListener("click", close); box.appendChild(x);
    ov.appendChild(box); ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    panel.appendChild(ov); return close;
  }
  function newMessage() {
    modal("New message", function (body, close) {
      var f = el("input", "mp-in"); f.placeholder = "Search a person"; body.appendChild(f);
      var lst = el("div", "mp-mlist"); body.appendChild(lst);
      var draw = function () {
        lst.textContent = ""; var q = f.value.trim().toLowerCase();
        Object.keys(S.people).filter(function (u) { return u !== S.me.username && (!q || nameOf(u).toLowerCase().indexOf(q) >= 0 || u.indexOf(q) >= 0); }).forEach(function (u) {
          var r = el("div", "mp-pr pick"); r.tabIndex = 0; r.appendChild(el("span", null, nameOf(u)));
          r.addEventListener("click", function () { api("POST", "dm", { "with": u }).then(function (x) { close(); refresh().then(function () { openChat(x.chat.id); }); }); });
          lst.appendChild(r);
        });
      };
      f.addEventListener("input", draw); draw(); setTimeout(function () { f.focus(); }, 0);
    });
  }
  function newGroup() {
    modal("New group", function (body, close) {
      var nm = el("input", "mp-in"); nm.placeholder = "Group name"; nm.maxLength = 40; body.appendChild(nm);
      var chosen = {}, lst = el("div", "mp-mlist");
      Object.keys(S.people).filter(function (u) { return u !== S.me.username; }).forEach(function (u) {
        var lab = el("label", "mp-pr"); var cb = document.createElement("input"); cb.type = "checkbox"; cb.addEventListener("change", function () { if (cb.checked) chosen[u] = 1; else delete chosen[u]; });
        lab.appendChild(cb); lab.appendChild(el("span", null, nameOf(u))); lst.appendChild(lab);
      });
      body.appendChild(lst);
      var err = el("div", "mp-err"); body.appendChild(err);
      var go = el("button", "mp-send", "Create"); go.type = "button";
      go.addEventListener("click", function () {
        var members = Object.keys(chosen);
        if (!nm.value.trim()) { err.textContent = "Give the group a name."; return; }
        if (!members.length) { err.textContent = "Tick at least one person."; return; }
        api("POST", "group", { name: nm.value.trim(), members: members }).then(function (x) { close(); refresh().then(function () { openChat(x.chat.id); }); }, function () { err.textContent = "Could not make the group."; });
      });
      body.appendChild(go); setTimeout(function () { nm.focus(); }, 0);
    });
  }

  // ---------- sending, reading ----------
  function send() {
    var text = inputEl.value.trim();
    if (!text || !S.cur || S.readonly) return;
    sendBtn.disabled = true;
    var body = { text: text };
    if (S.pendReply) body.reply = S.pendReply.id;
    if (S.pendPart) body.part = { id: S.pendPart.id };
    api("POST", "c/" + encodeURIComponent(S.cur) + "/send", body).then(function (r) {
      inputEl.value = ""; autosize(); S.pendReply = null; S.pendPart = null; renderComposer();
      if (!S.msgs.some(function (m) { return m.id === r.msg.id; })) S.msgs.push(r.msg);
      if (S.around) { openChat(S.cur); } else { renderMsgs(); }
      refresh();
    }, function (e) { inputEl.classList.add("bad"); setTimeout(function () { inputEl.classList.remove("bad"); }, 800); }).then(function () { sendBtn.disabled = false; inputEl.focus(); });
  }
  function autosize() { inputEl.style.height = "auto"; inputEl.style.height = Math.min(120, inputEl.scrollHeight) + "px"; }
  function scheduleRead() { clearTimeout(readTimer); readTimer = setTimeout(markRead, 350); }
  function markRead() {
    if (!S.open || !S.cur || S.readonly || document.visibilityState === "hidden" || S.around) return;
    var theirs = S.msgs.filter(function (m) { return m.from !== S.me.username; }), last = theirs[theirs.length - 1];
    var c = S.chats.filter(function (x) { return x.id === S.cur; })[0];
    if (!last || !c || !c.unread) return;
    api("POST", "c/" + encodeURIComponent(S.cur) + "/read", { upTo: last.ts }).then(function (r) { c.unread = r.unread; renderList(); renderBadge(); });
  }
  function openPartPicker() {
    partBox.hidden = !partBox.hidden;
    if (partBox.hidden) return;
    partBox.textContent = "";
    var f = el("input", "mp-in"); f.placeholder = "Type a name or a reference"; partBox.appendChild(f);
    var lst = el("div", "mp-plist"); partBox.appendChild(lst);
    var run = function () {
      api("GET", "parts?q=" + encodeURIComponent(f.value.trim())).then(function (r) {
        lst.textContent = "";
        if (r.month) lst.appendChild(el("div", "mp-ph", "Parts of " + r.month));
        if (!r.items.length) lst.appendChild(el("div", "mp-empty", "No part found."));
        r.items.forEach(function (p) {
          var row = el("div", "mp-pr pick"); row.tabIndex = 0;
          var l = el("div"); l.appendChild(el("b", null, p.name || "(no name)")); l.appendChild(el("small", null, p.reference + " · " + p.machine + " · Available " + p.quantity)); row.appendChild(l);
          row.addEventListener("click", function () { S.pendPart = p; partBox.hidden = true; renderComposer(); inputEl.focus(); });
          lst.appendChild(row);
        });
      });
    };
    f.addEventListener("input", function () { clearTimeout(partTimer); partTimer = setTimeout(run, 200); });
    run(); setTimeout(function () { f.focus(); }, 0);
  }

  // ---------- live ----------
  function refresh() {
    return api("GET", "boot").then(function (r) {
      S.on = r.on !== false; if (!S.on) { btn.hidden = true; return; }
      S.me = r.me; S.features = r.features; S.people = {}; r.people.forEach(function (p) { S.people[p.username] = p; });
      S.chats = r.chats; renderBadge(); if (S.open) { renderList(); renderAdmin(); }
      if (S.cur && S.info) { var c = S.chats.filter(function (x) { return x.id === S.cur; })[0]; if (c) { S.info.muted = c.muted; S.info.members = c.members; } }
    }, function () {});
  }
  function onEvent(ev) {
    if (ev.kind === "msg") {
      var m = ev.msg, c = S.chats.filter(function (x) { return x.id === ev.chat; })[0];
      if (!c) { refresh().then(function () { if (S.cur === ev.chat) openChat(ev.chat); }); return; }
      c.last = m;
      if (m.from !== S.me.username) c.unread += 1;
      if (S.cur === ev.chat && !S.readonly) {
        if (!S.msgs.some(function (x) { return x.id === m.id; })) { var stick = nearBottom(); S.msgs.push(m); renderMsgs(); if (stick) msgsEl.scrollTop = msgsEl.scrollHeight; }
        if (S.open) scheduleRead();
      }
      S.chats.sort(function (a, b) { return (b.last ? b.last.ts : b.created) - (a.last ? a.last.ts : a.created); });
      renderBadge(); if (S.open) renderList();
    } else if (ev.kind === "seen") {
      S.msgs.forEach(function (m) { if (ev.ids.indexOf(m.id) >= 0 && m.seen) m.seen[ev.by] = ev.at; });
      S.chats.forEach(function (c) { if (c.id === ev.chat && c.last && ev.ids.indexOf(c.last.id) >= 0 && c.last.seen) c.last.seen[ev.by] = ev.at; });
      if (S.open && S.cur === ev.chat) { var keep = msgsEl.scrollTop; renderMsgs(); msgsEl.scrollTop = keep; }
      if (S.open) renderList();
    } else { refresh().then(function () { if (S.open && S.tab === "all") loadAll(); }); }
  }
  function live() {
    if (S.es) S.es.close();
    S.es = new EventSource("/api/live?c=chat");
    S.es.onmessage = function (e) { var ev; try { ev = JSON.parse(e.data); } catch (x) { return; } if (ev && ev.c === "chat") onEvent(ev); };
    S.es.onopen = function () { refresh(); };
  }

  // ---------- admin ----------
  function loadAll() { return api("GET", "all").then(function (r) { S.all = r.chats; renderList(); }); }
  function renderAdmin() {
    if (!adminEl) return;
    adminEl.textContent = "";
    if (!S.me || !S.me.admin) { adminEl.hidden = true; return; }
    adminEl.hidden = false;
    var lab = el("label", "mp-sw"); var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!(S.features && S.features.staffOn); cb.disabled = !!(S.features && S.features.auto);
    cb.addEventListener("change", function () { api("POST", "switch", { on: cb.checked }).then(refresh); });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, S.features && S.features.auto ? "Open to everyone" : cb.checked ? "Open to everyone (you turned it on)" : "Only admins can use Messages until 1 Jan 2027. Tick to open it to everyone now."));
    adminEl.appendChild(lab);
  }
  function setTab(t) {
    S.tab = t; tabsEl.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === t); });
    if (t === "all") loadAll(); else renderList();
  }

  // ---------- panel ----------
  function openPanel() { S.open = true; panel.hidden = false; document.body.classList.add("msg-open"); refresh().then(function () { renderList(); renderAdmin(); if (S.cur) scheduleRead(); }); }
  function closePanel() { S.open = false; panel.hidden = true; closePop(); document.body.classList.remove("msg-open"); }
  function build() {
    btn = el("button", "btn msg-btn"); btn.type = "button"; btn.id = "msgBtn"; btn.hidden = true;
    btn.appendChild(document.createTextNode("Messages")); badge = el("span", "mp-dot", "0"); badge.hidden = true; btn.appendChild(badge);
    var host = document.querySelector("header .header-actions"), theme = document.getElementById("themeBtn");
    if (host) host.insertBefore(btn, theme || host.firstChild);
    btn.addEventListener("click", openPanel);
    panel = el("div", "mp"); panel.hidden = true; panel.id = "msgPanel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Messages");
    var top = el("div", "mp-top"); top.appendChild(el("b", null, "Messages")); top.appendChild(el("span", "mp-sp"));
    var cl = el("button", "mp-mini", "Close"); cl.type = "button"; cl.addEventListener("click", closePanel); top.appendChild(cl); panel.appendChild(top);
    adminEl = el("div", "mp-admin"); adminEl.hidden = true; panel.appendChild(adminEl);
    var body = el("div", "mp-body"); panel.appendChild(body);
    var side = el("div", "mp-side"); body.appendChild(side);
    var sh = el("div", "mp-sh"); var nm = el("button", "mp-mini", "New message"); nm.type = "button"; nm.addEventListener("click", newMessage);
    var ng = el("button", "mp-mini", "New group"); ng.type = "button"; ng.addEventListener("click", newGroup); sh.appendChild(nm); sh.appendChild(ng); side.appendChild(sh);
    tabsEl = el("div", "mp-tabs");
    [["mine", "Mine"], ["all", "Everyone’s"]].forEach(function (t) { var b = el("button", t[0] === "mine" ? "on" : "", t[1]); b.type = "button"; b.dataset.t = t[0]; b.addEventListener("click", function () { setTab(t[0]); }); tabsEl.appendChild(b); });
    side.appendChild(tabsEl);
    searchEl = el("input", "mp-in mp-search"); searchEl.placeholder = "Search all messages"; side.appendChild(searchEl);
    searchEl.addEventListener("input", function () {
      clearTimeout(searchTimer); var q = searchEl.value.trim();
      if (q.length < 2) { renderList(); return; }
      searchTimer = setTimeout(function () { api("GET", "search?q=" + encodeURIComponent(q)).then(function (r) { if (searchEl.value.trim() === q) renderSearchResults(r.results); }); }, 300);
    });
    listEl = el("div", "mp-list"); side.appendChild(listEl);
    convEl = el("div", "mp-conv"); body.appendChild(convEl);
    headEl = el("div", "mp-head"); convEl.appendChild(headEl);
    msgsEl = el("div", "mp-msgs"); convEl.appendChild(msgsEl);
    var ro = el("div", "mp-ronote", "Read only. You are not in this conversation. Your reading is written down."); convEl.appendChild(ro);
    partBox = el("div", "mp-pbox"); partBox.hidden = true; convEl.appendChild(partBox);
    replyBar = el("div", "mp-reply"); replyBar.hidden = true; convEl.appendChild(replyBar);
    partChip = el("div", "mp-chip"); partChip.hidden = true; convEl.appendChild(partChip);
    var comp = el("div", "mp-comp"); convEl.appendChild(comp);
    var pb = el("button", "mp-mini", "+ Part"); pb.type = "button"; pb.addEventListener("click", openPartPicker); comp.appendChild(pb);
    inputEl = el("textarea", "mp-ta"); inputEl.rows = 1; inputEl.placeholder = "Write a message"; inputEl.maxLength = 2000; comp.appendChild(inputEl);
    sendBtn = el("button", "mp-send", "Send"); sendBtn.type = "button"; comp.appendChild(sendBtn);
    inputEl.addEventListener("input", autosize);
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !isTouch()) { e.preventDefault(); send(); } });
    sendBtn.addEventListener("click", send);
    document.body.appendChild(panel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && S.open) { if (popEl) closePop(); else if (!partBox.hidden) partBox.hidden = true; else if (document.querySelector(".mp-modal")) document.querySelector(".mp-modal").remove(); else closePanel(); } });
    document.addEventListener("click", function (e) { if (popEl && !popEl.contains(e.target) && !(e.target.classList && e.target.classList.contains("mp-seen"))) closePop(); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") scheduleRead(); });
    window.addEventListener("focus", scheduleRead);
    renderHead();
  }
  function init() {
    build();
    api("GET", "boot").then(function (r) {
      if (r.on === false) return;                // not open yet for this person: no button, no live link
      btn.hidden = false; refresh().then(live);
    }, function () {});
  }
  if (window.claude && window.claude.use) window.claude.use("db").then(init);
})();
