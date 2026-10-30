import test from "node:test";
import assert from "node:assert/strict";
import { inspectPlatformBindings } from "../workers/platform-registry.js";

test("reports only binding presence and never serializes secret values", () => {
  const secret = "do-not-leak-this";
  const result = inspectPlatformBindings({
    AI: { run() {} },
    ASTON_KV: { get() {} },
    SECRET_TOKEN: secret,
  });
  const json = JSON.stringify(result);
  assert.match(json, /workers_ai/);
  assert.match(json, /aston_kv/);
  assert.doesNotMatch(json, /do-not-leak-this/);
  assert.equal(result.mode, "binding-presence-only");
});

test("recognizes visible Cloudflare binding aliases", () => {
  const result = inspectPlatformBindings({
    "BÚSQUEDA DE IA": { query() {} },
    "SERVICIO PRINCIPAL": { fetch() {} },
    "BD_AUDITORIA": { prepare() {} },
    "COLA GLOBAL": { send() {} },
  });
  const capabilities = result.groups.flatMap((group) => group.capabilities);
  for (const id of ["vectorize", "service", "audit_db", "global_queue"]) {
    assert.equal(capabilities.find((item) => item.id === id)?.configured, true, id);
  }
});

test("does not confuse binding presence with operational health", () => {
  const result = inspectPlatformBindings({ AI: {} });
  const ai = result.groups.find((group) => group.id === "compute").capabilities[0];
  assert.equal(ai.configured, true);
  assert.equal("healthy" in ai, false);
});

test("handles an empty environment without throwing", () => {
  const result = inspectPlatformBindings();
  assert.equal(result.summary.configured, 0);
  assert.equal(result.summary.total > 0, true);
});
