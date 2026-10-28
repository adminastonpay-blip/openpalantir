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

test("legacy API requests continue to use v1 by default", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      headers: { Authorization: "Bearer edge-secret" }
    }), {
      API_ACCESS_TOKEN: "edge-secret",
      UPSTREAM_API_TOKEN: "upstream-secret",
      ONTOLOGY_API_URL: "https://ontology.example.test"
    });
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "https://ontology.example.test/v1/objects");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("v2 stays disabled unless explicitly enabled", async () => {
  const response = await worker.fetch(req("/api/ontology/objects", {
    headers: { Accept: "application/vnd.openpalantir.v2+json", Authorization: "Bearer edge-secret" }
  }), { API_ACCESS_TOKEN: "edge-secret" });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "api_version_not_enabled" });
});

test("enabled v2 requests are routed to the versioned upstream path", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      headers: {
        Accept: "application/vnd.openpalantir.v2+json",
        Authorization: "Bearer edge-secret"
      }
    }), {
      API_ACCESS_TOKEN: "edge-secret",
      UPSTREAM_API_TOKEN: "upstream-secret",
      ONTOLOGY_API_URL: "https://ontology.example.test",
      ENABLE_API_V2: "true"
    });
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "https://ontology.example.test/v2/objects");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
