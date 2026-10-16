// In-app store review prompt — disabled in this self-hosted build.
//
// The upstream app nudged users toward a Google Play / App Store rating via
// expo-store-review. This client ships outside Google Play (direct APK /
// F-Droid) and is used in regions where the Play store is unavailable or
// blocked, so the review prompt is intentionally removed. The function is
// retained as a no-op so the success-path call site in stores/events.ts does
// not need to change, and nothing is ever persisted.

/**
 * Record a genuinely positive moment (a session finished successfully).
 * No-op in this build — kept for call-site compatibility.
 */
export function recordSuccessfulSession(): Promise<void> {
  return Promise.resolve()
}
