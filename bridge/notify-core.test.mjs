import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyLimit, clean, createMapper, makeDedupe } from "./notify-core.mjs"
import { makeSSEParser } from "./notify-bridge.mjs"

const evt = (type, properties) => ({ type, properties })

test("classifyLimit splits throttle from quota, and neither from real errors", () => {
  assert.equal(classifyLimit("429 Too Many Requests"), "rate-limit")
  assert.equal(classifyLimit("Free usage limit reached"), "quota")
  assert.equal(classifyLimit("ENOENT: no such file"), "none")
  assert.equal(classifyLimit(undefined), "none")
})

test("clean strips control characters, collapses whitespace and caps length", () => {
  assert.equal(clean("  a\n\tb  ", "fb"), "a b")
  assert.equal(clean("", "fb"), "fb")
  assert.equal(clean(undefined, "fb"), "fb")
  assert.equal(clean("x".repeat(300), "fb").length, 240)
})

test("mapper: a busy -> idle transition is the only completion", () => {
  const m = createMapper()
  assert.equal(m.map(evt("session.status", { sessionID: "s1", status: { type: "busy" } })), null)
  const done = m.map(evt("session.status", { sessionID: "s1", status: { type: "idle" } }))
  assert.equal(done.title, "Task completed")
  // A second idle with no busy in between is not another completion.
  assert.equal(m.map(evt("session.status", { sessionID: "s1", status: { type: "idle" } })), null)
})

test("mapper: retry surfaces as a rate-limit notification", () => {
  const m = createMapper()
  const n = m.map(evt("session.status", { sessionID: "s1", status: { type: "retry", attempt: 2, message: "429" } }))
  assert.equal(n.title, "Rate limited")
  assert.equal(n.priority, 3)
})

test("mapper: session.error routes limits vs generic errors", () => {
  const m = createMapper()
  assert.equal(m.map(evt("session.error", { sessionID: "s1", error: { message: "429 slow down" } })).title, "Rate limited")
  assert.equal(m.map(evt("session.error", { sessionID: "s2", error: { message: "out of credits" } })).title, "Usage limit reached")
  assert.equal(m.map(evt("session.error", { sessionID: "s3", error: { message: "boom" } })).title, "Session error")
})

test("mapper: permissions and questions produce high-priority notices", () => {
  const m = createMapper()
  const perm = m.map(evt("permission.asked", { id: "p1", sessionID: "s1", permission: "bash", patterns: ["rm -rf /"] }))
  assert.equal(perm.title, "Approval needed")
  assert.match(perm.body, /rm -rf/)
  assert.equal(perm.priority, 4)

  const q = m.map(evt("question.asked", { id: "q1", sessionID: "s1", questions: [{ header: "Pick one", question: "Which?" }] }))
  assert.equal(q.title, "Pick one")
  assert.equal(q.body, "Which?")
})

test("mapper: unknown events and missing ids are ignored", () => {
  const m = createMapper()
  assert.equal(m.map(evt("message.updated", {})), null)
  assert.equal(m.map(evt("permission.asked", { sessionID: "s1" })), null)
  assert.equal(m.map(null), null)
})

test("dedupe gate enforces a per-key cooldown", () => {
  let t = 1000
  const ok = makeDedupe(() => t)
  assert.equal(ok("k", 5000), true)
  assert.equal(ok("k", 5000), false)
  t = 7000
  assert.equal(ok("k", 5000), true)
  assert.equal(ok("other", 5000), true)
})

test("sse parser frames data across chunk boundaries and ignores keepalives", () => {
  const p = makeSSEParser()
  assert.deepEqual(p.push(': keepalive\nevent: ping\n\ndata: \n'), [])
  assert.deepEqual(p.push("data: {\"a\":1}\n\ndata: {\"b\""), ["{\"a\":1}"])
  // second frame split mid-line
  assert.deepEqual(p.push(":2}\n\n"), ["{\"b\":2}"])
})
