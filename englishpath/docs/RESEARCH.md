# Phase 1 — GitHub research (checked 2026-11-05)

Licence and activity were read from GitHub repository metadata (`gh api search/repositories`) and the npm registry.

| Repo / dataset | Used for | Licence | Last update | Decision |
|---|---|---|---|---|
| open-spaced-repetition/ts-fsrs | Spaced repetition (FSRS-7) | MIT | 2026-11-05 (★854) | **Used** — FSRS is more accurate than SM-2 and actively maintained |
| open-dict-data/ipa-dict (en_US) | IPA for vocabulary | MIT (CMUdict-derived) | 2026-10-22 (★823) | **Used** at build time (`scripts/gen-ipa.mjs`) |
| capacitor-community/sqlite | Local SQLite | MIT | 2026-08-06 (★663) | **Used** |
| capacitor-community/text-to-speech | Native TTS | MIT | 2026-06-15 | **Used** |
| capacitor-community/speech-recognition | Native speech recognition | MIT | 2026-05-29 | **Used** |
| aparajita/capacitor-secure-storage | Keystore storage for the API key | MIT | npm 2026-09-23 | **Used** |
| ionic-team/capacitor (+ capacitor-plugins) | Native shell, notifications, back button | MIT | 2026-11-04 (★17k) | **Used** |
| colinhacks/zod | Strict JSON validation of AI output | MIT | 2026-11-04 (★44k) | **Used** |
| greensock/GSAP | Animation | GSAP Standard "No Charge" | 2026-11-04 (★30k) | **Used** |
| DavidHDev/react-bits | SoftAurora background, SplitText | MIT + Commons Clause (app use allowed) | 2026-10-31 (★51k) | **Used** (2 components) |
| shadcn-ui/ui | Component patterns | MIT | 2026-11-05 (★127k) | **Used** (patterns; registry host blocked, re-implemented) |
| Tatoeba/tatoeba2 (sentences CC-BY 2.0 FR) | Example sentences | AGPL code / CC-BY data | 2026-10-29 | Not used — tatoeba.org blocked by network policy; sentences written originally |
| hermitdave/FrequencyWords | Frequency lists | MIT code, CC-BY-SA data | 2022-02-07 | Not used — unmaintained |
| first20hours/google-10000-english | Frequency list | No licence | 2023-05-17 | Not used — no licence |
| cmusphinx/cmudict / words/cmu-pronouncing-dictionary | Pronunciations | BSD-style / ISC | 2025-10 / 2021-08 | Not used directly — ipa-dict already gives IPA |
