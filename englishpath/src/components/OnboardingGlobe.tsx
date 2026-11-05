import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { prefersReducedMotion } from "@/lib/utils";

/**
 * Onboarding signature (web-3d-builder, procedural object): a "world of words" —
 * a Fibonacci sphere of points with a saffron orbit (the path). Lazy-loaded in its
 * own chunk so it never touches app start-up. Pauses when hidden, renders a single
 * still frame for reduced motion, and falls back to a static CSS orb without WebGL.
 */
export default function OnboardingGlobe({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }
    const mobile = window.innerWidth < 860;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "pan-y";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 7.2);

    const pivot = new THREE.Group();
    const spin = new THREE.Group();
    pivot.add(spin);
    scene.add(pivot);

    // Fibonacci sphere of points.
    const count = mobile ? 1400 : 2600;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const gold = new THREE.Color("#fdb61c");
    const pale = new THREE.Color("#f4f1ea");
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = ga * i;
      pos.set([Math.cos(t) * r * 1.35, y * 1.35, Math.sin(t) * r * 1.35], i * 3);
      const c = Math.random() < 0.06 ? gold : pale;
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const sprite = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.45, "rgba(255,255,255,0.9)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const mat = new THREE.PointsMaterial({ size: 0.045, map: sprite, vertexColors: true, transparent: true, depthWrite: false, opacity: 0.9 });
    const points = new THREE.Points(geo, mat);
    spin.add(points);

    // The path: a tilted saffron orbit with a travelling bead.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.85, 0.012, 12, 220),
      new THREE.MeshBasicMaterial({ color: "#fdb61c", transparent: true, opacity: 0.85 }),
    );
    ring.rotation.set(1.15, 0.25, 0.2);
    pivot.add(ring);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 24), new THREE.MeshBasicMaterial({ color: "#fdb61c" }));
    ring.add(bead);

    const resize = () => {
      const w = el.clientWidth || 1;
      const h = el.clientHeight || 1;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // Drag to rotate with inertia; idle sway otherwise.
    let vel = 0;
    let dragging = false;
    let lastX = 0;
    let idleAt = performance.now();
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      vel = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      spin.rotation.y += dx * 0.006;
      vel = dx * 0.006 * 60;
      idleAt = performance.now();
    };
    const onUp = () => {
      dragging = false;
      idleAt = performance.now();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const reduced = prefersReducedMotion();
    const start = performance.now();
    let last = start;
    let visible = true;
    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      const intro = Math.min(1, t / 1.6);
      const ease = 1 - Math.pow(2, -10 * intro);
      pivot.scale.setScalar(0.9 + 0.1 * ease);
      if (!dragging) {
        vel *= Math.exp(-3.5 * dt);
        spin.rotation.y += vel * dt + dt * 0.12;
      }
      const idle = now - idleAt > 1800 ? 1 : 0;
      pivot.rotation.y = -0.9 * (1 - ease) + idle * Math.sin(t * ((2 * Math.PI) / 11)) * 0.22;
      pivot.rotation.x = 0.18;
      const a = t * 0.6;
      bead.position.set(Math.cos(a) * 1.85, Math.sin(a) * 1.85, 0);
      renderer.render(scene, camera);
    };

    if (reduced) {
      render(start + 2000);
    } else {
      renderer.setAnimationLoop((now) => visible && document.visibilityState !== "hidden" && render(now));
    }
    const io = new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)));
    io.observe(el);
    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      geo.dispose();
      mat.dispose();
      sprite.dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      bead.geometry.dispose();
      (bead.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      ref={host}
      className={className}
      role="img"
      aria-label="A slowly turning globe of glowing points circled by a golden path"
    >
      {failed ? <StaticOrb /> : null}
    </div>
  );
}

export function StaticOrb() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative aspect-square w-[62%] rounded-full border border-line bg-[radial-gradient(circle_at_35%_30%,rgb(244_241_234/0.18),transparent_60%)]">
        <div className="absolute inset-[-12%] rotate-[24deg] rounded-full border-2 border-accent/80 [transform:rotateX(64deg)]" />
      </div>
    </div>
  );
}
