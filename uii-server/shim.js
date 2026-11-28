// ---- Server link: gives the page the same "db" it has as a Claude artifact, backed by this server ----
(function () {
  var SESSION_KEY = "uiip-user";
  var openReady, ready = new Promise(function (ok) { openReady = ok; }), signedIn = false;
  function api(method, url, body) {
    return fetch(url, {
      method: method, credentials: "same-origin", cache: "no-store",
      headers: body !== undefined ? { "Content-Type": "application/json", "X-UII": "1" } : { "X-UII": "1" },
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && signedIn) { signedIn = false; location.reload(); }
        if (!r.ok) throw { code: (j && j.code) || "unavailable", status: r.status };
        return j;
      });
    }, function () { throw { code: "unavailable" }; });
  }
  // ---- cache and live link ----
  var cache = {}, subs = {}, timers = {}, loading = {}, queued = {};
  // Names that mean something special to JavaScript objects (the server refuses them, this is the second guard):
  // lists are kept in objects without a prototype, and such ids are skipped.
  function reserved(id) { return id === "__proto__" || id === "constructor" || id === "prototype"; }
  function bag() { return Object.create(null); }
  function snap(c) {
    var m = cache[c] || {}, docs = Object.keys(m).map(function (id) {
      var v = m[id];
      return { id: id, exists: true, data: function () { return JSON.parse(JSON.stringify(v)); } };
    });
    return { docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false } };
  }
  function emit(c) {
    if (timers[c]) return;
    timers[c] = setTimeout(function () {
      timers[c] = 0;
      var s = snap(c);
      (subs[c] || []).forEach(function (l) { try { l.ok(s); } catch (e) { console.error(e); } });
    }, 30);
  }
  function apply(ev) {
    if (reserved(ev.id)) return;
    if (!cache[ev.c]) cache[ev.c] = bag();
    if (ev.del) delete cache[ev.c][ev.id]; else cache[ev.c][ev.id] = ev.d;
  }
  function fetchAll(c) {
    loading[c] = true; queued[c] = [];
    return api("GET", "/api/c/" + encodeURIComponent(c)).then(function (rows) {
      var m = bag();
      rows.forEach(function (r) { if (!reserved(r[0])) m[r[0]] = r[1]; });
      cache[c] = m;
      loading[c] = false;
      queued[c].forEach(apply); queued[c] = [];
      emit(c);
    }, function (e) {
      loading[c] = false;
      (subs[c] || []).forEach(function (l) { if (l.bad) try { l.bad(e); } catch (x) {} });
    });
  }
  var es = null, esColls = "", esTimer = 0;
  function liveColls() { return Object.keys(subs).filter(function (c) { return subs[c].length; }).sort().join(","); }
  function openLive() {
    esTimer = 0;
    var want = liveColls();
    if (es && want === esColls && es.readyState !== 2) return;
    if (es) es.close();
    esColls = want;
    es = new EventSource("/api/live?c=" + encodeURIComponent(want));
    es.onopen = function () { want.split(",").forEach(function (c) { if (c) fetchAll(c); }); };
    es.onmessage = function (e) {
      var ev; try { ev = JSON.parse(e.data); } catch (x) { return; }
      if (loading[ev.c]) { queued[ev.c].push(ev); return; }
      apply(ev); emit(ev.c);
    };
    es.onerror = function () {
      if (es.readyState !== 2) return;            // the browser is already trying again
      api("GET", "/api/me").then(function () { setTimeout(openLive, 3000); }, function () { setTimeout(openLive, 5000); });
    };
  }
  function relive() { if (!esTimer) esTimer = setTimeout(openLive, 40); }
  // ---- the same shape as the artifact store ----
  var store = {
    collection: function (c) {
      return {
        onSnapshot: function (ok, bad) {
          var l = { ok: ok, bad: bad };
          (subs[c] = subs[c] || []).push(l);
          if (cache[c] && !loading[c]) setTimeout(function () { ok(snap(c)); }, 0);
          relive();
          return function () { subs[c] = (subs[c] || []).filter(function (x) { return x !== l; }); };
        },
        get: function () {
          return api("GET", "/api/c/" + encodeURIComponent(c)).then(function (rows) {
            var m = bag(); rows.forEach(function (r) { if (!reserved(r[0])) m[r[0]] = r[1]; });
            var docs = Object.keys(m).map(function (id) { var v = m[id]; return { id: id, exists: true, data: function () { return JSON.parse(JSON.stringify(v)); } }; });
            return { docs: docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false } };
          });
        },
        doc: function (id) {
          var url = "/api/c/" + encodeURIComponent(c) + "/" + encodeURIComponent(id);
          return {
            id: id,
            get: function () { return api("GET", url).then(function (r) { var v = r.d; return { id: id, exists: !!r.exists, data: function () { return r.exists ? JSON.parse(JSON.stringify(v)) : undefined; } }; }); },
            set: function (body) { return api("PUT", url, body).then(function () {}); },
            "delete": function () { return api("DELETE", url).then(function () {}); }
          };
        }
      };
    }
  };
  // db.doc("coll/id") works too
  store.doc = function (pathStr) { var i = String(pathStr).indexOf("/"); return store.collection(pathStr.slice(0, i)).doc(pathStr.slice(i + 1)); };
  var downloads = {
    save: function (o) {
      var a = document.createElement("a"), url = URL.createObjectURL(o.data instanceof Blob ? o.data : new Blob([o.data]));
      a.href = url; a.download = o.filename || "download";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      return Promise.resolve();
    }
  };
  window.claude = { use: function (name) { return name === "db" ? ready.then(function () { return store; }) : name === "downloads" ? Promise.resolve(downloads) : Promise.resolve(null); } };
  window.uiiServer = {
    login: function (username, hash) {
      return api("POST", "/api/login", { username: username, hash: hash }).then(function () {
        signedIn = true; openReady(); return { ok: true };
      }, function (e) { if (e.code === "unavailable") throw e; return { ok: false, code: e.code }; });
    },
    logout: function () {
      signedIn = false;
      return api("POST", "/api/logout", {}).then(null, function () {}).then(function () {
        try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
        location.reload();
      });
    }
  };
  // already signed in on this device (up to 90 days)?
  api("GET", "/api/me").then(function (r) {
    try { sessionStorage.setItem(SESSION_KEY, r.username); } catch (e) {}
    signedIn = true; openReady();
  }, function () { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {} });
})();
