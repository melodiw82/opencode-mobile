#!/usr/bin/env node
// notify-bridge — self-hosted background notifications for the OpenCode mobile
// client, with no Firebase, no Google Play services and no US third-party cloud.
//
// It tails the opencode server's `/global/event` SSE stream from your own
// machine and republishes the events you care about to an ntfy server (public
// ntfy.sh or, better, your own). The ntfy Android app — available on F-Droid,
// so it installs without Play — delivers them. This is the Iran-friendly path
// that the in-app local notifications cannot cover while the app is killed.
//
// Usage:
//   OPENCODE_URL=http://127.0.0.1:4096 \
//   NTFY_URL=https://ntfy.sh NTFY_TOPIC=my-opencode-<random> \
//   node bridge/notify-bridge.mjs
//
// See bridge/README.md for the full setup, including a self-hosted ntfy and
// running this as a background service.
//
// Dependency-free: Node >= 20 (uses global fetch and node:util parseArgs).

import { parseArgs } from "node:util"
import { createMapper, makeDedupe } from "./notify-core.mjs"

const DEDUPE_COOLDOWN_MS = 120_000
const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000]

function usage() {
  return `notify-bridge — relay opencode events to ntfy

Options (env var in parentheses):
  --opencode-url URL   opencode server base URL (OPENCODE_URL)   [http://127.0.0.1:4096]
  --password PW        server Basic-auth password (OPENCODE_PASSWORD)
  --user USER          server Basic-auth username (OPENCODE_USER) ["opencode"]
  --ntfy-url URL       ntfy base URL, empty = dry-run (NTFY_URL)  [https://ntfy.sh]
  --topic TOPIC        ntfy topic to publish to (NTFY_TOPIC)      [required]
  --token TOKEN        ntfy bearer token (NTFY_TOKEN)
  --click URL          URL opened when a notification is tapped (NTFY_CLICK)
  --once               exit after the first successful publish (smoke test)
  --verbose            log every event, not just published notifications
  -h, --help           show this help
`
}

function parse() {
  const { values } = parseArgs({
    options: {
      "opencode-url": { type: "string" },
      password: { type: "string" },
      user: { type: "string" },
      "ntfy-url": { type: "string" },
      topic: { type: "string" },
      token: { type: "string" },
      click: { type: "string" },
      once: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: false,
  })
  if (values.help) {
    process.stdout.write(usage())
    process.exit(0)
  }
  return {
    opencodeUrl: (values["opencode-url"] ?? process.env.OPENCODE_URL ?? "http://127.0.0.1:4096").replace(/\/+$/, ""),
    user: values.user ?? process.env.OPENCODE_USER ?? "opencode",
    password: values.password ?? process.env.OPENCODE_PASSWORD ?? "",
    ntfyUrl: (values["ntfy-url"] ?? process.env.NTFY_URL ?? "https://ntfy.sh").replace(/\/+$/, ""),
    topic: values.topic ?? process.env.NTFY_TOPIC ?? "",
    token: values.token ?? process.env.NTFY_TOKEN ?? "",
    click: values.click ?? process.env.NTFY_CLICK ?? "",
    once: values.once,
    verbose: values.verbose,
  }
}

/**
 * Minimal, transport-agnostic SSE framing — a line-for-line port of the mobile
 * client's SSEParser (src/lib/sse.ts) so the bridge and the app agree on
 * exactly what counts as a frame. Each `data: ` line is returned separately;
 * comments, `event:` and blank lines are ignored.
 */
export function makeSSEParser() {
  let buffer = ""
  return {
    push(chunk) {
      buffer += chunk
      const lines = buffer.split("\n")
      // The last element is whatever came after the final newline — possibly an
      // incomplete line. Hold it until the next chunk completes it.
      buffer = lines.pop() ?? ""
      const out = []
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6)
        if (data && data !== "[DONE]") out.push(data)
      }
      return out
    },
  }
}

function authHeaders(cfg) {
  const headers = { Accept: "text/event-stream" }
  if (cfg.password) {
    const basic = Buffer.from(`${cfg.user}:${cfg.password}`).toString("base64")
    headers.Authorization = `Basic ${basic}`
  }
  return headers
}

async function publish(cfg, note) {
  if (!cfg.ntfyUrl || !cfg.topic) {
    console.log(`[dry-run] ${note.title} — ${note.body}`)
    return
  }
  const res = await fetch(`${cfg.ntfyUrl}/${encodeURIComponent(cfg.topic)}`, {
    method: "POST",
    headers: {
      Title: note.title,
      Priority: String(note.priority ?? 3),
      Tags: (note.tags ?? []).join(","),
      ...(cfg.click ? { Click: cfg.click } : {}),
      ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    },
    body: note.body,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`ntfy publish failed (HTTP ${res.status}): ${text.slice(0, 200)}`)
  }
}

async function stream(cfg, onEvent) {
  const controller = new AbortController()
  const onSignal = () => controller.abort()
  process.once("SIGINT", onSignal)
  process.once("SIGTERM", onSignal)

  const res = await fetch(`${cfg.opencodeUrl}/global/event`, { headers: authHeaders(cfg), signal: controller.signal })
  if (!res.ok || !res.body) throw new Error(`opencode event stream failed (HTTP ${res.status})`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const parser = makeSSEParser()

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      for (const data of parser.push(decoder.decode(value, { stream: true }))) {
        try {
          onEvent(JSON.parse(data))
        } catch {
          // Ignore non-JSON keepalives/frames.
        }
      }
    }
  } finally {
    reader.releaseLock()
    process.removeListener("SIGINT", onSignal)
    process.removeListener("SIGTERM", onSignal)
  }
}

async function main() {
  const cfg = parse()
  if (!cfg.topic && cfg.ntfyUrl) {
    process.stderr.write("error: --topic (NTFY_TOPIC) is required unless --ntfy-url is empty\n")
    process.exit(2)
  }

  const mapper = createMapper()
  const allow = makeDedupe()
  let published = 0

  const onEvent = (event) => {
    if (cfg.verbose) console.log(`[event] ${event?.payload?.type ?? event?.type ?? "?"}`)
    const note = mapper.map(event)
    if (!note) return
    if (!cfg.once && !allow(note.tagKey, DEDUPE_COOLDOWN_MS)) return
    publish(cfg, note)
      .then(() => {
        published += 1
        console.log(`[notify] ${note.title} — ${note.body}`)
        if (cfg.once) process.exit(0)
      })
      .catch((err) => console.error(`[notify] ${err.message}`))
  }

  console.log(`notify-bridge: ${cfg.opencodeUrl} -> ${cfg.ntfyUrl || "(dry-run)"}/${cfg.topic || ""}`)
  let attempt = 0
  for (;;) {
    try {
      await stream(cfg, onEvent)
      console.warn("[bridge] stream ended; reconnecting")
    } catch (err) {
      if (err?.name === "AbortError") return
      console.error(`[bridge] ${err.message}`)
    }
    const delay = BACKOFF_MS[Math.min(attempt++, BACKOFF_MS.length - 1)]
    await new Promise((r) => setTimeout(r, delay))
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("notify-bridge.mjs")) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
