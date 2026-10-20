# App signing

Release builds are signed with one fixed **upload key** so that each new APK installs as an
update over the previous one (keeping the player's saved progress), and so the same key can
upload the AAB to Google Play.

The key is never committed. GitHub Actions reads it from two repository secrets
(Settings → Secrets and variables → Actions → New repository secret):

| Secret | Value |
|---|---|
| `RB_KEYSTORE_B64` | the `rollingball-upload.jks` keystore, base64-encoded on one line |
| `RB_STORE_PASSWORD` | the keystore password (the key uses the same password; alias `upload`) |

Without them the build stops with an error rather than publishing an unsigned or debug build.

Keep a private backup of the keystore and password. If it is ever lost after the app is on
Google Play, the upload key can be reset through Play Console (with Play App Signing).
