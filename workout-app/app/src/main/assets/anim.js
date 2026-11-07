// Cartoon exercise animations (SVG, offline).
// Side-view rig. Angles in degrees:
//   legs/arms: 0 = pointing straight down, +90 = pointing forward (right), 180 = up, -90 = backward (left)
//   torso u:   0 = upright, + = leaning forward, -90 = lying with head to the left
// anchor "feet": near ankle fixed at `ankle`; anchor "hip": hip fixed at `hip`.
(function () {
  "use strict";
  var L = { T: 48, TH: 40, SH: 40, UA: 30, FA: 28, FOOT: 12 };
  var C = { skin: "#f2c29b", shirt: "#ff7a1a", shirtFar: "#c65a0d", shorts: "#2f3a4d", shortsFar: "#232b39",
            skinFar: "#cf9f7a", hair: "#2b1d14", metal: "#cfd4dc", plate: "#3d4452", bench: "#5a6272", floor: "#3a404c" };

  var ANIMS = {
    "back-squat": {
      anchor: "feet", ankle: [120, 180], armsRel: true,
      base: { aN: [-10, -160], aF: [-10, -160] },
      frames: [{ u: 5, lN: [0, 0], lF: [0, 0] }, { u: 40, lN: [85, -35], lF: [85, -35] }],
      props: [{ type: "plate", at: "traps", r: 17, back: true }]
    },
    "bench-press": {
      anchor: "hip", hip: [140, 135],
      base: { u: -90, lN: [75, 0], lF: [75, 0] },
      frames: [{ aN: [180, 180], aF: [180, 180] }, { aN: [60, 175], aF: [60, 175] }],
      props: [{ type: "rect", x: 66, y: 141, w: 100, h: 8 }, { type: "rect", x: 76, y: 149, w: 6, h: 36 },
              { type: "rect", x: 150, y: 149, w: 6, h: 36 }, { type: "plate", at: "handN", r: 17 }]
    },
    "chest-supported-row": {
      anchor: "feet", ankle: [150, 180],
      base: { u: 45, lN: [15, -5], lF: [15, -5] },
      frames: [{ aN: [0, 0], aF: [0, 0] }, { aN: [-70, -10], aF: [-70, -10] }],
      props: [{ type: "torsoPad", off: 13 }, { type: "post", from: "pad", to: 185 }, { type: "db", at: "handN" }]
    },
    "lying-leg-curl": {
      anchor: "hip", hip: [130, 128], prone: true,
      base: { u: -90, aN: [-80, 10], aF: [-80, 10] },
      frames: [{ lN: [90, 90], lF: [90, 90] }, { lN: [90, 200], lF: [90, 200] }],
      props: [{ type: "rect", x: 56, y: 136, w: 116, h: 8 }, { type: "rect", x: 64, y: 144, w: 6, h: 41 },
              { type: "rect", x: 158, y: 144, w: 6, h: 41 }, { type: "roller", at: "ankleN" }]
    },
    "db-lateral-raise": { view: "front", frames: [{ a: 8 }, { a: 85 }] },
    "ez-bar-curl": {
      anchor: "feet", ankle: [120, 180],
      base: { u: 0, lN: [0, 0], lF: [0, 0] },
      frames: [{ aN: [0, 0], aF: [0, 0] }, { aN: [-8, 150], aF: [-8, 150] }],
      props: [{ type: "plate", at: "handN", r: 11 }]
    },
    "dead-bug": {
      anchor: "hip", hip: [140, 176],
      base: { u: -90, aN: [180, 180], aF: [180, 180], lN: [180, 90], lF: [180, 90] },
      frames: [{}, { aN: [-95, -95], lF: [95, 95] }, {}, { aF: [-95, -95], lN: [95, 95] }],
      props: [{ type: "rect", x: 20, y: 184, w: 210, h: 3 }]
    },
    "trap-bar-deadlift": {
      anchor: "feet", ankle: [120, 180],
      base: { aN: [0, 0], aF: [0, 0] },
      frames: [{ u: 45, lN: [70, -25], lF: [70, -25] }, { u: 0, lN: [0, 0], lF: [0, 0] }],
      startAt: 0,
      props: [{ type: "plate", at: "handN", r: 20 }]
    },
    "seated-db-shoulder-press": {
      anchor: "hip", hip: [110, 140],
      base: { u: -5, lN: [90, 0], lF: [90, 0] },
      frames: [{ aN: [40, 175], aF: [40, 175] }, { aN: [178, 178], aF: [178, 178] }],
      props: [{ type: "rect", x: 85, y: 146, w: 50, h: 8 }, { type: "rect", x: 84, y: 78, w: 8, h: 68 },
              { type: "rect", x: 106, y: 154, w: 6, h: 31 }, { type: "db", at: "handN" }]
    },
    "lat-pulldown": {
      anchor: "hip", hip: [110, 140],
      base: { u: -12, lN: [90, 0], lF: [90, 0] },
      frames: [{ aN: [168, 172], aF: [168, 172] }, { aN: [15, 170], aF: [15, 170] }],
      props: [{ type: "rect", x: 90, y: 146, w: 40, h: 8 }, { type: "rect", x: 106, y: 154, w: 6, h: 31 },
              { type: "circle", cx: 148, cy: 128, r: 7 }, { type: "cable", at: "handN", to: [112, 8] },
              { type: "circle", cx: 112, cy: 8, r: 6 }, { type: "plate", at: "handN", r: 4 }]
    },
    "incline-db-press": {
      anchor: "hip", hip: [130, 138],
      base: { u: -50, lN: [80, 5], lF: [80, 5] },
      frames: [{ aN: [60, 165], aF: [60, 165] }, { aN: [165, 165], aF: [165, 165] }],
      props: [{ type: "torsoPad", off: -13 }, { type: "rect", x: 116, y: 144, w: 34, h: 8 },
              { type: "rect", x: 128, y: 152, w: 6, h: 33 }, { type: "db", at: "handN" }]
    }
  };

  function rad(d) { return d * Math.PI / 180; }
  function dir(a) { return [Math.sin(rad(a)), Math.cos(rad(a))]; }
  function add(p, v, k) { return [p[0] + v[0] * k, p[1] + v[1] * k]; }
  function lerp(a, b, t) {
    if (Array.isArray(a)) return a.map(function (x, i) { return lerp(x, b[i], t); });
    return a + (b - a) * t;
  }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

  function solve(def, pose) {
    var u = pose.u, hip;
    if (def.anchor === "feet") {
      var knee0 = add(def.ankle, dir(pose.lN[1]), -L.SH);
      hip = add(knee0, dir(pose.lN[0]), -L.TH);
    } else hip = def.hip;
    var up = [Math.sin(rad(u)), -Math.cos(rad(u))];
    var sh = add(hip, up, L.T), head = add(hip, up, L.T + 14);
    function leg(l) {
      var k = add(hip, dir(l[0]), L.TH), a = add(k, dir(l[1]), L.SH);
      return { k: k, a: a, f: add(a, dir(def.anchor === "feet" ? 90 : l[1] + 90), L.FOOT) };
    }
    function arm(ar) {
      var o = def.armsRel ? u : 0;
      var e = add(sh, dir(ar[0] + o), L.UA); return { e: e, h: add(e, dir(ar[1] + o), L.FA) };
    }
    return { hip: hip, sh: sh, head: head, up: up, fwd: [Math.cos(rad(u)), Math.sin(rad(u))],
             lN: leg(pose.lN), lF: leg(pose.lF), aN: arm(pose.aN), aF: arm(pose.aF) };
  }

  function line(p, q, color, w) {
    return '<line x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) +
      '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"/>';
  }
  function circle(p, r, fill, stroke) {
    return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' + r + '" fill="' + fill + '"' +
      (stroke ? ' stroke="' + stroke + '" stroke-width="2"' : "") + "/>";
  }
  function at(s, name) {
    return { handN: s.aN.h, handF: s.aF.h, ankleN: s.lN.a, shoulder: s.sh,
             traps: add(add(s.sh, s.fwd, -9), s.up, -3) }[name];
  }

  function drawSide(def, pose) {
    var s = solve(def, pose), out = [], back = [], front = [];
    (def.props || []).forEach(function (p) {
      if (p.type === "rect") back.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="2" fill="' + C.bench + '"/>');
      else if (p.type === "circle") back.push(circle([p.cx, p.cy], p.r, C.bench));
      else if (p.type === "torsoPad") {
        var c = add(add(s.hip, s.up, L.T / 2 + 2), s.fwd, p.off), ang = pose.u;
        back.push('<rect x="' + (c[0] - 5).toFixed(1) + '" y="' + (c[1] - 30).toFixed(1) + '" width="10" height="60" rx="4" fill="' + C.bench +
          '" transform="rotate(' + ang.toFixed(1) + ' ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + ')"/>');
        s.pad = c;
      } else if (p.type === "post" && s.pad) back.push(line(s.pad, [s.pad[0], p.to], C.bench, 6));
      else if (p.type === "cable") back.push(line(at(s, p.at), p.to, "#8a919c", 2));
      else if (p.type === "plate") (p.back ? back : front).push(circle(at(s, p.at), p.r, C.plate, C.metal));
      else if (p.type === "db") { var h = at(s, p.at); front.push(circle(h, 8, C.plate, C.metal)); }
      else if (p.type === "roller") { var a = at(s, p.at); front.push(circle(add(a, s.up, -6), 6, C.bench)); }
    });
    out.push(line([0, 185], [240, 185], C.floor, 2));
    out = out.concat(back);
    // far limbs
    out.push(line(s.sh, s.aF.e, C.shirtFar, 9), line(s.aF.e, s.aF.h, C.skinFar, 8));
    out.push(line(s.hip, s.lF.k, C.shortsFar, 12), line(s.lF.k, s.lF.a, C.skinFar, 10), line(s.lF.a, s.lF.f, "#1f2430", 7));
    // torso + head
    out.push(line(s.hip, s.sh, C.shirt, 18));
    out.push(circle(s.head, 11, C.skin));
    var hairC = add(s.head, s.fwd, def.prone ? 3 : -3);
    out.push('<circle cx="' + hairC[0].toFixed(1) + '" cy="' + hairC[1].toFixed(1) + '" r="9" fill="' + C.hair + '" clip-path="none" opacity=".9"/>');
    out.push(circle(add(s.head, s.fwd, def.prone ? -3 : 3), 8.5, C.skin));
    var eye = add(add(s.head, s.fwd, def.prone ? -6 : 6), s.up, 1.5);
    out.push(circle(eye, 1.6, "#111"));
    // near limbs
    out.push(line(s.hip, s.lN.k, C.shorts, 12), line(s.lN.k, s.lN.a, C.skin, 10), line(s.lN.a, s.lN.f, "#151922", 7));
    out.push(line(s.sh, s.aN.e, C.shirt, 9), line(s.aN.e, s.aN.h, C.skin, 8));
    out = out.concat(front);
    return out.join("");
  }

  function drawFront(pose) {
    var a = pose.a, out = [line([0, 185], [240, 185], C.floor, 2)];
    out.push(line([112, 104], [108, 180], C.shorts, 13), line([128, 104], [132, 180], C.shorts, 13));
    out.push(line([108, 150], [108, 180], C.skin, 10), line([132, 150], [132, 180], C.skin, 10));
    out.push('<rect x="103" y="50" width="34" height="56" rx="10" fill="' + C.shirt + '"/>');
    [[-1, 104], [1, 136]].forEach(function (sd) {
      var sh = [sd[1], 58], e = add(sh, [sd[0] * Math.sin(rad(a)), Math.cos(rad(a))], L.UA),
          h = add(e, [sd[0] * Math.sin(rad(a * 0.92)), Math.cos(rad(a * 0.92))], L.FA);
      out.push(line(sh, e, C.shirt, 9), line(e, h, C.skin, 8), '<rect x="' + (h[0] - 4).toFixed(1) + '" y="' + (h[1] - 9).toFixed(1) +
        '" width="8" height="18" rx="3" fill="' + C.plate + '" stroke="' + C.metal + '" stroke-width="2"/>');
    });
    out.push(circle([120, 36], 12, C.skin), '<path d="M108 33 a12 12 0 0 1 24 0 z" fill="' + C.hair + '"/>',
             circle([115.5, 38], 1.6, "#111"), circle([124.5, 38], 1.6, "#111"));
    return out.join("");
  }

  function ease(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

  function framePose(def, time) {
    var frames = def.frames.map(function (f) { return merge(def.base || {}, f); });
    var seg = 1300, hold = 300, per = seg + hold, n = frames.length;
    var tt = time % (per * n), i = Math.floor(tt / per), local = tt - i * per;
    var t = local < hold ? 0 : ease((local - hold) / seg);
    var a = frames[i], b = frames[(i + 1) % n], p = {};
    for (var k in a) p[k] = lerp(a[k], b[k] != null ? b[k] : a[k], t);
    return p;
  }

  var timerId = null;
  var SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="100%" style="display:block;background:#12151b;border-radius:14px">';
  function stopLoop() { if (timerId) clearInterval(timerId); timerId = null; }
  window.ExerciseAnim = {
    has: function (id) { return !!ANIMS[id]; },
    mount: function (container, id) {
      var def = ANIMS[id]; if (!def) return;
      stopLoop();
      var t0 = Date.now();
      function frame() {
        if (!document.body.contains(container)) { stopLoop(); return; }
        try {
          var pose = framePose(def, Date.now() - t0);
          container.innerHTML = SVG_OPEN + (def.view === "front" ? drawFront(pose) : drawSide(def, pose)) + "</svg>";
        } catch (e) {
          stopLoop();
          container.innerHTML = '<div style="color:#ff5c5c;padding:12px;font-size:13px">Animation error: ' + String(e && e.message || e) + "</div>";
        }
      }
      frame();
      timerId = setInterval(frame, 40);
    },
    stop: stopLoop,
    _draw: function (id, t) { var d = ANIMS[id]; var p = framePose(d, t); return d.view === "front" ? drawFront(p) : drawSide(d, p); }
  };
})();
