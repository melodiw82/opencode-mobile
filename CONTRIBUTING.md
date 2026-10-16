# Contributing

Thanks for helping. This fork keeps a hard constraint: **no Google Play Services, Firebase,
FCM, PostHog, Sentry, or any US third-party analytics/push SDK.** PRs that add such a
dependency will be declined. See [`AGENTS.md`](AGENTS.md) for the architecture and patterns.

## Setup

```bash
git clone https://github.com/melodiw82/opencode-mobile.git
cd opencode-mobile
npm install
```

Node 22.17+ is required (`npm test` uses `--experimental-strip-types`).

## Checks before you push

```bash
npm test              # unit tests
npm run typecheck     # tsc --noEmit
npm run check:versions
```

CI runs the same on every push, plus an Android APK build and a web export.

## Running against a real server

```bash
npm install -g opencode-ai
OPENCODE_SERVER_PASSWORD=devpassword opencode serve --hostname 0.0.0.0 --port 4096
npx expo run:android    # full dev build (Expo Go can't load biometric/secure-store modules)
```

Emulator: `http://10.0.2.2:4096`. Physical device: `http://<your-LAN-IP>:4096`.

## Conventions

- Functional components with typed props; zustand stores in `src/stores/`; HTTP/SSE through
  `src/lib/sdk.ts`; file-based screens via Expo Router under `app/`.
- Prefer `const`, early returns, no `try/catch` where avoidable, no `any`.
- New persisted keys must be added to `ALLOWED_PERSISTED_KEYS` in
  `src/lib/persisted-keys.test.ts`. Never persist model or tool output.

## Pull requests

Fork, branch off `main`, keep commits focused, make sure the checks above pass, then open a PR
against `main`. UI changes should include a screenshot.
