import { Capacitor } from "@capacitor/core";

/**
 * Claude API key storage.
 * - Android: @aparajita/capacitor-secure-storage → Android Keystore-encrypted storage.
 * - Browser (dev only): kept in memory for the session, never written to disk/localStorage.
 * The key is never hard-coded, logged or stored in plain text.
 */
const KEY = "anthropic_api_key";
let memory: string | null = null;

async function plugin() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

export async function getApiKey(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return memory;
  if (memory) return memory;
  const v = await (await plugin()).get(KEY);
  memory = typeof v === "string" && v.length > 0 ? v : null;
  return memory;
}

export async function setApiKey(value: string): Promise<void> {
  const v = value.trim();
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(v)) throw new Error("That doesn't look like a Claude API key (it should start with sk-ant-).");
  memory = v;
  if (Capacitor.isNativePlatform()) await (await plugin()).set(KEY, v);
}

export async function clearApiKey(): Promise<void> {
  memory = null;
  if (Capacitor.isNativePlatform()) await (await plugin()).remove(KEY);
}

export const maskKey = (k: string) => `${k.slice(0, 10)}…${k.slice(-4)}`;
