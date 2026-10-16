import { Platform } from "react-native"
import * as SecureStore from "expo-secure-store"
import { createWebStore, type KVStore } from "./storage-web"

// On-device key/value store.
//
// Native (Android/iOS): expo-secure-store — values live in the OS keystore
// (Android Keystore / iOS Keychain) and are encrypted at rest.
//
// Web: localStorage. This fork can also be exported as a browser client you
// host yourself, and the keystore API does not exist there. localStorage is
// NOT encrypted, so on web this store must be treated as plaintext: it is only
// acceptable because the web target is meant for a trusted, self-hosted origin.
// The same rule as before still applies — never persist model or tool output
// here (see src/lib/persisted-keys.test.ts).

export type { KVStore }

export const storage: KVStore = Platform.OS === "web" ? createWebStore(globalThis.localStorage) : SecureStore
