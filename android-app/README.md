# Dispatch Android app

A Capacitor app that shows https://dispatch-delivery.vercel.app full screen,
with native pieces a browser cannot provide:

- **No address bar, ever.** Pages from the site stay in the app; any other
  link (Google Maps from the Navigate button, for example) is handed to the
  phone's own app for it.
- **Native Google sign-in.** The site's login page detects the app
  (`src/lib/nativeApp.ts`) and uses the phone's account sheet through
  `@capgo/capacitor-social-login` instead of Google's web pages.
- **App Links.** Links to the site open in the app.

Website changes need no new APK: the app always loads the live site.

## Building

Run the **Android app** workflow from the Actions tab. It signs with the same
key as the earlier Trusted Web Activity builds (repository secrets
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_PASSWORD`),
so it installs over them as an update, and uploads `Dispatch-<version>.apk`.

Raise `versionCode` and `versionName` in `android/app/build.gradle` for every
release.

## Google sign-in setup

In Google Cloud project *delivery-route-optimizer*:

- Web client `dispatch-web`: used by Supabase and passed as `webClientId`.
- Android client `dispatch-android`: package `com.dispatch.app`, SHA-1
  `5F:F5:8C:ED:CC:13:12:BB:C9:8D:5B:35:6B:3D:0F:F2:BB:44:B1:E2`. It is never
  referenced in code; it only authorises this package and key.
