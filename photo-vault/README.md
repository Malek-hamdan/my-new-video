# خزنة الصور (Photo Vault)

Android app: moves photos from the gallery into an encrypted in-app vault and removes them from the gallery ("cut").

- PIN + fingerprint lock; the app locks itself when it goes to the background and is hidden from screenshots/recents.
- Photos are encrypted with AES-256-GCM using a key held in the Android Keystore, stored in the app's private folder.
- Each photo is read back and checked (SHA-256) before the original is deleted from the gallery.
- Android 12+: enable "Media management" once (button on the main screen) and deletion from the gallery happens with no confirmation dialog. Android 11 shows one confirmation per batch.
- In-app camera saves straight to the vault, never to the gallery.
- Restore a photo back to the gallery (Pictures/Restored) or delete it permanently.

Uninstalling the app deletes the vault and its key — restore photos first.

## Build

CI (`.github/workflows/photo-vault-apk.yml`) builds `dist/PhotoVault.apk` on every push that touches this folder.
Locally: `gradle assembleRelease` with the Android SDK (compileSdk 34) installed.

`app/vault.keystore` is a fixed signing key so updates install over earlier builds; it is not a Play Store key.
