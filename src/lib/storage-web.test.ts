import { test } from "node:test"
import assert from "node:assert/strict"
import { createWebStore } from "./storage-web.ts"

function fakeLocalStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

test("web store reads, writes and deletes through the backing store", async () => {
  const store = createWebStore(fakeLocalStorage({ a: "1" }))
  assert.equal(await store.getItemAsync("a"), "1")
  assert.equal(await store.getItemAsync("missing"), null)
  await store.setItemAsync("b", "2")
  assert.equal(await store.getItemAsync("b"), "2")
  await store.deleteItemAsync("a")
  assert.equal(await store.getItemAsync("a"), null)
})

test("a missing backing store degrades to a no-op instead of throwing", async () => {
  const store = createWebStore(undefined)
  assert.equal(await store.getItemAsync("x"), null)
  await store.setItemAsync("x", "y") // must not throw
  await store.deleteItemAsync("x")
})

test("a throwing backing store (private mode) is swallowed", async () => {
  const throwing = {
    getItem: () => {
      throw new Error("denied")
    },
    setItem: () => {
      throw new Error("quota")
    },
    removeItem: () => {
      throw new Error("denied")
    },
  }
  const store = createWebStore(throwing)
  assert.equal(await store.getItemAsync("x"), null)
  await store.setItemAsync("x", "y")
  await store.deleteItemAsync("x")
})
