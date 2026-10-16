# notify-bridge

Self-hosted background notifications for the OpenCode mobile client — **no Firebase, no
Google Play Services, no US third-party SaaS**.

The app can only show notifications while it is alive. `notify-bridge.mjs` runs on the
machine that hosts your opencode server, tails the server's Server-Sent Events stream
(`GET /global/event`), and republishes the events you care about to an
[ntfy](https://ntfy.sh) server. The ntfy Android app — installable from **F-Droid**, so
it needs no Play account — delivers them even when OpenCode Mobile is backgrounded or
swiped away.

```
opencode server ──SSE──▶ notify-bridge ──HTTP──▶ ntfy ──push──▶ ntfy app (phone)
```

## Requirements

- Node.js 20+ (uses the built-in `fetch`). No npm dependencies.
- An ntfy server: the public `https://ntfy.sh`, or (recommended) your own.
- The `ntfy` Android app: F-Droid (`io.heckel.ntfy`) or an APK.

## Quick start

```bash
# 1. run it in the foreground to try it
OPENCODE_URL=http://127.0.0.1:4096 \
OPENCODE_PASSWORD=yourpassword \
NTFY_URL=https://ntfy.sh \
NTFY_TOPIC=my-opencode-ChooseA-RandomSuffix \
node bridge/notify-bridge.mjs

# 2. in the ntfy app, subscribe to the same topic.
# 3. trigger something in the app (ask the agent for approval) and watch it arrive.
```

Use a **long, random topic name** on a public ntfy server — the topic is the only secret
in the naive setup. For anything sensitive, self-host (below).

### Options

| Flag | Env | Default | Meaning |
|---|---|---|---|
| `--opencode-url` | `OPENCODE_URL` | `http://127.0.0.1:4096` | opencode server base URL |
| `--user` | `OPENCODE_USER` | `opencode` | Basic-auth username |
| `--password` | `OPENCODE_PASSWORD` | *(none)* | Basic-auth password |
| `--ntfy-url` | `NTFY_URL` | `https://ntfy.sh` | ntfy base URL; **empty string = dry-run** |
| `--topic` | `NTFY_TOPIC` | *(required)* | ntfy topic to publish to |
| `--token` | `NTFY_TOKEN` | *(none)* | ntfy bearer token (self-hosted auth) |
| `--click` | `NTFY_CLICK` | *(none)* | URL opened when a notification is tapped |
| `--once` | — | off | exit after the first publish (smoke test) |
| `--verbose` | — | off | log every event, not just published ones |

`--ntfy-url ""` makes the bridge print what it *would* send without contacting anything —
handy for testing.

## What gets published

| Event | Title | Priority | Tags |
|---|---|---|---|
| `permission.asked` | Approval needed | 4 | shield |
| `question.asked` | the question header | 4 | question |
| `session.error` with a throttle phrase | Rate limited | 4 | hourglass, warning |
| `session.error` with a quota phrase | Usage limit reached | 4 | moneybag, warning |
| `session.error` otherwise | Session error | 4 | x |
| `session.status` busy → idle | Task completed | 3 | white_check_mark |
| `session.status` retry | Rate limited | 3 | hourglass |

Identical events within a 2-minute window are suppressed (`--once` disables that).

## Self-hosted ntfy (recommended)

Running ntfy on the same box as opencode keeps the whole path on your own infrastructure:

```bash
# Docker
docker run -p 8080:80 -v /var/cache/ntfy:/var/cache/ntfy binwiederhier/ntfy \
  serve --cache-file /var/cache/ntfy/cache.db
```

Then point both the bridge and the ntfy app at `http://<host>:8080`, and turn on ntfy's
built-in access control if the server is reachable beyond your LAN/WireGuard:

```bash
NTFY_URL=http://127.0.0.1:8080 NTFY_TOPIC=opencode NTFY_TOKEN=<your-token> \
OPENCODE_URL=http://127.0.0.1:4096 OPENCODE_PASSWORD=yourpassword \
node bridge/notify-bridge.mjs
```

In the ntfy app: **Settings → Manage users → Add → Use another server**, enter
`http://<host>:8080` and the same credentials.

## Running it as a service

**systemd (Linux):** create `/etc/systemd/system/notify-bridge.service`:

```ini
[Unit]
Description=opencode notify-bridge
After=network-online.target

[Service]
Environment=OPENCODE_URL=http://127.0.0.1:4096
Environment=OPENCODE_PASSWORD=yourpassword
Environment=NTFY_URL=http://127.0.0.1:8080
Environment=NTFY_TOPIC=opencode
Environment=NTFY_TOKEN=your-token
ExecStart=/usr/bin/node /opt/opencode-mobile/bridge/notify-bridge.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now notify-bridge
```

**Windows:** run it under `pm2` (`pm2 start bridge/notify-bridge.mjs --name notify-bridge`),
or a Task Scheduler job with trigger *At startup* and action `node <repo>\bridge\notify-bridge.mjs`,
setting the env vars in the task.

The bridge reconnects automatically with exponential backoff if the stream drops.

## Troubleshooting

- **Nothing arrives.** Run with `--verbose` and confirm events are seen. Then check the
  topic is subscribed in the ntfy app and that `--ntfy-url` is reachable *from the
  bridge host*.
- **HTTP 401/403 from ntfy.** The server has access control; set `NTFY_TOKEN` (bearer) or
  include credentials in `NTFY_URL`.
- **HTTP 401 from opencode.** Set `OPENCODE_PASSWORD` (and `OPENCODE_USER` if you changed
  the default).
- **`--ntfy-url ""` prints but sends nothing.** That is dry-run by design.

## Tests

```bash
node --test bridge/notify-core.test.mjs
```

These cover the event→notification mapping, limit classification, dedupe and SSE framing.
