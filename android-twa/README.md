# Android TWA

This folder holds the *source* of the Android app: a Trusted Web Activity that
wraps https://delivery-route-optimizer-eight.vercel.app in a native shell.

Only `twa-manifest.json` is committed. Everything else — the generated Gradle
project, the keystore, the APK — is built on demand and ignored by git.

## Building

Run the **Android APK** workflow from the Actions tab. It builds on Ubuntu and
uploads `app-release-signed.apk` plus the signing fingerprint as an artifact.

It is manual on purpose: the APK only needs rebuilding when the web manifest,
the icons or the version change, not on every commit.

### Required repository secrets

| Secret | What it is |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | The signing keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Its store password |
| `ANDROID_KEY_PASSWORD` | The `android` key's password |

**The keystore is not replaceable.** Once an app is published under a given
key, every future update must be signed with that same key. Losing it means
losing the ability to update the app at all. Keep a copy somewhere safe and
off this machine.

To encode an existing keystore:

```bash
base64 -w0 android.keystore > keystore.b64
```

To create a new one, if you ever need to start over:

```bash
keytool -genkeypair -v -keystore android.keystore -alias android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Dispatch, OU=Dev, O=Dispatch, L=Kolkata, S=WB, C=IN"
```

## After the first build: digital asset links

The workflow prints the certificate's SHA-256 fingerprint. Until that value is
published at `/.well-known/assetlinks.json`, Android cannot verify that this
app is allowed to render the site, and it falls back to showing a browser URL
bar across the top of every screen.

Put the fingerprint into `public/.well-known/assetlinks.json` and redeploy:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.dispatch.app",
    "sha256_cert_fingerprints": ["<fingerprint from the build log>"]
  }
}]
```

Verify afterwards at
https://developers.google.com/digital-asset-links/tools/generator.

## Why this is not built locally

Gradle forks a JVM and talks to it over a loopback socket. On this Windows
machine that fork cannot open an NIO selector — `Pipe.open()` fails with
`SocketException: Invalid argument: connect` from the AF_UNIX layer — so every
Gradle build dies before it compiles anything. It is not specific to Gradle or
to a JDK version: a three-line Java program fails the same way inside a forked
process, while succeeding when run directly.

The Linux runner has no such problem, and CI is where a release build belongs
anyway.
