// Pure web (localStorage) key/value store, split out from storage.ts so it can
// be unit-tested under plain `node --test` without pulling in react-native or
// expo-secure-store. See storage.ts for the native side and the security note.

export interface KVStore {
  getItemAsync(key: string): Promise<string | null>
  setItemAsync(key: string, value: string): Promise<void>
  deleteItemAsync(key: string): Promise<void>
}

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">

/**
 * Build a best-effort KV store over a localStorage-like object. A missing or
 * throwing store (private mode, disabled storage, SSR) degrades to no-op
 * reads/writes instead of crashing the app.
 */
export function createWebStore(backing: WebStorage | undefined | null): KVStore {
  return {
    async getItemAsync(key) {
      try {
        return backing?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    async setItemAsync(key, value) {
      try {
        backing?.setItem(key, value)
      } catch {
        // ignore
      }
    },
    async deleteItemAsync(key) {
      try {
        backing?.removeItem(key)
      } catch {
        // ignore
      }
    },
  }
}
