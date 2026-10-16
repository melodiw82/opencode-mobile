// Local-only analytics shim.
//
// This client performs NO remote analytics and NO telemetry upload. The
// previous PostHog wrapper is intentionally removed because third-party US
// SaaS is unavailable or blocked in some regions (e.g. Iran) and the client
// is meant to run fully self-hosted.
//
// The exported surface is kept identical to the previous module so call sites
// (`track`, `initAnalytics`, `shutdownAnalytics`, `trackAppOpened`,
// `AnalyticsEvent`, `classifyConnectionError`) do not need to change. Every
// function is a no-op.

import { log } from "./logbuffer"

export { classifyConnectionError, type ConnectionErrorClass } from "./analytics-classify"

/** Activation-funnel event names (retained for call-site compatibility only;
 *  nothing is transmitted while analytics is local-only). */
export enum AnalyticsEvent {
  AppOpened = "app_opened",
  ConnectionFormSubmitted = "connection_form_submitted",
  ConnectionAttempted = "connection_attempted",
  ConnectionSucceeded = "connection_succeeded",
  ConnectionFailed = "connection_failed",
  MessageSent = "message_sent",
  ResponseReceived = "response_received",
  DemoStarted = "demo_started",
  DemoStepAdvanced = "demo_step_advanced",
  DemoCompleted = "demo_completed",
  DemoExitedToConnect = "demo_exited_to_connect",
}

/** Where a connection test/failure was initiated from. */
export type ConnectionTestSource = "onboarding" | "edit_test" | "sse"

export function initAnalytics() {
  log.info("analytics", "local-only mode — no analytics upload")
}

export async function shutdownAnalytics() {
  // No-op: nothing was ever started.
}

export function analyticsEnabled(): boolean {
  return false
}

/** Flat, JSON-safe event properties — kept for call-site typing. */
export type AnalyticsProps = Record<string, string | number | boolean | null>

/** No-op. Never throws. */
export function track(_event: AnalyticsEvent, _props?: AnalyticsProps) {
  // Intentionally does nothing — analytics is local-only.
}

/** No-op. */
export async function trackAppOpened() {
  // Intentionally does nothing — analytics is local-only.
}
