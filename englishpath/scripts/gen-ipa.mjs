// Builds src/content/ipa.json for every built-in vocabulary item.
// Source: open-dict-data/ipa-dict en_US (MIT; derived from CMUdict via cmudict-ipa, MIT).
// Usage: node scripts/gen-ipa.mjs [path/to/en_US.txt]   (downloads the file when no path is given)
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = "https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt";
const raw = process.argv[2] ? readFileSync(process.argv[2], "utf8") : await (await fetch(SRC)).text();

const dict = new Map();
for (const line of raw.split("\n")) {
  const [w, ipa] = line.split("\t");
  if (!w || !ipa) continue;
  // First pronunciation; normalise dark-l to plain l for learners.
  const first = ipa.split(",")[0].trim().replace(/^\/|\/$/g, "").replaceAll("ɫ", "l").replaceAll("ɹ", "r");
  dict.set(w.toLowerCase(), first);
}

const dir = "src/content/lessons";
const words = new Set();
for (const f of readdirSync(dir)) {
  const src = readFileSync(join(dir, f), "utf8");
  for (const m of src.matchAll(/\bv\("[^"]+",\s*"([^"]+)"/g)) words.add(m[1]);
}

const out = {};
const missing = [];
for (const word of [...words].sort()) {
  const parts = word.toLowerCase().replace(/[^a-z' ]/g, "").split(/\s+/).filter(Boolean);
  const ipas = parts.map((p) => dict.get(p));
  if (ipas.some((x) => !x)) { missing.push(word); continue; }
  out[word] = `/${ipas.join(" ")}/`;
}
writeFileSync("src/content/ipa.json", JSON.stringify(out, null, 0) + "\n");
console.log(`IPA for ${Object.keys(out).length}/${words.size} words. Missing: ${missing.join(", ") || "none"}`);
