// Pure mapping from opencode SSE events to ntfy notifications.
//
// Kept dependency-free and transport-free so the whole decision surface —
// which events notify, what they say, and when they are suppressed — is
// unit-testable with plain `node --test` (see notify-core.test.mjs).
//
// The event shapes mirror the opencode server's `/global/event` stream, which
// is what the Android client itself consumes (see src/stores/events.ts).

const RATE_LIMIT_PATTERNS = [
  "rate limit",
  "rate-limit",
  "ratelimit",
  "too many requests",
  "429",
  "throttl",
  "overloaded",
  "temporarily unavailable",
]

const QUOTA_PATTERNS = [
  "quota",
  "free limit",
  "free tier",
  "free usage",
  "usage limit",
  "limit reached",
  "limit exceeded",
  "out of credits",
  "insufficient",
  "credit balance",
  "billing",
  "402",
  "payment required",
]

/** rate-limit if a throttle phrase matches, else quota, else "none". */
export function classifyLimit(message) {
  if (!message) return "none"
  const text = String(message).toLowerCase()
  if (RATE_LIMIT_PATTERNS.some((n) => text.includes(n))) return "rate-limit"
  if (QUOTA_PATTERNS.some((n) => text.includes(n))) return "quota"
  return "none"
}

/** Collapse whitespace, strip control chars, cap length. */
export function clean(text, fallback, max = 240) {
  const s = text ? String(text).replace(/[\x00-\x1f\x7f]/g, " ").replace(/\s+/g, " ").trim() : ""
  return s ? s.slice(0, max) : fallback
}

const shortId = (id) => (id ? String(id).slice(0, 8) : "?")

/**
 * Stateful mapper. Tracks the last status per session so a busy -> idle
 * transition (a run finishing) is detected without any server-side help — the
 * same trick the mobile client uses.
 *
 * @returns {{ map(event: any): null | { id: string, title: string, body: string, priority: number, tags: string[], tagKey: string } }}
 */
export function createMapper() {
  const status = new Map()

  return {
    map(event) {
      const payload = event?.payload ?? event ?? {}
      const type = payload.type
      const props = payload.properties ?? {}

      switch (type) {
        case "session.status": {
          const sessionID = props.sessionID
          const next = props.status ?? {}
          if (!sessionID) return null
          const previous = status.get(sessionID)
          status.set(sessionID, next.type)

          if (next.type === "retry") {
            return {
              id: `retry:${sessionID}`,
              title: "Rate limited",
              body: clean(next.message, "Waiting to retry the request"),
              priority: 3,
              tags: ["hourglass"],
              tagKey: `retry:${sessionID}`,
            }
          }

          if (previous === "busy" && next.type === "idle") {
            return {
              id: `completed:${sessionID}`,
              title: "Task completed",
              body: clean(props.title, `Session ${shortId(sessionID)} finished processing`),
              priority: 3,
              tags: ["white_check_mark"],
              tagKey: `completed:${sessionID}`,
            }
          }
          return null
        }

        case "session.error": {
          const sessionID = props.sessionID
          const message = props.error?.message
          const limit = classifyLimit(message)
          if (limit === "rate-limit") {
            return {
              id: `error:${sessionID}`,
              title: "Rate limited",
              body: clean(message, "The model is throttled"),
              priority: 4,
              tags: ["hourglass", "warning"],
              tagKey: `error:${sessionID}`,
            }
          }
          if (limit === "quota") {
            return {
              id: `error:${sessionID}`,
              title: "Usage limit reached",
              body: clean(message, "Your OpenCode usage limit was reached"),
              priority: 4,
              tags: ["moneybag", "warning"],
              tagKey: `error:${sessionID}`,
            }
          }
          return {
            id: `error:${sessionID}`,
            title: "Session error",
            body: clean(message, "Something went wrong"),
            priority: 4,
            tags: ["x"],
            tagKey: `error:${sessionID}`,
          }
        }

        case "permission.asked": {
          const { id, sessionID, permission, patterns } = props
          if (!id || !sessionID) return null
          const detail = permission ? (patterns?.length ? `${permission}: ${patterns.join(", ")}` : permission) : patterns?.join(", ")
          return {
            id: `perm:${id}`,
            title: "Approval needed",
            body: clean(detail, "A tool needs your approval"),
            priority: 4,
            tags: ["shield"],
            tagKey: `perm:${id}`,
          }
        }

        case "question.asked": {
          const { id, sessionID, questions } = props
          if (!id || !sessionID) return null
          const first = questions?.[0]
          return {
            id: `question:${id}`,
            title: clean(first?.header, "Input needed"),
            body: clean(first?.question, "The assistant has a question"),
            priority: 4,
            tags: ["question"],
            tagKey: `question:${id}`,
          }
        }

        default:
          return null
      }
    },
  }
}

/** Pure dedupe gate: returns true if the key may fire again now. */
export function makeDedupe(now = () => Date.now()) {
  const sent = new Map()
  return (key, cooldownMs) => {
    const last = sent.get(key)
    const t = now()
    if (last !== undefined && t - last < cooldownMs) return false
    sent.set(key, t)
    return true
  }
}
