import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/index.js";

const req = (path, init = {}) => new Request("https://edge.example.test" + path, init);

test("health endpoint returns JSON and no-store", async () => {
  const response = await worker.fetch(req("/health"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "ok");
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("unknown routes are not exposed", async () => {
  assert.equal((await worker.fetch(req("/admin"), {})).status, 404);
});
test("protected API fails closed when secret is absent", async () => {
  assert.equal((await worker.fetch(req("/api/ontology/objects"), {})).status, 503);
});
test("protected API rejects missing credentials", async () => {
  const response = await worker.fetch(req("/api/ontology/objects"), { API_ACCESS_TOKEN: "expected" });
  assert.equal(response.status, 401);
});
test("preflight rejects unconfigured origins", async () => {
  const response = await worker.fetch(req("/api/ontology/objects", {
    method: "OPTIONS", headers: { Origin: "https://attacker.example" }
  }), { CORS_ALLOWED_ORIGINS: "https://app.example" });
  assert.equal(response.status, 403);
});

test("ontology gateway rejects write methods before contacting upstream", async () => {
  const previousFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = async () => { upstreamCalled = true; throw new Error("must not call upstream"); };
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      method: "POST",
      headers: { Authorization: "Bearer expected", "Content-Type": "application/json" },
      body: JSON.stringify({ objects: [{ type: "Injected" }] })
    }), {
      API_ACCESS_TOKEN: "expected",
      ONTOLOGY_API_URL: "https://ontology.example.test",
      UPSTREAM_API_TOKEN: "upstream-secret"
    });
    assert.equal(response.status, 405);
    assert.equal((await response.json()).error, "read_only_endpoint");
    assert.equal(response.headers.get("allow"), "GET, OPTIONS");
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("ontology gateway rejects all write verbs", async () => {
  for (const method of ["PUT", "PATCH", "DELETE"]) {
    const response = await worker.fetch(req("/api/ontology/objects", {
      method,
      headers: { Authorization: "Bearer expected" }
    }), { API_ACCESS_TOKEN: "expected" });
    assert.equal(response.status, 405, method);
  }
});
