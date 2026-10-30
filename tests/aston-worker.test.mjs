import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/aston/index.js";

const req = (path, init={}) => new Request("https://aston.test"+path, init);

test("health is public and identifies ASTON", async () => {
  const r = await worker.fetch(req("/health"), {});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).service, "aston-universal-os");
});
test("capabilities is public but reports actual bindings", async () => {
  const r = await worker.fetch(req("/v1/capabilities"), {});
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.bindings.ai, false);
});
test("protected routes reject missing tenant and token", async () => {
  const r = await worker.fetch(req("/v1/swarm/tasks", {method:"POST",body:"{}"}), {});
  assert.equal(r.status, 401);
});
test("tenant token is scoped to the tenant key map", async () => {
  const env = { TENANT_KEYS_JSON: JSON.stringify({alpha:"alpha-secret"}) };
  const bad = await worker.fetch(req("/v1/events", {method:"POST",headers:{"X-Tenant":"beta",Authorization:"Bearer alpha-secret"},body:"{}"}), env);
  const good = await worker.fetch(req("/v1/events", {method:"POST",headers:{"X-Tenant":"alpha",Authorization:"Bearer alpha-secret"},body:"{}"}), env);
  assert.equal(bad.status, 401);
  assert.equal(good.status, 200);
});
