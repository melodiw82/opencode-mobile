# OpenCode Mobile — Iran-friendly fork

Control your [`opencode`](https://github.com/sst/opencode) coding agent from your phone —
send prompts, switch model/agent, answer questions, approve permissions, get notified. A fork
of [`dzianisv/opencode-mobile`](https://github.com/dzianisv/opencode-mobile) that works
without any service blocked or unavailable in Iran: **no Google Play Services, no
Firebase/FCM, no PostHog, no Sentry**.

[![Build Android APK](https://github.com/melodiw82/opencode-mobile/actions/workflows/build.yml/badge.svg)](https://github.com/melodiw82/opencode-mobile/actions/workflows/build.yml)

---

## Why this fork

Upstream is built for the Play Store and ships telemetry to third-party SaaS. From Iran those calls
fail or hang, and the app can't be published — so the client is unusable out of the box. This
fork removes the whole third-party surface and ships as a **self-installed APK built by GitHub
Actions**, so nothing in the app talks to a service you can't reach.

| | Upstream | This fork |
|---|---|---|
| Distribution | Google Play · F-Droid · APK | **Direct APK** from GitHub Actions (sideload) |
| Notifications | Firebase (FCM) | **Self-hosted `ntfy`** + in-app |
| Crash reporting | Sentry | **Removed** — local log buffer only |
| Analytics | PostHog | **Removed** |
| Rate/quota alerts | folded into generic errors | **dedicated “Usage Limits” notification** |
| Credentials | Play/OS keystore | OS keystore (Android) · `localStorage` (web) |
| Targets | Android + iOS | **Android** (primary) + **web SPA** (secondary) |

**The result:** the same capable client, minus everything that breaks in Iran — and one new
notification channel you'll actually want (usage limits).

---

## What it does

- **Chat with the agent** over HTTP + SSE, with streaming replies and diffs
- **Model, agent/mode and variant pickers**, switched per session
- **Permission prompts and questions** answered from the phone
- **Multiple connections** (LAN, WireGuard, Tailscale) side by side
- **Biometric unlock**, OS-keystore credentials, offline demo session
- **Notifications** for permissions, questions, completions, errors, connection loss, and
  **rate/quota limits** — with a built-in Android keep-alive, so they arrive with the app
  backgrounded and no Firebase involved

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

## How to use it

Three things: run the server, point the phone at it, done.

### 1. Run the server (on your laptop or a VPS)

```bash
npm install -g opencode-ai
OPENCODE_SERVER_PASSWORD=pick-a-password opencode serve --hostname 0.0.0.0 --port 4096
```

That's it — that one command is the backend the phone talks to.

### 2. Point the phone at it

- **Same Wi-Fi (30 seconds):** put `http://<your-laptop-IP>:4096` in the app, log in with the
  password above. Find the IP with `ipconfig` (Windows) or `ip addr` (Linux).
- **Away from home:** install the free [WireGuard](https://www.wireguard.com/install/) app
  (also on F-Droid), run the [wg-easy](https://github.com/wg-easy/wg-easy) Docker image on
  your server, scan the QR code in its web UI once, and use the server's tunnel IP. No
  account, no third party, nothing to configure by hand.

### 3. Use it

*Add Connection* → URL + password → **Connect** → pick a model → chat. Permissions, questions,
model/agent switching and diffs all work from the phone.

---

## Notifications

**Built in by default** — nothing to run. While the app is connected, a quiet foreground
service (Android, no Firebase) keeps the session alive so alerts arrive even with the screen
off or the app in the background. Turn it off in **Settings → Notifications → Keep Connected in
Background**.

| Category | Fires when | Default |
|---|---|---|
| Permission Requests | a tool needs approval | on |
| Questions | the agent asks you something | on |
| Task Completed | a run goes busy → idle | off |
| Errors | a session hits a non-limit error | on |
| **Usage Limits** | rate limited, or a free/usage quota is hit | on |
| Connection | the server is unreachable for a while | on |

**Optional: never miss one while the app is closed.** If the phone kills the app, run the
included relay on the machine that runs opencode — it forwards events to a self-hosted
[`ntfy`](https://ntfy.sh) topic you subscribe to with the F-Droid ntfy app:

```bash
npm run bridge -- --opencode http://127.0.0.1:4096 --ntfy-url https://ntfy.sh --topic my-opencode
```

See [`bridge/README.md`](bridge/README.md) for flags (dry-run, `--once`, auth).

---

## Web build (optional)

```bash
npm run export:web        # -> dist/ (index.html + one JS bundle)
npx serve dist            # serve from an origin you trust
```

Serve it and open it in a browser; it talks to the same server. Add that origin to the server
so the browser is allowed to connect:

```bash
opencode serve --hostname 0.0.0.0 --port 4096 --cors https://your-web-origin
```

Native-only features (biometrics, the background service) are inert on web; the ntfy relay
still delivers alerts. Credentials live in `localStorage`, so only serve it from a trusted
origin.

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

## License

MIT — see [LICENSE](LICENSE). Based on OpenCode Mobile, © 2026 VIBE TECHNOLOGIES, LLC.
`opencode` and the upstream client are MIT; attribution is preserved.
