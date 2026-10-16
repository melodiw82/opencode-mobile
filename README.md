# OpenCode Mobile — Iran-friendly fork

**An Android client for the [opencode](https://github.com/sst/opencode) AI coding agent,
built to work where Google Play, Firebase Cloud Messaging and US analytics endpoints
are unavailable or blocked.**

This is a fork of [`dzianisv/opencode-mobile`](https://github.com/dzianisv/opencode-mobile)
(MIT). It talks to an opencode server **you run yourself** over your own network. Nothing
in the app phones home: there is no Google Play Services, no Firebase, no PostHog, no
Sentry, and no US-hosted push service.

> **Not affiliated with opencode.** This is an independent, community-built client. It
> is not made by, endorsed by, or affiliated with the opencode / Anomaly team.

---

## Why this fork exists

The upstream app is published through Google Play, ships Firebase (FCM) for push, and
reports crashes/analytics to Sentry and PostHog. In Iran — and anywhere those services
are blocked — that means the Play listing is unreachable, push never arrives, and the
app makes calls to endpoints that time out.

This fork removes every one of those dependencies and replaces each with a self-hosted
equivalent:

| Concern | Upstream | This fork |
|---|---|---|
| Install | Google Play · F-Droid · APK | **Direct APK** built by GitHub Actions, sideloaded |
| Push notifications | Firebase Cloud Messaging (Google) | **ntfy** (self-hosted or ntfy.sh) via a local `notify-bridge` |
| Crash reporting | Sentry (US SaaS) | **Disabled** — local log buffer only |
| Product analytics | PostHog (US/EU SaaS) | **Removed** |
| In-app review prompt | `expo-store-review` (Play) | **Removed** |
| Server transport | LAN · Cloudflare Tunnel · ngrok · Tailscale | **LAN · WireGuard** (Tailscale optional, works but can be unreliable in Iran) |

Nothing was removed from the *functionality* you use day to day — streaming chat, diff
viewing, tool-call approval, model/agent pickers, biometrics and multi-connection
management all still work exactly as upstream (see [Features](#features)).

---

## Install (Android, no Play Store)

1. On a computer, open the **Actions** tab of this repo → the latest green
   **“Build Android APK”** run → download the `app-release` artifact (it contains
   `app-release.apk`).
2. Copy the APK to your phone and install it (enable *Install unknown apps* for your
   file manager / browser).
3. The APK is signed with a debug key when no release keystore secret is configured;
   that is fine for personal sideloading. Add `KEYSTORE_BASE64` + `KEYSTORE_PASSWORD` +
   `KEY_ALIAS` + `KEY_PASSWORD` repo secrets to sign a stable release build.

> Builds run on GitHub’s runners, so you do not need a working Android SDK — or an
> unblocked Gradle/Maven mirror — on the phone side. To build locally from Iran, add a
> Maven mirror (see [Building from source](#building-from-source)).

---

## Quick start

### 1. Run an opencode server

On your laptop / VPS:

```bash
npm install -g opencode-ai
OPENCODE_SERVER_PASSWORD=yourpassword opencode serve --hostname 0.0.0.0 --port 4096
```

### 2. Reach it from the phone

Pick one:

- **Same Wi-Fi (simplest):** use your machine's LAN IP, e.g. `http://192.168.1.100:4096`.
- **Anywhere, without Tailscale (recommended for Iran):** run your own
  [WireGuard](https://www.wireguard.com/) tunnel between the phone and the machine and
  use the machine's WireGuard IP, e.g. `http://10.7.0.1:4096`. WireGuard is
  end-to-end encrypted and not dependent on any third-party control plane.
- **Tailscale (optional):** works, and is convenient, but its coordination servers can be
  slow or blocked from Iran — prefer WireGuard if reliability matters.

### 3. Add the connection in the app

Open the app → **Add Connection** → enter the URL and the password from step 1 → **Connect**.

### 4. (Optional but recommended) Background notifications without Firebase

The app shows local notifications while it is running. To get notified when a session
needs approval, asks a question, finishes, errors, or **hits a rate/usage limit** while
the app is backgrounded or closed, run the bundled bridge on the machine that runs
opencode:

```bash
# publishes opencode events to an ntfy topic
OPENCODE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD=yourpassword \
NTFY_URL=https://ntfy.sh NTFY_TOPIC=my-opencode-8f3a91 \
node bridge/notify-bridge.mjs
```

Install the **ntfy** Android app (available on F-Droid, so no Play needed), subscribe to
the same topic, and you will receive approvals, questions, completions, errors and
limit warnings. See [`bridge/README.md`](bridge/README.md) for a self-hosted ntfy, running
the bridge as a service, and keeping the topic private.

---

## Features

Everything below is inherited from upstream unless noted:

- **Streaming chat** — token-by-token responses from your opencode server
- **Diff viewer** — inline diffs of every file the agent changes
- **Tool-call approval** — approve/reject a tool call before it runs
- **Questions** — answer the agent's `question` prompts from the phone
- **Model, agent/mode and variant pickers** — switch freely per session
- **Multi-connection** — keep several servers (LAN + WireGuard + Tailscale) side by side
- **Biometric unlock** — Face/fingerprint gate for the app and for sends
- **Secure credentials** — stored in the Android Keystore via `expo-secure-store`
- **Offline demo** — “Try a Demo” plays a scripted bug-fix session with no server

Fork additions:

- **Usage-limit notifications** — a hit rate limit or free/usage quota raises a dedicated
  *Usage Limits* notification (separately toggleable, on by default), in-app and via the
  bridge. The upstream app folded these into generic errors.
- **No Google / US-SaaS calls** — see the table above.
- **`bridge/notify-bridge.mjs`** — a dependency-free relay from opencode’s SSE stream to
  ntfy.

---

## How it works

```
┌────────────────────────────┐        ┌────────────────────────────┐
│   OpenCode Mobile (this app)│        │        ntfy app            │
│   React Native / Expo       │        │  (F-Droid, no Play)        │
└──────────────┬─────────────┘        └──────────────▲─────────────┘
               │  HTTP + SSE                          │ push
               │  over LAN / WireGuard                │
               ▼                                      │
┌────────────────────────────┐        ┌───────────────┴────────────┐
│      opencode server        │◀──────▶│   bridge/notify-bridge.mjs │
│  (github.com/sst/opencode)  │  SSE   │   + ntfy server            │
└──────────────┬─────────────┘        └────────────────────────────┘
               │ API calls
               ▼
┌────────────────────────────┐
│  Your AI provider           │
│  (your keys, your bill)     │
└────────────────────────────┘
```

The app never touches your model API keys — your opencode server owns them.

---

## Building from source

```bash
npm install
npm test          # 277 unit tests (Node 22.17+, type-stripping)
npm run typecheck
```

Local Android build (`npx expo prebuild --platform android && npx expo run:android` or
`cd android && ./gradlew assembleRelease`). **From Iran**, add a reachable Maven mirror
in `android/build.gradle` / `android/settings.gradle` (for example a mirror that proxies
`google()` and `mavenCentral()`) and set `GRADLE_USER_HOME`; the committed `google()` /
`mavenCentral()` repositories may be blocked or extremely slow.

CI (`.github/workflows/build.yml`) builds a sideloadable `app-release.apk` on every push
to `main` and attaches it to the artifact store. Tagging `v*` also produces a GitHub
Release with the APK.

---

## Notifications inventory

| Category | Fires when | Default |
|---|---|---|
| Permission Requests | a tool needs approval | on |
| Questions | the agent asks you something | on |
| Task Completed | a run goes busy → idle | off |
| Errors | a session hits a non-limit error | on |
| **Usage Limits** | a model is rate limited, or a free/usage quota is hit | on |
| Connection | the app loses the server for a while | on |

All six work as in-app notifications while it runs, and all six are published by the
bridge for background delivery.

---

## Status & differences from upstream

- Android only. No iOS, no Play listing, no F-Droid self-hosted repo (build the APK).
- Crash reporting/analytics are no-ops by design; a local log buffer is kept for
  diagnostics.
- The app remains MIT-licensed; upstream copyright and attribution are preserved.

---

## Privacy

No data leaves your device and your server except the AI requests your opencode server
makes with your own keys. Credentials live only in the Android Keystore. The optional
`notify-bridge` runs on your machine and posts to the ntfy server **you** choose.

---

## License

MIT — see [LICENSE](LICENSE).

Based on OpenCode Mobile, Copyright (c) 2026 VIBE TECHNOLOGIES, LLC.

## Acknowledgments

- [`sst/opencode`](https://github.com/sst/opencode) — the agent this client drives (MIT)
- [`dzianisv/opencode-mobile`](https://github.com/dzianisv/opencode-mobile) — the upstream client (MIT)
- [Expo](https://expo.dev) — the React Native toolchain
- [ntfy](https://ntfy.sh) — the self-hostable push service used by the bridge
