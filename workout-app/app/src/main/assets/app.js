(function () {
  "use strict";
  var DAYS = [
    { key: "mon", label: "Monday", dow: 1 },
    { key: "wed", label: "Wednesday", dow: 3 },
    { key: "fri", label: "Friday", dow: 5 }
  ];
  var TYPE_LABEL = { C: "Compound", I: "Isolation", Core: "Core" };
  var Bridge = window.Android || null;

  // ---------- storage (localStorage; never throws) ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var state = {
    week: load("wk.week", 1),
    day: null,
    videos: load("wk.videos", {}),
    logs: load("wk.logs", {}),   // logs[exId][yyyy-mm-dd] = { week, sets: [{w, r, done}] }
    open: {}
  };

  // ---------- week rules ----------
  function phaseOf(week) {
    if (week <= 2) return "Return";
    if (week <= 4) return "Build";
    if (week <= 7) return "Load";
    return "Deload";
  }
  function prescribe(ex, week) {
    var iso = ex.type === "I";
    var sets, rpe;
    if (week <= 2) { sets = ex.s12; rpe = "6-7"; }
    else if (week <= 4) { sets = ex.s3; rpe = iso ? 8 : 7; }
    else if (week <= 7) { sets = ex.s3; rpe = iso ? 9 : 8; }
    else { sets = iso ? "1-2" : 2; rpe = 6; }
    if (ex.rpeCap && typeof rpe === "number" && rpe > ex.rpeCap) rpe = ex.rpeCap;
    var rows = typeof sets === "number" ? sets : 2;
    return { sets: String(sets), rpe: String(rpe), rows: rows };
  }

  // ---------- helpers ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function prettyDate(iso) {
    var p = iso.split("-");
    var m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+p[1] - 1];
    return m + " " + (+p[2]);
  }
  function searchUrl(term) {
    return "https://www.youtube.com/results?search_query=" +
      term.trim().split(/\s+/).map(encodeURIComponent).join("+") + "+proper+form";
  }
  function videoUrl(ex) { return state.videos[ex.id] || searchUrl(ex.search); }
  function openUrl(url) {
    if (Bridge && Bridge.openUrl) Bridge.openUrl(url);
    else window.open(url, "_blank");
  }
  function defaultDay() {
    var dow = new Date().getDay(); // 0 Sun .. 6 Sat
    if (dow === 1) return "mon";
    if (dow === 2 || dow === 3) return "wed";
    if (dow === 4 || dow === 5) return "fri";
    return "mon";
  }
  function lastRecord(exId) {
    var byDate = state.logs[exId] || {};
    var today = todayISO();
    var dates = Object.keys(byDate).filter(function (d) { return d < today; }).sort().reverse();
    for (var i = 0; i < dates.length; i++) {
      var sets = byDate[dates[i]].sets || [];
      for (var j = sets.length - 1; j >= 0; j--) {
        if (sets[j] && sets[j].w !== "" && sets[j].w != null) {
          return { w: sets[j].w, r: sets[j].r, date: dates[i], week: byDate[dates[i]].week };
        }
      }
    }
    return null;
  }
  function todaySets(exId) {
    var t = todayISO();
    state.logs[exId] = state.logs[exId] || {};
    state.logs[exId][t] = state.logs[exId][t] || { week: state.week, sets: [] };
    state.logs[exId][t].week = state.week;
    return state.logs[exId][t].sets;
  }

  // ---------- render ----------
  function renderHeader() {
    document.getElementById("weekTitle").textContent = "Week " + state.week;
    document.getElementById("phaseLabel").textContent = phaseOf(state.week) + " phase";
    var w = document.getElementById("weeks"); w.innerHTML = "";
    for (var i = 1; i <= 8; i++) (function (n) {
      w.appendChild(el("button", { class: n === state.week ? "on" : "", text: String(n),
        onclick: function () { state.week = n; save("wk.week", n); render(); } }));
    })(i);
    var t = document.getElementById("tabs"); t.innerHTML = "";
    var todayKey = ["", "mon", "", "wed", "", "fri", ""][new Date().getDay()];
    DAYS.forEach(function (d) {
      t.appendChild(el("button", { class: d.key === state.day ? "on" : "",
        onclick: function () { state.day = d.key; render(); window.scrollTo(0, 0); } },
        [d.label, d.key === todayKey ? el("span", { class: "today", text: "today" }) : null]));
    });
  }

  function renderCard(ex, idx) {
    var p = prescribe(ex, state.week);
    var last = lastRecord(ex.id);
    var isOpen = !!state.open[ex.id];
    var custom = !!state.videos[ex.id];

    var card = el("div", { class: "card" }, [
      el("div", { class: "card-head" }, [
        el("h3", null, [el("span", { class: "num", text: (idx + 1) + "." }), ex.name]),
        el("span", { class: "badge", text: TYPE_LABEL[ex.type] || ex.type })
      ]),
      el("div", { class: "stats" }, [
        stat("Sets", p.sets), stat("Reps", ex.reps), stat("Rest", ex.restLabel), stat("RPE", p.rpe)
      ]),
      el("div", { class: "last" }, last
        ? ["Last: ", el("b", { text: last.w + " kg" + (last.r ? " × " + last.r : "") }), " · " + prettyDate(last.date) + " (week " + last.week + ")"]
        : ["No weight logged yet"]),
      el("div", { class: "actions" }, [
        el("button", { class: "video", text: "▶ Video", onclick: function () { openUrl(videoUrl(ex)); } }),
        el("button", { class: "cartoon", text: "🎬 Cartoon", disabled: window.ExerciseAnim && ExerciseAnim.has(ex.id) ? false : "disabled", onclick: function () { showCartoon(ex); } }),
        el("button", { text: "Alternative", disabled: ex.alt ? false : "disabled", onclick: function () { showAlt(ex); } }),
        el("button", { text: "Change video", onclick: function () { changeVideo(ex); } })
      ]),
      custom ? el("div", { class: "custom", text: "✓ Using your saved video" }) : null,
      el("button", { class: "logbtn", text: isOpen ? "Hide sets ▴" : "Log sets ▾",
        onclick: function () { state.open[ex.id] = !isOpen; render(); } })
    ]);

    if (isOpen) {
      var sets = todaySets(ex.id);
      var log = el("div", { class: "log" });
      for (var i = 0; i < p.rows; i++) log.appendChild(setRow(ex, sets, i, last));
      card.appendChild(log);
    }
    return card;
  }
  function stat(label, value) {
    return el("div", { class: "stat" }, [el("small", { text: label }), el("span", { text: value })]);
  }
  function setRow(ex, sets, i, last) {
    sets[i] = sets[i] || { w: "", r: "", done: false };
    var s = sets[i];
    var w = el("input", { type: "number", inputmode: "decimal", step: "0.5", placeholder: last ? String(last.w) : "kg", value: s.w });
    var r = el("input", { type: "number", inputmode: "numeric", placeholder: "reps", value: s.r });
    function persist() { s.w = w.value; s.r = r.value; save("wk.logs", state.logs); }
    w.addEventListener("change", persist); r.addEventListener("change", persist);
    var row = el("div", { class: "row" + (s.done ? " done" : "") }, [
      el("label", { text: "Set " + (i + 1) }), w, r,
      el("button", { text: s.done ? "✓ Done" : "Set done", onclick: function () {
        if (!w.value && last) w.value = last.w;
        persist(); s.done = true; save("wk.logs", state.logs);
        startTimer(ex.rest, ex.name + " · set " + (i + 1));
        render();
      } })
    ]);
    return row;
  }

  function render() {
    renderHeader();
    var list = document.getElementById("list"); list.innerHTML = "";
    if (state.week === 8) list.appendChild(el("div", { class: "notice", text: "Deload week: same exercises with 10% less weight." }));
    var exs = window.PROGRAM[state.day] || [];
    if (!exs.length) {
      list.appendChild(el("div", { class: "empty", text: "No exercises for this day yet — they weren't included in the program data." }));
    }
    exs.forEach(function (ex, i) { list.appendChild(renderCard(ex, i)); });
  }

  // ---------- sheets ----------
  var overlay = document.getElementById("overlay"), sheet = document.getElementById("sheet");
  function openSheet(nodes) {
    sheet.innerHTML = ""; nodes.forEach(function (n) { if (n) sheet.appendChild(n); });
    overlay.classList.add("show");
  }
  function closeSheet() { overlay.classList.remove("show"); sheet.innerHTML = ""; if (window.ExerciseAnim) ExerciseAnim.stop(); }
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSheet(); });

  function showAlt(ex) {
    openSheet([
      el("h2", { text: "Alternative" }),
      el("p", null, ["Instead of ", el("b", { text: ex.name }), ", you can do:"]),
      el("p", null, [el("b", { text: ex.alt, style: "font-size:20px;color:#fff" })]),
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "▶ Video for alternative", onclick: function () { openUrl(searchUrl(ex.alt)); } }),
        el("button", { text: "Close", onclick: closeSheet })
      ])
    ]);
  }
  function showCartoon(ex) {
    var box = el("div");
    openSheet([
      el("h2", { text: ex.name }),
      box,
      el("p", { text: "Simplified cartoon to show the movement pattern. Watch the real video for form details.", style: "font-size:13px;color:#9aa3b2" }),
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "▶ Real video", onclick: function () { openUrl(videoUrl(ex)); } }),
        el("button", { text: "Close", onclick: closeSheet })
      ])
    ]);
    ExerciseAnim.mount(box, ex.id);
  }
  function changeVideo(ex) {
    var input = el("input", { type: "url", placeholder: "Paste a YouTube link…", value: state.videos[ex.id] || "" });
    var err = el("div", { class: "err" });
    openSheet([
      el("h2", { text: "Change video" }),
      el("p", { text: ex.name }),
      input, err,
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "Save", onclick: function () {
          var v = input.value.trim();
          if (!/^https?:\/\/\S+$/i.test(v)) { err.textContent = "Paste a full link starting with https://"; return; }
          state.videos[ex.id] = v; save("wk.videos", state.videos); closeSheet(); render();
        } }),
        state.videos[ex.id] ? el("button", { text: "Reset to search", onclick: function () {
          delete state.videos[ex.id]; save("wk.videos", state.videos); closeSheet(); render();
        } }) : null,
        el("button", { text: "Cancel", onclick: closeSheet })
      ])
    ]);
  }
  function textSheet(title, text) {
    openSheet([
      el("h2", { text: title }),
      text ? el("pre", { text: text })
           : el("p", { text: "This text hasn't been added yet — it wasn't included in the program data." }),
      el("div", { class: "btns" }, [el("button", { text: "Close", onclick: closeSheet })])
    ]);
  }
  document.getElementById("btnWarmup").onclick = function () { textSheet("Warm-up", window.WARMUP_TEXT); };
  document.getElementById("btnProg").onclick = function () { textSheet("Progression rules", window.PROGRESSION_TEXT); };

  // ---------- rest timer ----------
  var timer = { end: 0, total: 0, id: null };
  var tEl = document.getElementById("timer");
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function startTimer(seconds, name) {
    timer.total = seconds; timer.end = Date.now() + seconds * 1000;
    document.getElementById("tName").textContent = "Rest · " + name;
    tEl.classList.add("show"); tEl.classList.remove("finished");
    if (Bridge && Bridge.startTimer) Bridge.startTimer(seconds);
    clearInterval(timer.id); timer.id = setInterval(tick, 250); tick();
  }
  function tick() {
    var left = (timer.end - Date.now()) / 1000;
    document.getElementById("tTime").textContent = left > 0 ? fmt(left) : "GO!";
    document.getElementById("tBar").style.width = Math.max(0, left / timer.total * 100) + "%";
    if (left <= 0) {
      clearInterval(timer.id); timer.id = null;
      tEl.classList.add("finished");
      if (!Bridge) webAlert();
    }
  }
  window.onTimerDone = function () { timer.end = Date.now(); tick(); };
  document.getElementById("tPlus").onclick = function () {
    var left = Math.max(0, (timer.end - Date.now()) / 1000) + 15;
    timer.total = Math.max(timer.total, left);
    timer.end = Date.now() + left * 1000;
    tEl.classList.remove("finished");
    if (Bridge && Bridge.startTimer) Bridge.startTimer(Math.round(left));
    if (!timer.id) timer.id = setInterval(tick, 250);
    tick();
  };
  document.getElementById("tStop").onclick = function () {
    clearInterval(timer.id); timer.id = null;
    if (Bridge && Bridge.cancelTimer) Bridge.cancelTimer();
    tEl.classList.remove("show");
  };
  function webAlert() {
    try { navigator.vibrate && navigator.vibrate([400, 150, 400]); } catch (e) {}
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.value = 0.3; o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
      });
    } catch (e) {}
  }

  // Android back button: close sheet first
  window.handleBack = function () {
    if (overlay.classList.contains("show")) { closeSheet(); return true; }
    return false;
  };

  // test hook
  window.__prescribe = prescribe;

  state.day = defaultDay();
  render();
})();
