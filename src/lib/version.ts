import appJson from "../../app.json"

// Kept in sync with package.json by scripts/check-version-parity.mjs, which CI
// runs on every build.
export const CURRENT_VERSION: string =
  (appJson as { expo?: { version?: string } }).expo?.version ?? "unknown"
