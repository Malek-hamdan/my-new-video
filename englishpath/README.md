# EnglishPath

Learn English from absolute zero (Pre-A1) to mastery (C2) — and keep going forever.
An Android app built with React + TypeScript + Vite and packaged natively with Capacitor 8.

- **Fixed curriculum, locked progression**: 7 CEFR levels → 54 units → 162 lessons. Pre-A1 and A1 units 1–3 (18 lessons) are fully written and built in; the rest of the outline is generated lesson-by-lesson by Claude at your level and saved for offline use.
- **Every lesson, in order**: Vocabulary (word, IPA, audio, emoji illustration, example) → Grammar (explanation, examples, common mistakes, practice) → Reading → Listening → Speaking (word-by-word accuracy) → Writing (AI correction with explanations; offline rule check without a key) → Quiz. **80%+ on the quiz unlocks the next lesson.**
- **Endless**: after C2 the path continues with generated mastery units; offline “Endless practice” remixes everything you've passed, weighted to weak points; new dialogues are generated on demand.
- **Dialogues tab**: 10 built-in scenarios (greetings → negotiation), Listen & learn, and Role-play (Claude plays the other side and corrects every turn; offline script mode without a key).
- **Review**: FSRS-7 spaced repetition (ts-fsrs) for every learned word and grammar point.
- **Progress**: level, XP rank, streak, words learned, daily goal, accuracy per skill, weak points, achievements, daily reminder notification.
- **Settings**: your own Claude API key (Android Keystore-backed secure storage), model choice, theme (dark/light/system), motion, voice speed.

## Get the APK and install it on your phone

### Option A — download from GitHub Actions (no tools needed)

1. Open the repository on GitHub → **Actions** tab → workflow **“EnglishPath Android APK”**.
2. Open the latest run with a green check (or press **Run workflow** to start one).
3. Scroll to **Artifacts** and download **EnglishPath-apk** (a `.zip`). Unzip it → `EnglishPath-<number>.apk`.
4. Copy the APK to your phone (USB, Google Drive, or email it to yourself).
5. On the phone, tap the APK. Android will ask to allow installs from that app (Files/Drive/Chrome): **Settings → Allow from this source**, then go back and tap **Install**.
6. Open **EnglishPath**. Allow the microphone when you first use Speaking, and notifications if you turn on the daily reminder.

The APK is a debug-signed build (installable on any Android 7.0+ phone, `minSdk 24`). Each workflow run has a higher version code, so a newer APK installs over the old one and keeps your progress.

### Option B — build it yourself

Requirements: Node 24, JDK 21, Android SDK (platform 36) — e.g. via Android Studio.

```bash
cd englishpath
npm ci
npm test                 # unit tests (Vitest)
npm run build            # type check + web build → dist/
npx cap sync android     # copy web build + plugins into android/
cd android && ./gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk   # with USB debugging on
```

Or open `englishpath/android` in Android Studio and press Run.

## Add your Claude API key (for endless content)

Settings → **AI engine** → paste a key from <https://console.anthropic.com> (API keys) → **Save** → **Test connection**.
The key is stored with `@aparajita/capacitor-secure-storage` (encrypted with an Android Keystore key), is never hard-coded, logged or written in plain text, and is only sent to `api.anthropic.com`. Backups are disabled for the app. Built-in lessons, saved/generated content, review and practice all work offline without a key.

Default model: Claude Opus 5.5 (best quality). Sonnet 5.5 and Haiku 5.5 are cheaper options in Settings. Each generated item uses structured JSON output, is validated with Zod, retried once if invalid, then cached in the local SQLite database.

## Development

```bash
npm run dev              # browser preview at http://localhost:5173 (Escape = Android back)
npm run typecheck
npm test                 # 27 unit tests: curriculum integrity, 80% gate, FSRS, speech scoring, AI retry
npm run build && npm run preview &   # then:
npm run e2e              # Playwright end-to-end checks against the built app (uses playwright-core)
node e2e/review-progress.mjs
npm run gen:ipa          # rebuild src/content/ipa.json from ipa-dict
```

In the browser the app uses a small localStorage store instead of SQLite, the Web Speech API instead of the native plugins, and keeps the API key in memory only.

### Project layout

```
src/content/      curriculum outline, built-in lessons, dialogues, placement test, Zod schemas, IPA
src/engine/       progression rules, quiz builder, FSRS deck, speech scoring, offline checks, stats
src/engine/ai/    Claude client (lazy SDK), prompts, generation + cache
src/db/           SQLite store (Android) and web fallback
src/native/       TTS, speech recognition, notifications, secure key storage, back button, haptics
src/screens/      Learn, Lesson player, Dialogues, Review, Progress, Settings, Onboarding
src/components/   UI kit (shadcn patterns), ported 21st.dev + React Bits components, 3D globe
android/          Capacitor Android project
e2e/              Playwright end-to-end scripts
```

## Native features: what works and fallbacks

| Feature | Android | Fallback |
|---|---|---|
| Text-to-speech | Native TTS (`@capacitor-community/text-to-speech`, en-US voice installed on the phone) | If no English voice is installed, Android prompts to install one in *Settings → Text-to-speech*. |
| Speech recognition | Google speech service via `@capacitor-community/speech-recognition` (needs the Google app/speech services and usually internet) | When unavailable (e.g. de-Googled phones), Speaking switches to **say it, then type what you said** and is still scored word by word; role-play accepts typing. |
| Daily reminder | `@capacitor/local-notifications`, daily at your chosen time | Android 13+ asks for permission; if denied, Settings explains how to allow it. Some battery savers can delay it by a few minutes. |
| SQLite | `@capacitor-community/sqlite` | — |
| Secure key storage | Android Keystore via `@aparajita/capacitor-secure-storage` | — |
| Back button | Pops screens; inside a lesson it asks before leaving; on the Learn home it moves the app to the background (never kills it) | — |

## Licences

See [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for every package, dataset and component used, with its licence. Research notes: [docs/RESEARCH.md](docs/RESEARCH.md).
