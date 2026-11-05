import { useEffect, useRef } from "react";

/**
 * Android back-button handler stack. The most recently mounted handler runs first;
 * returning true means "handled" (e.g. a lesson shows its exit dialog instead of leaving).
 */
type Handler = () => boolean;
const handlers: { id: number; fn: () => boolean }[] = [];
let nextId = 1;

export function runBackHandlers(): boolean {
  for (let i = handlers.length - 1; i >= 0; i--) if (handlers[i]!.fn()) return true;
  return false;
}

export function useBackHandler(fn: Handler, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return;
    const id = nextId++;
    handlers.push({ id, fn: () => ref.current() });
    return () => {
      const i = handlers.findIndex((h) => h.id === id);
      if (i >= 0) handlers.splice(i, 1);
    };
  }, [enabled]);
}
