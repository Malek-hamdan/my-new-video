# App signing

Every build installs as an update over the previous one, so players keep their saved progress.

- **Download-link builds** are signed with `android/sideload.jks`, kept in the repo on purpose so
  CI can build with no setup. It only identifies builds installed straight from the GitHub
  release; it is not the Google Play key.
- **Google Play** needs the private **upload key**. It is never committed: when the repository
  secrets below are set, CI signs the APK and the AAB with it instead.

| Secret | Value |
|---|---|
| `RB_KEYSTORE_B64` | the upload keystore, base64-encoded on one line |
| `RB_STORE_PASSWORD` | the upload keystore password (alias `upload`, same key password) |

Switching a phone from a sideload build to the Play build (or back) needs one uninstall, since
the two are signed with different keys.
