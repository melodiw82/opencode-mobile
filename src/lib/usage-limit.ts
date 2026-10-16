// Classify a server error/status message as a usage or rate limit.
//
// opencode surfaces provider quota and throttling failures as ordinary
// `session.error` events carrying the upstream provider's text (DeepSeek,
// Anthropic, etc.). The free tiers this client targets ("deepseek-v4-flash-free",
// OpenCode Zen free quota) fail this way, so we match the common phrasings to
// raise a clearer, separately-controllable "Limits" notification instead of the
// generic "Session error" one.
//
// Pure and dependency-free so it is unit-testable under plain `node --test`.

export type LimitKind = "rate-limit" | "quota" | "none"

// Transient throttling — worth retrying shortly.
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

// Hard usage ceiling — retrying soon will not help.
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

/**
 * Classify a message. Rate-limit wins over quota when both appear, since a
 * throttled request is recoverable and the user shouldn't be told their quota
 * is exhausted when it isn't.
 */
export function classifyLimit(message: string | undefined | null): LimitKind {
  if (!message) return "none"
  const text = message.toLowerCase()
  if (RATE_LIMIT_PATTERNS.some((needle) => text.includes(needle))) return "rate-limit"
  if (QUOTA_PATTERNS.some((needle) => text.includes(needle))) return "quota"
  return "none"
}
