// UII Parts: shows the notifications the server sends (Web Push). Nothing is cached here.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  var opts = {
    body: String(d.body || ""),
    icon: "/icon-192.png",
    badge: "/favicon-32.png",
    data: { pend: String(d.pend || "") }
  };
  if (d.tag) { opts.tag = String(d.tag); opts.renotify = true; }
  // a request waiting for approval: two buttons where the device shows them (Android, Windows)
  if (d.pend) { opts.requireInteraction = true; opts.actions = [{ action: "approve", title: "Approve" }, { action: "reject", title: "Reject" }]; }
  e.waitUntil(self.registration.showNotification(String(d.title || "UII Parts"), opts));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var d = e.notification.data || {}, act = e.action === "approve" || e.action === "reject" ? e.action : "";
  var url = "/" + (d.pend ? "?pend=" + encodeURIComponent(d.pend) + (act ? "&do=" + act : "") : "");
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (new URL(c.url).origin === self.location.origin) {
        // the app is already open: it does the approval (or shows the request) itself
        c.postMessage({ type: "uii-open", pend: d.pend || "", act: act });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
