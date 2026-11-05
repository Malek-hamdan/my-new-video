/** Static fallback for the onboarding globe (no WebGL, while loading, or context lost). */
export function StaticOrb() {
  return (
    <div className="grid h-full w-full place-items-center">
      <div className="relative aspect-square w-[62%] rounded-full border border-line bg-[radial-gradient(circle_at_35%_30%,rgb(244_241_234/0.18),transparent_60%)]">
        <div className="absolute inset-[-12%] rotate-[24deg] rounded-full border-2 border-accent/80 [transform:rotateX(64deg)]" />
      </div>
    </div>
  );
}
