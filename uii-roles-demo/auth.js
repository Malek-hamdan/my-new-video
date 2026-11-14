  // ---- Accounts: username and password, and what each person may do ----
  // Demo only: the checks run in this page. The real version keeps them on a server.
  var PERMS = [["receive", "Receive"], ["transfer", "Transfer"], ["edit", "Edit all"], ["editRef", "Edit Reference"], ["delete", "Delete"],
    ["order", "Order parts"], ["export", "Export"], ["backup", "Backups"], ["activity", "Activity"], ["users", "Users"]];
  var PRESETS = {
    admin: { label: "Admin", perms: { receive: 1, transfer: 1, edit: 1, editRef: 1, "delete": 1, order: 1, "export": 1, backup: 1, activity: 1, users: 1 } },
    receiver: { label: "Receiver", perms: { receive: 1 } },
    auditor: { label: "Auditor", perms: { editRef: 1, order: 1, "export": 1 } },
    viewer: { label: "Viewer", perms: { "export": 1, activity: 1 } }
  };
  var DEFAULT_USERS = [["malek", "Malek", "admin", "malek123"], ["saeed", "Saeed", "receiver", "saeed123"], ["night", "Night keeper", "receiver", "night123"],
    ["auditor", "Auditor", "auditor", "auditor123"], ["manager", "Manager", "viewer", "manager123"]];
  var USERS_KEY = "uiird-users-v1", ACT_KEY = "uiird-activity-v1", SESSION_KEY = "uiird-user";
  var users = {}, usersLoaded = false, seeding = false, me = null;
  var mineNew = {}, prevRow = {}, txPrev = {}, acts = {}, lastAct = {}, actWho = "";
  var gateEl = document.getElementById("gate");
  document.body.classList.add("gated");

  function can(p) { return !!(me && me.active !== false && me.perms && me.perms[p]); }
  function presetPerms(role) { var o = {}, p = PRESETS[role] ? PRESETS[role].perms : {}; Object.keys(p).forEach(function (k) { o[k] = 1; }); return o; }
  function roleLabel(u) { return PRESETS[u.role] ? PRESETS[u.role].label : "Custom"; }
  function passHash(u, p) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode("uiird:" + u + ":" + p)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return (x < 16 ? "0" : "") + x.toString(16); }).join("");
    });
  }
  function saveUser(u) {
    users[u.username] = u;
    if (db) return db.collection("users").doc(u.username).set(u);
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch (e) {}
    return Promise.resolve();
  }
  // the first time, the demo starts with five people
  function seedUsers() {
    if (seeding) return;
    seeding = true;
    Promise.all(DEFAULT_USERS.map(function (d) {
      return passHash(d[0], d[3]).then(function (h) {
        return saveUser({ username: d[0], name: d[1], role: d[2], perms: presetPerms(d[2]), hash: h, active: true, created: Date.now() });
      });
    })).then(function () { seeding = false; refreshMe(); renderUsers(); }, function () { seeding = false; });
  }
  function usersArrived() {
    usersLoaded = true;
    if (!Object.keys(users).length) { seedUsers(); return; }
    refreshMe();
    renderUsers();
  }
  function authLocal() {
    try { users = JSON.parse(localStorage.getItem(USERS_KEY)) || {}; } catch (e) { users = {}; }
    try { (JSON.parse(localStorage.getItem(ACT_KEY)) || []).forEach(function (a) { acts[a.id] = a; }); } catch (e) {}
    usersArrived();
  }
  function authDb() {
    db.collection("users").onSnapshot(function (snap) {
      users = {};
      snap.docs.forEach(function (d) { var v = d.data() || {}; if (v.username) users[v.username] = v; });
      usersArrived();
    }, function () {});
    db.collection("activity").onSnapshot(function (snap) {
      acts = {};
      snap.docs.forEach(function (d) { var v = d.data() || {}; v.id = d.id; acts[d.id] = v; });
      if (!document.getElementById("actDlg").hidden) renderActivity();
    }, function () {});
  }

  // ---- what the signed-in person sees and may touch ----
  function fieldAllowed(el) {
    if (can("edit")) return true;
    var tr = el.closest("tr"), id = tr && tr.getAttribute("data-id");
    if (id && mineNew[id] && can("receive")) return true;
    return /-reference$/.test(el.id || "") && can("editRef");
  }
  function lockFields() {
    if (!me) return;
    rowsEl.querySelectorAll("input, textarea, select").forEach(function (el) { el.disabled = !fieldAllowed(el); });
  }
  var lockQueued = false;
  new MutationObserver(function () {
    if (lockQueued) return;
    lockQueued = true;
    requestAnimationFrame(function () { lockQueued = false; lockFields(); });
  }).observe(rowsEl, { childList: true, subtree: true });
  function applyPerms() {
    PERMS.forEach(function (p) { document.body.classList.toggle("can-" + p[0], can(p[0])); });
    document.body.classList.toggle("signed-in", !!me);
    var chip = document.getElementById("meChip");
    chip.hidden = !me;
    if (me) {
      var nm = me.name || me.username;
      chip.querySelector(".av").textContent = nm.charAt(0).toUpperCase();
      chip.querySelector(".who").textContent = nm;
      chip.querySelector(".role").textContent = roleLabel(me);
    }
    lockFields();
  }
  function refreshMe() {
    var name = "";
    try { name = sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) {}
    var u = name && users[name];
    me = u && u.active !== false ? u : null;
    if (name && usersLoaded && !me) { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} }
    gateEl.hidden = !!me;
    document.body.classList.toggle("gated", !me);
    applyPerms();
  }

  // ---- sign in and out ----
  document.getElementById("gateForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var uIn = document.getElementById("gateUser"), pIn = document.getElementById("gatePass"), err = document.getElementById("gateErr");
    var name = uIn.value.trim().toLowerCase(), pass = pIn.value;
    var fail = function (msg) {
      err.textContent = msg; err.hidden = false; pIn.value = "";
      var card = gateEl.querySelector(".gate-card");
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      pIn.focus();
    };
    if (!usersLoaded) { fail("Loading accounts. Try again in a moment."); return; }
    var rec = users[name];
    passHash(name, pass).then(function (h) {
      if (!rec || rec.hash !== h) { fail("Wrong username or password."); return; }
      if (rec.active === false) { fail("This account is turned off. Ask the administrator."); return; }
      try { sessionStorage.setItem(SESSION_KEY, name); } catch (er) {}
      err.hidden = true; pIn.value = "";
      refreshMe();
      logAct("Signed in", "", null, null);
      renderRows();
    }, function () { fail("This browser can't check passwords here."); });
  });
  document.getElementById("signOut").addEventListener("click", function () {
    flushWrites();
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    me = null; mineNew = {};
    refreshMe();
    document.getElementById("gateUser").focus();
  });
  setTimeout(function () { if (!me) document.getElementById("gateUser").focus(); }, 0);

  // ---- Activity: every change, with who made it and when ----
  function partLabel(r) { return (r.machine ? r.machine + " · " : "") + (r.name || r.reference || "(no name)"); }
  var FIELD_LABEL = { name: "Name", reference: "Reference", min: "Min", price: "Unit price", currency: "Currency", date: "Date" };
  function saveAct(doc) {
    acts[doc.id] = doc;
    if (db) { db.collection("activity").doc(doc.id).set(doc).catch(function () {}); }
    else {
      var list = Object.keys(acts).map(function (k) { return acts[k]; }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 2000);
      try { localStorage.setItem(ACT_KEY, JSON.stringify(list)); } catch (e) {}
    }
    if (!document.getElementById("actDlg").hidden) renderActivity();
  }
  // key: typing in one field for a while is one entry, not one per keystroke
  function logAct(what, part, from, to, key) {
    if (!me) return;
    var now = Date.now(), k = key ? me.username + "|" + key : "", prev = k && lastAct[k] && now - lastAct[k].ts < 90000 ? lastAct[k] : null;
    var doc = { id: prev ? prev.id : uid(), ts: now, user: me.username, name: me.name || me.username, what: what, part: part || "",
      from: prev ? prev.from : from, to: to };
    if (k) lastAct[k] = { id: doc.id, ts: now, from: doc.from };
    saveAct(doc);
  }
  function trackAct(coll, id, body) {
    if (!me) return;
    if (coll === "transactions") {
      var was = txPrev[id];
      if (was == null && Date.now() - (body.ts || 0) < 20000) {
        var q = Math.abs(body.change);
        logAct(body.change > 0 ? "Receive +" + q : "Transfer −" + q + (body.line ? " (Line " + body.line + ")" : ""), partLabel(body),
          "stock " + (body.after - body.change), "stock " + body.after);
      } else if (was != null && was !== body.change) {
        logAct("Fixed a transaction", partLabel(body), String(was), String(body.change));
      }
      txPrev[id] = body.change;
      return;
    }
    if (coll !== "parts") return;
    var old = prevRow[id];
    if (!old) {
      logAct(body.arrival ? "Added a new arrival" : "Added a part", partLabel(body), null, body.reference || "", "add|" + id);
    } else {
      Object.keys(FIELD_LABEL).forEach(function (f) {
        if ((old[f] || "") !== (body[f] || "")) logAct("Changed " + FIELD_LABEL[f], partLabel(body), old[f] || "(empty)", body[f] || "(empty)", f + "|" + id);
      });
      if ((old.quantity || "") !== (body.quantity || "") && old.baseline) logAct("Set starting quantity", partLabel(body), old.quantity || "(empty)", body.quantity || "(empty)", "qty|" + id);
    }
    prevRow[id] = JSON.parse(JSON.stringify(body));
  }
  function trackDel(coll, id) {
    if (!me) return;
    if (coll === "parts" && prevRow[id]) { logAct("Deleted a part", partLabel(prevRow[id]), prevRow[id].reference || "", null); delete prevRow[id]; }
    if (coll === "transactions") { var t = findTxAny(id); logAct("Deleted a transaction", t ? partLabel(t) : "", t ? String(t.change) : "", null); }
  }
  function renderActivity() {
    var list = Object.keys(acts).map(function (k) { return acts[k]; }).sort(function (a, b) { return b.ts - a.ts; });
    var who = {};
    list.forEach(function (a) { who[a.user] = a.name || a.user; });
    var f = document.getElementById("actFilter");
    f.innerHTML = "";
    [["", "All"]].concat(Object.keys(who).sort().map(function (u) { return [u, who[u]]; })).forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = o[1];
      b.setAttribute("aria-pressed", actWho === o[0] ? "true" : "false");
      b.addEventListener("click", function () { actWho = o[0]; renderActivity(); });
      f.appendChild(b);
    });
    var shown = list.filter(function (a) { return !actWho || a.user === actWho; }).slice(0, 400);
    var box = document.getElementById("actList");
    if (!shown.length) { box.innerHTML = '<div class="act-empty">Nothing yet.</div>'; return; }
    var t = document.createElement("table");
    t.className = "act-table";
    t.innerHTML = "<thead><tr><th>When</th><th>Who</th><th>What</th><th>Part</th><th>Change</th></tr></thead>";
    var tb = document.createElement("tbody");
    shown.forEach(function (a) {
      var tr = document.createElement("tr");
      var change = a.from == null && a.to == null ? "" : a.from == null ? a.to : a.to == null ? a.from : a.from + " → " + a.to;
      [[fmtTime(a.ts).replace("  ", " "), "when"], [a.name || a.user, "who"], [a.what, ""], [a.part, ""], [change, ""]].forEach(function (c) {
        var td = document.createElement("td"); td.textContent = c[0] || ""; if (c[1]) td.className = c[1]; tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.innerHTML = "";
    box.appendChild(t);
  }
  var actDlg = document.getElementById("actDlg");
  document.getElementById("actBtn").addEventListener("click", function () { if (!can("activity")) return; actDlg.hidden = false; renderActivity(); });
  document.getElementById("actClose").addEventListener("click", function () { actDlg.hidden = true; });
  actDlg.addEventListener("keydown", function (e) { if (e.key === "Escape") actDlg.hidden = true; });

  // ---- Users: only the administrator makes accounts ----
  var usersDlg = document.getElementById("usersDlg");
  (function () {
    var sel = document.getElementById("nuRole");
    Object.keys(PRESETS).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = PRESETS[k].label; sel.appendChild(o); });
    sel.value = "receiver";
  })();
  function renderUsers() {
    if (usersDlg.hidden || !can("users")) return;
    var box = document.getElementById("usersList");
    var t = document.createElement("table");
    t.className = "users-table";
    t.innerHTML = "<thead><tr><th>Username</th><th>Name</th><th>Role</th>" + PERMS.map(function (p) { return '<th class="c">' + p[1] + "</th>"; }).join("") + "<th></th></tr></thead>";
    var tb = document.createElement("tbody");
    Object.keys(users).sort().forEach(function (name) {
      var u = users[name], self = me && name === me.username;
      var tr = document.createElement("tr");
      if (u.active === false) tr.className = "off";
      var td = function (txt) { var c = document.createElement("td"); c.textContent = txt; tr.appendChild(c); return c; };
      td(u.username).style.fontWeight = "700";
      td(u.name || "");
      var rc = td(""), rs = document.createElement("select");
      Object.keys(PRESETS).concat(["custom"]).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = PRESETS[k] ? PRESETS[k].label : "Custom"; rs.appendChild(o); });
      rs.value = PRESETS[u.role] ? u.role : "custom";
      rs.disabled = self;
      rs.addEventListener("change", function () {
        if (rs.value === "custom") return;
        var nu = JSON.parse(JSON.stringify(u)); nu.role = rs.value; nu.perms = presetPerms(rs.value);
        saveUser(nu).then(renderUsers);
        logAct("Changed role", u.username, roleLabel(u), PRESETS[rs.value].label);
      });
      rc.appendChild(rs);
      PERMS.forEach(function (p) {
        var c = td(""); c.className = "c";
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!(u.perms && u.perms[p[0]]);
        cb.disabled = self && p[0] === "users";
        cb.setAttribute("aria-label", p[1] + " for " + u.username);
        cb.addEventListener("change", function () {
          var nu = JSON.parse(JSON.stringify(u)); nu.perms = nu.perms || {};
          if (cb.checked) nu.perms[p[0]] = 1; else delete nu.perms[p[0]];
          nu.role = "custom";
          Object.keys(PRESETS).forEach(function (k) { if (JSON.stringify(Object.keys(presetPerms(k)).sort()) === JSON.stringify(Object.keys(nu.perms).sort())) nu.role = k; });
          saveUser(nu).then(function () { if (self) refreshMe(); renderUsers(); });
          logAct((cb.checked ? "Allowed " : "Took away ") + p[1], u.username, null, null);
        });
        c.appendChild(cb);
      });
      var ac = td("");
      ac.style.whiteSpace = "nowrap";
      var pw = document.createElement("button"); pw.type = "button"; pw.className = "btn"; pw.textContent = "Password";
      pw.addEventListener("click", function () {
        if (ac.querySelector(".pw-row")) return;
        var row = document.createElement("div"); row.className = "pw-row";
        var inp = document.createElement("input"); inp.placeholder = "New password"; inp.autocomplete = "new-password";
        var ok = document.createElement("button"); ok.type = "button"; ok.className = "btn btn-primary"; ok.textContent = "Save";
        ok.addEventListener("click", function () {
          if (inp.value.length < 4) { inp.focus(); return; }
          passHash(u.username, inp.value).then(function (h) {
            var nu = JSON.parse(JSON.stringify(u)); nu.hash = h;
            saveUser(nu).then(renderUsers);
            logAct("Changed password", u.username, null, null);
            setStatus("Password changed for " + u.username, "saved");
          });
        });
        row.appendChild(inp); row.appendChild(ok); ac.appendChild(row); inp.focus();
      });
      ac.appendChild(pw);
      if (!self) {
        var off = document.createElement("button"); off.type = "button"; off.className = "btn" + (u.active === false ? "" : " btn-danger");
        off.textContent = u.active === false ? "Turn on" : "Turn off";
        off.style.marginLeft = "6px";
        off.addEventListener("click", function () {
          var nu = JSON.parse(JSON.stringify(u)); nu.active = u.active === false;
          saveUser(nu).then(renderUsers);
          logAct(nu.active ? "Turned on account" : "Turned off account", u.username, null, null);
        });
        ac.appendChild(off);
      }
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    box.innerHTML = "";
    box.appendChild(t);
  }
  document.getElementById("usersBtn").addEventListener("click", function () { if (!can("users")) return; usersDlg.hidden = false; renderUsers(); });
  document.getElementById("usersClose").addEventListener("click", function () { usersDlg.hidden = true; });
  usersDlg.addEventListener("keydown", function (e) { if (e.key === "Escape" && e.target.tagName !== "INPUT") usersDlg.hidden = true; });
  document.getElementById("nuAdd").addEventListener("click", function () {
    var err = document.getElementById("nuErr");
    var name = document.getElementById("nuUser").value.trim().toLowerCase(), full = document.getElementById("nuName").value.trim(),
      pass = document.getElementById("nuPass").value, role = document.getElementById("nuRole").value;
    var bad = !/^[a-z0-9._-]{2,30}$/.test(name) ? "Username: 2 to 30 letters or numbers, no spaces." : users[name] ? "That username is taken." : pass.length < 4 ? "Password: at least 4 characters." : "";
    err.textContent = bad; err.hidden = !bad;
    if (bad || !can("users")) return;
    passHash(name, pass).then(function (h) {
      return saveUser({ username: name, name: full || name, role: role, perms: presetPerms(role), hash: h, active: true, created: Date.now() });
    }).then(function () {
      logAct("Made an account", name, null, PRESETS[role].label);
      ["nuUser", "nuName", "nuPass"].forEach(function (id) { document.getElementById(id).value = ""; });
      renderUsers();
      setStatus("Account made for " + name, "saved");
    });
  });
