(function () {
  "use strict";
  var DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var TYPE_LABEL = { C: "Compound", I: "Isolation", Core: "Core" };
  var Bridge = window.Android || null;

  // ---------- storage (localStorage; never throws) ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var state = {
    week: load("wk.week", 1),
    workouts: load("wk.workouts", null) || clone(window.DEFAULT_WORKOUTS),
    program: load("wk.program", null) || clone(window.DEFAULT_PROGRAM),
    day: null,          // workout key (A/B/C)
    editing: false,
    videos: load("wk.videos", {}),
    logs: load("wk.logs", {}),   // logs[exId][yyyy-mm-dd] = { week, sets: [{w, r, done}] }
    open: {}
  };
  function saveProgram() { save("wk.program", state.program); }
  function saveWorkouts() { save("wk.workouts", state.workouts); }
  function workout(key) { return state.workouts.filter(function (w) { return w.key === key; })[0]; }
  function dayName(key) { var w = workout(key); return w ? DOW[w.dow] : key; }
  function sortedWorkouts() { return state.workouts.slice().sort(function (a, b) { return a.dow - b.dow; }); }

  // ---------- exercise helpers ----------
  function lib(ex) { return (window.LIB && LIB[ex.id]) || {}; }
  function exName(ex) { return ex.name || lib(ex).name || ex.id; }
  function exSearch(ex) { return ex.search || lib(ex).search || exName(ex); }
  function animKey(ex) { return lib(ex).anim || ex.id; }
  function fmtRest(sec) {
    sec = +sec || 0;
    if (sec >= 120 && sec % 30 === 0) return (sec / 60) + " min";
    return sec + " s";
  }
  function restLabel(ex) { return ex.restLabel || fmtRest(ex.rest); }
  function fromLibrary(l) {
    return { id: l.id, name: l.name, search: l.search, type: l.type, s12: 2, s3: l.type === "C" || l.type === "I" ? 3 : 2,
             reps: l.reps, rest: l.rest, restLabel: l.restLabel || null, alt: l.alt || null, rpeCap: l.rpeCap || null };
  }
  function libByName(name) {
    if (!name) return null;
    var n = name.toLowerCase();
    return window.LIBRARY.filter(function (l) { return l.name.toLowerCase() === n; })[0] || null;
  }

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

  // ---------- generic helpers ----------
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
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
  function videoUrl(ex) { return state.videos[ex.id] || searchUrl(exSearch(ex)); }
  function openUrl(url) {
    if (Bridge && Bridge.openUrl) Bridge.openUrl(url);
    else window.open(url, "_blank");
  }
  function defaultDay() {
    var today = new Date().getDay();
    for (var i = 0; i < 7; i++) {
      var d = (today + i) % 7;
      var w = state.workouts.filter(function (x) { return x.dow === d; })[0];
      if (w) return w.key;
    }
    return state.workouts[0].key;
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
    var todayDow = new Date().getDay();
    sortedWorkouts().forEach(function (wk) {
      t.appendChild(el("button", { class: wk.key === state.day ? "on" : "",
        onclick: function () { state.day = wk.key; state.editing = false; render(); window.scrollTo(0, 0); } },
        [DOW[wk.dow], el("span", { class: "today", text: wk.dow === todayDow ? "today" : wk.title })]));
    });
  }

  function renderCard(ex, idx, list) {
    var p = prescribe(ex, state.week);
    var last = lastRecord(ex.id);
    var isOpen = !!state.open[ex.id];
    var custom = !!state.videos[ex.id];
    var hasAnim = window.ExerciseAnim && ExerciseAnim.has(animKey(ex));

    var card = el("div", { class: "card" + (state.editing ? " editing" : "") }, [
      el("div", { class: "card-head" }, [
        el("h3", null, [el("span", { class: "num", text: (idx + 1) + "." }), exName(ex)]),
        el("span", { class: "badge", text: TYPE_LABEL[ex.type] || ex.type })
      ]),
      el("div", { class: "stats" }, [
        stat("Sets", p.sets), stat("Reps", ex.reps), stat("Rest", restLabel(ex)), stat("RPE", p.rpe)
      ])
    ]);

    if (state.editing) {
      card.appendChild(el("div", { class: "edit-row" }, [
        el("button", { text: "↑", disabled: idx === 0 ? "disabled" : false, onclick: function () { move(idx, -1); } }),
        el("button", { text: "↓", disabled: idx === list.length - 1 ? "disabled" : false, onclick: function () { move(idx, 1); } }),
        el("button", { text: "✎ Edit", onclick: function () { editExercise(idx); } }),
        el("button", { text: "⇄ Swap", onclick: function () { openLibrary({ mode: "swap", day: state.day, index: idx }); } }),
        el("button", { class: "danger", text: "✕", onclick: function () { removeExercise(idx); } })
      ]));
      return card;
    }

    card.appendChild(el("div", { class: "last" }, last
      ? ["Last: ", el("b", { text: last.w + " kg" + (last.r ? " × " + last.r : "") }), " · " + prettyDate(last.date) + " (week " + last.week + ")"]
      : ["No weight logged yet"]));
    card.appendChild(el("div", { class: "actions" }, [
      el("button", { class: "video", text: "▶ Video", onclick: function () { openUrl(videoUrl(ex)); } }),
      el("button", { class: "cartoon", text: "🎬 Cartoon", disabled: hasAnim ? false : "disabled", onclick: function () { showCartoon(ex); } }),
      el("button", { text: "Alternative", disabled: ex.alt ? false : "disabled", onclick: function () { showAlt(ex, idx); } }),
      el("button", { text: "Change video", onclick: function () { changeVideo(ex); } })
    ]));
    if (custom) card.appendChild(el("div", { class: "custom", text: "✓ Using your saved video" }));
    card.appendChild(el("button", { class: "logbtn", text: isOpen ? "Hide sets ▴" : "Log sets ▾",
      onclick: function () { state.open[ex.id] = !isOpen; render(); } }));

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
    return el("div", { class: "row" + (s.done ? " done" : "") }, [
      el("label", { text: "Set " + (i + 1) }), w, r,
      el("button", { text: s.done ? "✓ Done" : "Set done", onclick: function () {
        if (!w.value && last) w.value = last.w;
        persist(); s.done = true; save("wk.logs", state.logs);
        startTimer(ex.rest, exName(ex) + " · set " + (i + 1));
        render();
      } })
    ]);
  }

  function render() {
    renderHeader();
    var list = document.getElementById("list"); list.innerHTML = "";
    var wk = workout(state.day);
    list.appendChild(el("div", { class: "dayhead" }, [
      el("div", null, [el("b", { text: DOW[wk.dow] }), el("span", { text: " · " + wk.title })]),
      el("button", { class: state.editing ? "on" : "", text: state.editing ? "✓ Done" : "✎ Edit day",
        onclick: function () { state.editing = !state.editing; render(); } })
    ]));
    if (state.week === 8 && !state.editing) list.appendChild(el("div", { class: "notice", text: "Deload week: same exercises with 10% less weight." }));
    var exs = state.program[state.day] || (state.program[state.day] = []);
    if (!exs.length) list.appendChild(el("div", { class: "empty", text: "No exercises yet. Tap ✎ Edit day → + Add exercise." }));
    exs.forEach(function (ex, i) { list.appendChild(renderCard(ex, i, exs)); });
    if (state.editing) {
      list.appendChild(el("button", { class: "addbtn", text: "+ Add exercise", onclick: function () { openLibrary({ mode: "add", day: state.day }); } }));
    }
  }

  // ---------- editing ----------
  function move(idx, d) {
    var a = state.program[state.day], j = idx + d;
    if (j < 0 || j >= a.length) return;
    var t = a[idx]; a[idx] = a[j]; a[j] = t; saveProgram(); render();
  }
  function removeExercise(idx) {
    var ex = state.program[state.day][idx];
    openSheet([
      el("h2", { text: "Remove exercise?" }),
      el("p", { text: exName(ex) + " will be removed from " + dayName(state.day) + ". Your logged weights are kept." }),
      el("div", { class: "btns" }, [
        el("button", { class: "danger-btn", text: "Remove", onclick: function () {
          state.program[state.day].splice(idx, 1); saveProgram(); closeSheet(); render(); } }),
        el("button", { text: "Cancel", onclick: closeSheet })
      ])
    ]);
  }
  function editExercise(idx) {
    var ex = state.program[state.day][idx];
    function field(label, input) { return el("label", { class: "field" }, [el("span", { text: label }), input]); }
    var type = el("select", null, ["C", "I", "Core"].map(function (t) {
      return el("option", { value: t, text: TYPE_LABEL[t], selected: ex.type === t ? "selected" : false }); }));
    var s12 = el("input", { type: "number", min: "1", max: "10", value: ex.s12 });
    var s3 = el("input", { type: "number", min: "1", max: "10", value: ex.s3 });
    var reps = el("input", { type: "text", value: ex.reps });
    var rest = el("input", { type: "number", min: "0", step: "15", value: ex.rest });
    var err = el("div", { class: "err" });
    openSheet([
      el("h2", { text: exName(ex) }),
      el("div", { class: "grid2" }, [
        field("Type (sets the RPE)", type), field("Rest (seconds)", rest),
        field("Sets — weeks 1-2", s12), field("Sets — weeks 3-7", s3)
      ]),
      field("Reps", reps), err,
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "Save", onclick: function () {
          var a = parseInt(s12.value, 10), b = parseInt(s3.value, 10), r = parseInt(rest.value, 10);
          if (!(a > 0) || !(b > 0) || !(r >= 0) || !reps.value.trim()) { err.textContent = "Fill in every field."; return; }
          if (r !== ex.rest) ex.restLabel = null;
          ex.type = type.value; ex.s12 = a; ex.s3 = b; ex.reps = reps.value.trim(); ex.rest = r;
          saveProgram(); closeSheet(); render();
        } }),
        el("button", { text: "Cancel", onclick: closeSheet })
      ])
    ]);
  }

  // ---------- library ----------
  var libFilter = { q: "", muscle: "All" };
  function openLibrary(ctx) {
    var search = el("input", { type: "search", placeholder: "Search exercises…", value: libFilter.q });
    var chips = el("div", { class: "chips" });
    var listBox = el("div", { class: "liblist" });
    function drawChips() {
      chips.innerHTML = "";
      ["All"].concat(window.MUSCLES).forEach(function (m) {
        chips.appendChild(el("button", { class: m === libFilter.muscle ? "on" : "", text: m,
          onclick: function () { libFilter.muscle = m; drawChips(); drawList(); } }));
      });
    }
    function drawList() {
      listBox.innerHTML = "";
      var q = libFilter.q.trim().toLowerCase();
      var items = window.LIBRARY.filter(function (l) {
        return (libFilter.muscle === "All" || l.muscle === libFilter.muscle) && (!q || l.name.toLowerCase().indexOf(q) >= 0);
      });
      if (!items.length) listBox.appendChild(el("p", { class: "empty", text: "No exercises match." }));
      items.forEach(function (l) {
        listBox.appendChild(el("button", { class: "librow", onclick: function () { showLibItem(l, ctx); } }, [
          el("div", { class: "thumb", html: ExerciseAnim.thumb(l.anim || l.id) }),
          el("div", { class: "libtxt" }, [el("b", { text: l.name }), el("small", { text: l.muscle + " · " + TYPE_LABEL[l.type] })]),
          el("span", { class: "chev", text: "›" })
        ]));
      });
    }
    search.addEventListener("input", function () { libFilter.q = search.value; drawList(); });
    var title = ctx.mode === "add" ? "Add to " + dayName(ctx.day) : ctx.mode === "swap" ? "Swap " + exName(state.program[ctx.day][ctx.index]) : "Exercise library";
    openSheet([
      el("div", { class: "sheethead" }, [el("h2", { text: title }), el("button", { class: "x", text: "✕", onclick: closeSheet })]),
      search, chips, listBox
    ], true);
    drawChips(); drawList();
  }
  function showLibItem(l, ctx) {
    var box = el("div"), err = el("div", { class: "err" });
    function addTo(dayKey) {
      var arr = state.program[dayKey] || (state.program[dayKey] = []);
      if (arr.some(function (e) { return e.id === l.id; })) { err.textContent = l.name + " is already on " + dayName(dayKey) + "."; return; }
      arr.push(fromLibrary(l)); saveProgram();
      state.day = dayKey; state.editing = true; closeSheet(); render();
      toast("Added to " + dayName(dayKey));
    }
    var actions = [];
    if (ctx.mode === "add") actions.push(el("button", { class: "primary", text: "+ Add to " + dayName(ctx.day), onclick: function () { addTo(ctx.day); } }));
    else if (ctx.mode === "swap") actions.push(el("button", { class: "primary", text: "⇄ Use this", onclick: function () {
      var arr = state.program[ctx.day], old = arr[ctx.index];
      if (arr.some(function (e, i) { return i !== ctx.index && e.id === l.id; })) { err.textContent = l.name + " is already on " + dayName(ctx.day) + "."; return; }
      var n = fromLibrary(l); n.s12 = old.s12; n.s3 = old.s3;
      arr[ctx.index] = n; saveProgram(); closeSheet(); render(); toast("Swapped");
    } }));
    else sortedWorkouts().forEach(function (wk) {
      actions.push(el("button", { class: "primary", text: "+ " + DOW[wk.dow], onclick: function () { addTo(wk.key); } }));
    });
    actions.push(el("button", { text: "▶ Video", onclick: function () { openUrl(searchUrl(l.search)); } }));
    actions.push(el("button", { text: "‹ Back", onclick: function () { openLibrary(ctx); } }));
    openSheet([
      el("h2", { text: l.name }),
      el("p", { class: "sub", text: l.muscle + " · " + TYPE_LABEL[l.type] + " · default " + l.reps + " reps, " + (l.restLabel || fmtRest(l.rest)) + " rest" }),
      box, err,
      el("div", { class: "btns" }, actions)
    ]);
    ExerciseAnim.mount(box, l.anim || l.id);
  }

  // ---------- days settings ----------
  function openDays() {
    var rows = state.workouts.map(function (w) {
      var sel = el("select", null, DOW.map(function (d, i) { return el("option", { value: i, text: d, selected: w.dow === i ? "selected" : false }); }));
      var name = el("input", { type: "text", value: w.title });
      return { w: w, sel: sel, name: name };
    });
    var err = el("div", { class: "err" });
    var resetArmed = false, resetBtn;
    resetBtn = el("button", { class: "danger-btn", text: "Reset exercises to original program", onclick: function () {
      if (!resetArmed) { resetArmed = true; resetBtn.textContent = "Tap again to confirm reset"; return; }
      state.program = clone(window.DEFAULT_PROGRAM); saveProgram(); closeSheet(); render(); toast("Program reset");
    } });
    openSheet([
      el("h2", { text: "Training days" }),
      el("p", { class: "sub", text: "Pick the weekday for each workout. Exercises stay with their workout." }),
      el("div", { class: "daysform" }, rows.map(function (r) {
        return el("div", { class: "dayrow" }, [el("b", { text: "Workout " + r.w.key }), r.name, r.sel]);
      })),
      err,
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "Save", onclick: function () {
          var dows = rows.map(function (r) { return +r.sel.value; });
          if (new Set(dows).size !== dows.length) { err.textContent = "Each workout needs a different day."; return; }
          rows.forEach(function (r) { r.w.dow = +r.sel.value; r.w.title = r.name.value.trim() || r.w.title; });
          saveWorkouts(); state.day = defaultDay(); closeSheet(); render();
        } }),
        el("button", { text: "Cancel", onclick: closeSheet })
      ]),
      el("div", { class: "btns" }, [resetBtn])
    ]);
  }

  // ---------- sheets ----------
  var overlay = document.getElementById("overlay"), sheet = document.getElementById("sheet");
  function openSheet(nodes, tall) {
    if (window.ExerciseAnim) ExerciseAnim.stop();
    sheet.innerHTML = ""; sheet.className = "sheet" + (tall ? " tall" : "");
    nodes.forEach(function (n) { if (n) sheet.appendChild(n); });
    overlay.classList.add("show"); sheet.scrollTop = 0;
  }
  function closeSheet() { overlay.classList.remove("show"); sheet.innerHTML = ""; if (window.ExerciseAnim) ExerciseAnim.stop(); }
  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeSheet(); });
  function toast(msg) {
    var t = el("div", { class: "toast", text: msg }); document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 1600);
  }

  function showCartoon(ex) {
    var box = el("div");
    openSheet([
      el("h2", { text: exName(ex) }),
      box,
      el("p", { class: "sub", text: "Simplified cartoon to show the movement pattern. Watch the real video for form details." }),
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "▶ Real video", onclick: function () { openUrl(videoUrl(ex)); } }),
        el("button", { text: "Close", onclick: closeSheet })
      ])
    ]);
    ExerciseAnim.mount(box, animKey(ex));
  }
  function showAlt(ex, idx) {
    var l = libByName(ex.alt), box = el("div");
    openSheet([
      el("h2", { text: "Alternative" }),
      el("p", null, ["Instead of ", el("b", { text: exName(ex) }), ", you can do:"]),
      el("p", null, [el("b", { text: ex.alt, style: "font-size:20px;color:#fff" })]),
      box,
      el("div", { class: "btns" }, [
        el("button", { class: "primary", text: "▶ Video", onclick: function () { openUrl(searchUrl(l ? l.search : ex.alt)); } }),
        l ? el("button", { text: "⇄ Swap in program", onclick: function () {
          var arr = state.program[state.day], n = fromLibrary(l);
          n.s12 = ex.s12; n.s3 = ex.s3; arr[idx] = n; saveProgram(); closeSheet(); render(); toast("Swapped to " + l.name);
        } }) : null,
        el("button", { text: "Close", onclick: closeSheet })
      ])
    ]);
    if (l) ExerciseAnim.mount(box, l.anim || l.id);
  }
  function changeVideo(ex) {
    var input = el("input", { type: "url", placeholder: "Paste a YouTube link…", value: state.videos[ex.id] || "" });
    var err = el("div", { class: "err" });
    openSheet([
      el("h2", { text: "Change video" }),
      el("p", { text: exName(ex) }),
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
      el("pre", { text: text }),
      el("div", { class: "btns" }, [el("button", { text: "Close", onclick: closeSheet })])
    ]);
  }
  document.getElementById("btnWarmup").onclick = function () { textSheet("Warm-up", window.WARMUP_TEXT); };
  document.getElementById("btnProg").onclick = function () { textSheet("Progression rules", window.PROGRESSION_TEXT); };
  document.getElementById("btnLib").onclick = function () { openLibrary({ mode: "browse" }); };
  document.getElementById("btnDays").onclick = openDays;

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

  // Android back button: close sheet first, then leave edit mode
  window.handleBack = function () {
    if (overlay.classList.contains("show")) { closeSheet(); return true; }
    if (state.editing) { state.editing = false; render(); return true; }
    return false;
  };

  window.__prescribe = prescribe;
  window.__state = state;

  state.day = defaultDay();
  render();
})();
