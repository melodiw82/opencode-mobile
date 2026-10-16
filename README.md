# OpenCode Mobile — Iran-friendly fork

Control your [`opencode`](https://github.com/sst/opencode) coding agent from your phone.
This is a fork of [`dzianisv/opencode-mobile`](https://github.com/dzianisv/opencode-mobile),
rewired to work without any service that is blocked or unavailable in Iran: **no Google Play
Services, no Firebase/FCM, no PostHog, no Sentry, no US-hosted push**.

[![Build Android APK](https://github.com/melodiw82/opencode-mobile/actions/workflows/build.yml/badge.svg)](https://github.com/melodiw82/opencode-mobile/actions/workflows/build.yml)

---

## Why this fork

Upstream targets the Play Store and reports telemetry to US SaaS. From Iran those calls fail
or hang, and the app can't be published. This fork keeps the same client — send prompts,
switch agent/model, answer questions, approve permissions — but sends **nothing to a third
party** and ships as a self-installed APK.

| | Upstream | This fork |
|---|---|---|
| Distribution | Google Play · F-Droid · APK | **Direct APK**, built by GitHub Actions (sideload) |
| Push / notifications | Firebase (FCM) | **Self-hosted `ntfy`** (+ in-app) |
| Crash reporting | Sentry | **Removed** — local log buffer only |
| Analytics | PostHog | **Removed** |
| Rate-limit alerts | generic errors | **dedicated “Usage Limits” notification** |
| Credentials | Play/OS keystore | OS keystore on Android, `localStorage` on web |
| Targets | Android + iOS | **Android** (primary) + **web SPA** (secondary) |

---

## What it does

- **Chat with the agent** over HTTP + SSE, with streaming replies and diffs
- **Model, agent/mode and variant pickers**, switched per session
- **Permission prompts and questions** answered from the phone
- **Multiple connections** (LAN, WireGuard, Tailscale) side by side
- **Biometric unlock**, OS-keystore credentials, offline demo session
- **Notifications** (in-app and background) for permissions, questions, completions,
  errors, connection loss, and **rate/quota limits**

---

## Install (Android, no Play Store)

1. Open this repo's **Actions** → latest green **Build Android APK** → download the
   `app-release` artifact (`app-release.apk`).
2. Copy it to the phone and install (allow *Install unknown apps* for your file manager).
3. No release keystore configured ⇒ the APK is debug-signed. That is fine for personal
   sideloading; add the `KEYSTORE_BASE64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` /
   `KEY_PASSWORD` repo secrets for a stable release signature.

You do **not** need an Android SDK or an unblocked Maven mirror on the phone side — the APK
is built on GitHub's runners.

---

## Quick start

**1. Run an opencode server** (on your laptop or a VPS):

```bash
npm install -g opencode-ai
OPENCODE_SERVER_PASSWORD=yourpassword opencode serve --hostname 0.0.0.0 --port 4096
```

**2. Reach it from the phone:**

- *Same Wi-Fi:* use the machine's LAN IP, e.g. `http://192.168.1.100:4096`.
- *Anywhere (recommended for Iran):* a self-hosted [WireGuard](https://www.wireguard.com/)
  tunnel, then use the tunnel IP, e.g. `http://10.7.0.1:4096`. No third-party control plane.
- *Tailscale:* works, but its coordination servers can be slow or blocked from Iran.

**3. In the app:** *Add Connection* → URL + password → **Connect**.

---

## Notifications

Alerts appear in-app while the app runs, and in the background via a small relay to a
self-hosted [`ntfy`](https://ntfy.sh) server — subscribe with the F-Droid ntfy app, no Play
needed.

| Category | Fires when | Default |
|---|---|---|
| Permission Requests | a tool needs approval | on |
| Questions | the agent asks you something | on |
| Task Completed | a run goes busy → idle | off |
| Errors | a session hits a non-limit error | on |
| **Usage Limits** | rate limited, or a free/usage quota is hit | on |
| Connection | the server is unreachable for a while | on |

```bash
npm run bridge            # stream opencode events -> your ntfy topic
```

See [`bridge/README.md`](bridge/README.md) for flags (dry-run, `--once`, topic/URL).

---

## Web build (optional)

```bash
npm run export:web        # -> dist/ (index.html + one JS bundle)
npx serve dist            # serve from an origin you trust
```

Handy when installing an APK is awkward. Native-only features (biometrics, local
notifications) are inert on web; the ntfy relay still delivers alerts. On web, credentials
live in `localStorage`, so only serve it from a trusted origin.

---

## Build from source

```bash
npm install
npm test                  # 280 unit tests (Node 22.17+)
npm run typecheck
npm run check:versions
```

Android: `npx expo prebuild --platform android && npx expo run:android`. The `android/`
project is **not committed** — it is regenerated from `app.json` on every build, so a stale
native tree can't break it. **From Iran**, add a Maven mirror that proxies `google()` /
`mavenCentral()` to the generated Gradle files and set `GRADLE_USER_HOME`.

CI (`.github/workflows/build.yml`) builds the APK and the web bundle on every push to `main`
and on `v*` tags; a tag also attaches the APK to a GitHub Release.

---

## Privacy

Nothing leaves your device and your server except the AI requests your opencode server makes
with your own keys. The app never sees your model API keys. The optional relay runs on your
machine and posts to the ntfy server **you** choose.

---

## Verified

Checked against the current `main`; claims here are what actually passed, not aspirations:

- **CI green** on the latest `main` commit — jobs *test*, *Build Android APK*, *web export*
  all success; artifact `app-release` (~35 MB) built and downloadable.
- **280 unit tests pass**, `tsc --noEmit` clean, version parity aligned (0.4.15 / 42).
- **Web export** produces `dist/` with a single SPA bundle.
- **ntfy bridge** smoke-tested: fake SSE stream → dry-run publish, and against a fake ntfy
  server (asserted title/priority/tags/click/body).

Not verified here: on-device runtime in the maintainer's environment (no Android SDK / browser
automation available). Install the APK and add a connection to confirm end-to-end on your
setup.

---

## License

MIT — see [LICENSE](LICENSE). Based on OpenCode Mobile, © 2026 VIBE TECHNOLOGIES, LLC.
`opencode` and the upstream client are MIT; attribution is preserved.
