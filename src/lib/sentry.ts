// Local-only diagnostics shim.
//
// This client is built to work in regions where third-party SaaS crash/usage
// services (Sentry, PostHog, Google) may be unavailable or blocked. We keep
// ALL crash and diagnostic handling on-device: unexpected errors are written
// to the in-memory log buffer and, when the user explicitly shares a report,
// into a self-contained on-device report. No error, breadcrumb or usage data
// is ever uploaded anywhere.
//
// The exported surface mirrors the previous remote wrapper so call sites
// (`initSentry`, `addBreadcrumb`, `captureException`, `captureDiagnostic`,
// `wrap`) do not need to change.

import { log } from "./logbuffer"
import type { DiagnosticReport } from "./diagnostics"

export type Breadcrumb = {
  category: string
  message: string
  level?: "debug" | "info" | "warning" | "error"
  data?: Record<string, unknown>
}

let handlersInstalled = false

export function initSentry() {
  installGlobalHandlers()
  log.info("diagnostics", "local-only mode — no remote crash reporting")
}

export async function disableSentry() {
  // Nothing to tear down: reporting never leaves the device.
}

// Install belt-and-braces global handlers so unexpected errors always land in
// the in-memory log buffer (and therefore in any shared diagnostic report),
// independent of any consent state or connectivity.
function installGlobalHandlers() {
  if (handlersInstalled) return
  handlersInstalled = true

  type GlobalErrorUtils = {
    getGlobalHandler?: () => (err: unknown, isFatal?: boolean) => void
    setGlobalHandler?: (handler: (err: unknown, isFatal?: boolean) => void) => void
  }
  const errorUtils = (globalThis as unknown as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils
  if (errorUtils?.setGlobalHandler && errorUtils?.getGlobalHandler) {
    const previous = errorUtils.getGlobalHandler()
    errorUtils.setGlobalHandler((err: unknown, isFatal?: boolean) => {
      const error = toError(err)
      log.error("crash", isFatal ? "FATAL" : "non-fatal", error.message, error.stack ?? "")
      previous?.(err, isFatal)
    })
  }

  // Hermes/RN expose `onunhandledrejection` on the global object.
  type GlobalRejection = {
    onunhandledrejection?: (event: { reason?: unknown; promise?: unknown }) => void
  }
  const g = globalThis as unknown as GlobalRejection
  const prevRej = g.onunhandledrejection
  g.onunhandledrejection = (event) => {
    const error = toError(event?.reason)
    log.error("crash", "unhandled-rejection", error.message, error.stack ?? "")
    prevRej?.(event)
  }
}

function toError(value: unknown): Error {
  if (value instanceof Error) return value
  if (typeof value === "string") return new Error(value)
  try {
    return new Error(JSON.stringify(value))
  } catch {
    return new Error(String(value))
  }
}

// --- Scrubbing (pure functions live in ./scrub for testability) ----------
// Kept so callers that want to strip URLs before logging/sharing still can.

export { scrubUrl } from "./scrub"

// --- Helpers exposed to the rest of the app ------------------------------

export function addBreadcrumb(crumb: Breadcrumb) {
  log.info(crumb.category, crumb.message)
}

export function captureException(
  err: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown>; level?: string },
) {
  const error = toError(err)
  log.error("crash", context?.level ?? "error", error.message, error.stack ?? "")
}

export function captureDiagnostic(report: DiagnosticReport) {
  log.info("diagnostics", "capture", report.classification, "(local only)")
}

// React error boundaries are implemented as our own class component
// (see src/components/ErrorBoundary.tsx) so we can render a useful
// "Share diagnostic" fallback. `wrap` is a passthrough kept for call sites
// that historically used Sentry.wrap to auto-capture.
export function wrap<T>(component: T): T {
  return component
}

export const sentryEnabled = () => false
