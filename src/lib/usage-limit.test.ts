import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyLimit } from "./usage-limit.ts"

test("no message is not a limit", () => {
  assert.equal(classifyLimit(undefined), "none")
  assert.equal(classifyLimit(null), "none")
  assert.equal(classifyLimit(""), "none")
})

test("ordinary errors are not limits", () => {
  assert.equal(classifyLimit("ENOENT: no such file or directory"), "none")
  assert.equal(classifyLimit("Tool execution failed"), "none")
})

test("provider throttling is a rate limit", () => {
  assert.equal(classifyLimit("429 Too Many Requests"), "rate-limit")
  assert.equal(classifyLimit("Rate limit exceeded, please retry"), "rate-limit")
  assert.equal(classifyLimit("The model is currently overloaded"), "rate-limit")
  assert.equal(classifyLimit("Upstream is temporarily unavailable"), "rate-limit")
})

test("usage ceilings are a quota", () => {
  assert.equal(classifyLimit("Free usage limit reached"), "quota")
  assert.equal(classifyLimit("You have exceeded your quota"), "quota")
  assert.equal(classifyLimit("Insufficient credit balance"), "quota")
  assert.equal(classifyLimit("402 Payment Required"), "quota")
})

test("rate limit wins when both phrasings appear", () => {
  assert.equal(classifyLimit("429: rate limit reached for your quota"), "rate-limit")
})
