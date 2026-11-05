# Attributions

Every third-party repository, package and dataset used by EnglishPath, with its licence.
Licences were checked before use (GitHub repository metadata + the package's own `license` field / LICENSE file).
Versions are pinned exactly in `package.json`.

## Learning engine & data

| Project | Used for | Licence | Source |
|---|---|---|---|
| ts-fsrs 6.0.0 (open-spaced-repetition/ts-fsrs) | FSRS-7 spaced-repetition scheduler for words and grammar points | MIT | https://github.com/open-spaced-repetition/ts-fsrs |
| ipa-dict, `en_US` (open-dict-data/ipa-dict) | IPA transcriptions for vocabulary (`scripts/gen-ipa.mjs` → `src/content/ipa.json`) | MIT (data derived from CMUdict via cmudict-ipa, MIT; CMUdict is BSD-2-Clause) | https://github.com/open-dict-data/ipa-dict |
| Zod 4.6.7 | Schemas for all content and strict validation of every AI response | MIT | https://github.com/colinhacks/zod |
| @anthropic-ai/sdk 1.5.0 | Claude API client (structured outputs) | Apache-2.0 | https://github.com/anthropics/anthropic-sdk-typescript |

All lesson texts, dialogues, grammar explanations, the curriculum outline and the placement test are original EnglishPath content written for this app. The CEFR level names and the general idea of "can-do" goals come from the Council of Europe's public CEFR framework; no course-book content or commercial word lists are used.

## UI, motion & 3D

| Project | Used for | Licence | Source |
|---|---|---|---|
| React 19.3.1 / React DOM | UI | MIT | https://github.com/facebook/react |
| Vite 8.3.6, @vitejs/plugin-react 6.2.1 | Build | MIT | https://github.com/vitejs/vite |
| TypeScript 7.0.2 | Type checking (strict) | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Tailwind CSS 4.3.4 | Styling | MIT | https://github.com/tailwindlabs/tailwindcss |
| shadcn/ui (patterns for Button, Switch, Dialog/Sheet) | Component patterns, re-implemented on Radix with EnglishPath tokens | MIT | https://github.com/shadcn-ui/ui |
| Radix UI (react-dialog 1.3.1, react-switch 1.4.1, react-slot 1.5.0) | Accessible primitives | MIT | https://github.com/radix-ui/primitives |
| class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0 | Class utilities | Apache-2.0 / MIT / MIT | npm |
| lucide-react 1.69.0 | Icons | ISC | https://github.com/lucide-icons/lucide |
| GSAP 3.15.1 + @gsap/react 2.1.2 (incl. SplitText plugin) | All animation | GSAP Standard "No Charge" License (free for commercial apps) | https://gsap.com/standard-license |
| React Bits — **SoftAurora** (unmodified) and **SplitText** (port: ScrollTrigger and hover physics removed) | Level-up / achievement background, animated headlines on onboarding and celebration screens | MIT + Commons Clause (© 2026 David Haz) — use inside an application is permitted; the components themselves are not sold or redistributed separately | https://github.com/DavidHDev/react-bits |
| 21st.dev — "Bottom Nav Bar" by arunachalam | Bottom tab bar (ported from Framer Motion to GSAP, restyled) | No explicit licence on the component page — **flagged for your review** (small component, rewritten with GSAP and own tokens; remove if your policy requires an explicit licence) | https://21st.dev/@arunachalam/components/bottom-nav-bar |
| 21st.dev — "Message Bubble" by framecn | Dialogue chat bubbles (ported to Tailwind tokens; GSAP rise-in) | No explicit licence on the component page — **flagged for your review** (rewritten with Tailwind tokens; ~40 lines) | https://21st.dev/@framecn/components/message-bubble |
| three.js 0.187.0 | Lazy-loaded 3D globe on the onboarding screen | MIT | https://github.com/mrdoob/three.js |
| Zustand 5.0.16 | App state | MIT | https://github.com/pmndrs/zustand |
| Inter (variable) via @fontsource-variable/inter 5.3.0 | Body font (bundled offline) | SIL OFL 1.1 | https://github.com/rsms/inter |
| Fraunces (variable) via @fontsource-variable/fraunces 5.3.0 | Display font (bundled offline) | SIL OFL 1.1 | https://github.com/undercasetype/Fraunces |

## Native (Capacitor)

| Project | Used for | Licence | Source |
|---|---|---|---|
| Capacitor 8.6.0 (core, cli, android) | Native Android shell | MIT | https://github.com/ionic-team/capacitor |
| @capacitor/app 8.1.2, haptics 8.0.2, local-notifications 8.3.1, splash-screen 8.0.2, status-bar 8.0.4 | Back button, haptics, daily reminder, splash, status bar | MIT | https://github.com/ionic-team/capacitor-plugins |
| @capacitor-community/sqlite 8.1.1 | Local SQLite database | MIT | https://github.com/capacitor-community/sqlite |
| @capacitor-community/text-to-speech 8.0.2 | Native text-to-speech | MIT | https://github.com/capacitor-community/text-to-speech |
| @capacitor-community/speech-recognition 7.0.1 | Native speech recognition (speaking scores, role-play) | MIT | https://github.com/capacitor-community/speech-recognition |
| @aparajita/capacitor-secure-storage 8.0.1 | Android Keystore-backed storage for the user's Claude API key | MIT | https://github.com/aparajita/capacitor-secure-storage |

## Dev & test

| Project | Used for | Licence |
|---|---|---|
| Vitest 5.1.0, jsdom 30.1.3 | Unit tests | MIT |
| @types/react, @types/react-dom, @types/three, @types/node | Types | MIT |

## Brand assets

- App icon concept generated with **Canva** (Canva connector, `design/canva-icon-concept.png`), then redrawn as vector (`design/icon.svg`) for crisp Android sizes.
- Vocabulary illustrations are Unicode emoji rendered by the device's system font (no image files).

## Evaluated and not used

| Candidate | Why not |
|---|---|
| Tatoeba sentences (CC-BY 2.0 FR) | tatoeba.org is blocked by this build environment's network policy; all example sentences are original instead. |
| hermitdave/FrequencyWords (MIT code, CC-BY-SA 4.0 data) | Not maintained since 2022 and share-alike data; the AI engine targets CEFR level directly instead. |
| cmu-pronouncing-dictionary npm (ISC) | Unmaintained since 2022; ipa-dict gives IPA directly and is maintained. |
| first20hours/google-10000-english | No clear licence (NOASSERTION) — skipped per the licence rule. |
| jeep-sqlite (web SQLite shim) | Last release 2024; the browser dev build uses a small in-memory/localStorage store instead. |
| Unsplash photos | The Unsplash connector refused requests ("email address has not been confirmed"); emoji illustrations are used offline instead. |
