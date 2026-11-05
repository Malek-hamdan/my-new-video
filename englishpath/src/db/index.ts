import { Capacitor } from "@capacitor/core";
import type { Store } from "./types";
import { WebStore } from "./webStore";

let store: Store | null = null;
let ready: Promise<Store> | null = null;

/** Returns the initialised store: SQLite on Android, WebStore in the browser. */
export function getStore(): Promise<Store> {
  if (ready) return ready;
  ready = (async () => {
    if (Capacitor.isNativePlatform()) {
      const { SqliteStore } = await import("./sqliteStore");
      const s = new SqliteStore();
      await s.init();
      store = s;
    } else {
      const s = new WebStore();
      await s.init();
      store = s;
    }
    return store;
  })();
  return ready;
}

/** Test hook. */
export function __setStore(s: Store) {
  store = s;
  ready = Promise.resolve(s);
}

export type { Store, SrsRow, Attempt, CacheRow } from "./types";
