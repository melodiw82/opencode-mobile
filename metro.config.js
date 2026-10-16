// Metro bundler config.
//
// This fork removes @sentry/react-native entirely (no Sentry, no third-party SaaS), so
// the config is just Expo's default. Upstream wrapped this with
// getSentryExpoConfig() to embed a Sentry Debug ID — that require() now fails
// the release JS-bundling task ("Cannot find module '@sentry/react-native/metro'").
const { getDefaultConfig } = require("expo/metro-config")

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname)

module.exports = config
