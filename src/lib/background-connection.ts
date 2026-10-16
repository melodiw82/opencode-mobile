import { NativeModules, Platform } from "react-native"

interface BackgroundConnectionModule {
  start: () => void
  stop: () => void
}

// Injected by plugins/withBackgroundConnection.js at prebuild time. Absent on web
// (and on any build where the plugin did not run), so every call is a safe no-op.
const native: BackgroundConnectionModule | undefined =
  Platform.OS === "android"
    ? (NativeModules.BackgroundConnection as BackgroundConnectionModule | undefined)
    : undefined

/** True when the Android foreground service is present in this build. */
export const backgroundConnectionSupported = Boolean(native)

/**
 * Hold the app process up so the live SSE connection keeps delivering
 * notifications while the app is backgrounded. Starting twice is harmless.
 */
export function startBackgroundConnection(): void {
  native?.start()
}

export function stopBackgroundConnection(): void {
  native?.stop()
}
