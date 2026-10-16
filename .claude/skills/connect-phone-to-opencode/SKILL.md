---
name: connect-phone-to-opencode
description: Set up an Iran-friendly link between the phone and an opencode server — WireGuard tunnel, server start, app connection, and the ntfy notification bridge. Use when the user asks how to connect the phone, get notifications, or reach the server from outside the LAN.
---

# Connect the phone to an opencode server

## 1. Start the server (laptop / VPS)

```bash
npm install -g opencode-ai
OPENCODE_SERVER_PASSWORD=yourpassword opencode serve --hostname 0.0.0.0 --port 4096
```

## 2. Reach it from the phone

- **LAN:** `http://<machine-LAN-IP>:4096`.
- **Remote (recommended for Iran):** a self-hosted WireGuard tunnel, then
  `http://<wg-server-ip>:4096`. Avoid Tailscale if reliability matters — its coordination
  servers can be slow/blocked.
- **Do not** expose port 4096 to the public internet without a tunnel.

Add the connection in the app: *Add Connection* → URL + `OPENCODE_SERVER_PASSWORD` → Connect.

## 3. Background notifications (no Firebase)

```bash
# self-hosted ntfy (or use ntfy.sh)
npm run bridge -- --opencode http://127.0.0.1:4096 --ntfy-url https://ntfy.example.com --topic my-opencode
```

Subscribe to that topic with the F-Droid `ntfy` app. The relay maps opencode SSE events
(permissions, questions, completions, errors, rate/quota limits) to ntfy messages, so alerts
arrive with the app closed.

## 4. Verify

- In-app: send a prompt and confirm a streaming reply (proves HTTP+SSE).
- Background: stop the app, trigger a permission request, confirm the ntfy notification.
- `npm run bridge -- --once` does a single dry-run pass if `--ntfy-url ""` is set.
