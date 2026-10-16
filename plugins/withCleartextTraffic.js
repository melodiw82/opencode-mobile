// Config plugin: allow plain-HTTP connections to a self-hosted opencode server.
//
// This client talks to servers on a LAN or a private WireGuard tunnel over
// http://, but Android 9+ blocks cleartext HTTP unless the app opts in.
// Expo 54 ignores `expo.android.usesCleartextTraffic` in app.json (verified: the
// generated AndroidManifest had no such attribute), so set it here.
const { withAndroidManifest } = require("expo/config-plugins")

module.exports = function withCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0]
    if (!application) throw new Error("withCleartextTraffic: no <application> in AndroidManifest")
    application.$["android:usesCleartextTraffic"] = "true"
    return config
  })
}
