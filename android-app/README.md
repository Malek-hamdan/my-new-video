# FieldLog (Android)

A private voice recorder that keeps recording with the screen off, cleans the
audio in three levels, and stops on a triple Volume-Down press.

## v2 additions
- **AI noise removal (RNNoise, on-device)** — native C (Xiph RNNoise, BSD) built via the
  NDK and blended into each level (`Rnnoise.kt`, `cpp/`, `Enhancer.processAi`). Toggle in
  Settings; falls back to the DSP path if the native lib is unavailable.
- **Split by speaker** — model-free, on-device diarization (`Diarizer.kt`): MFCC features,
  energy VAD, ~1 s embeddings, k-means. From a recording's menu → "Split by speaker";
  plays one speaker's turns only. Approximate: best for turn-taking, can't name speakers.

## v1 features
- **Custom, neutral notification** — shows "FieldLog" and a timer, never the word "recording".
- **Records with the screen off / phone in pocket** via a foreground microphone service.
- **Three enhancement levels** — Light / Medium / Strong (`Enhancer.kt`), applied when you stop.
- **Keep original copy** — optional untouched backup saved alongside the cleaned file.
- **Volume-Down ×3 stops the session** while the screen is off (`VolumeKeyService`, an
  Accessibility service you enable once; it reads no screen content).
- **App PIN lock** — default `2026`, change it in Settings on first run.
- **Recordings list** — play, rename, share, delete. Files are saved as 48 kHz WAV under
  the app's external files folder.

## Not in v1 (planned)
- AI noise removal (RNNoise, on-device) and speaker split. These need native (NDK) work
  and are a second phase.

## Known limits
- Android always shows the green microphone dot while recording; no app can hide it.
- Volume-key capture with the screen off works on most phones but not all; the notification's
  **Stop & save** action is the reliable fallback.

## Build
CI builds the APK automatically (see `.github/workflows/android.yml`). To build locally with
an Android SDK installed:

```
cd android-app
./gradlew assembleDebug
# APK: app/build/outputs/apk/debug/app-debug.apk
```
