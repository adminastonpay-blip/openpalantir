import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/index.js";

const req = (path, init = {}) => new Request("https://edge.example.test" + path, init);
const authorizedEnv = {
  API_ACCESS_TOKEN: "edge-secret",
  UPSTREAM_API_TOKEN: "upstream-secret",
  ONTOLOGY_API_URL: "https://ontology.example.test"
};
const authHeaders = { Authorization: "Bearer edge-secret" };

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
    const response = await worker.fetch(req("/api/ontology/objects", { headers: authHeaders }), authorizedEnv);
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "https://ontology.example.test/v1/objects");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("v2 stays disabled unless explicitly enabled", async () => {
  const response = await worker.fetch(req("/api/ontology/objects", {
    headers: { Accept: "application/vnd.openpalantir.v2+json", ...authHeaders }
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
      headers: { Accept: "application/vnd.openpalantir.v2+json", ...authHeaders }
    }), { ...authorizedEnv, ENABLE_API_V2: "true" });
    assert.equal(response.status, 200);
    assert.equal(requestedUrl, "https://ontology.example.test/v2/objects");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("streamed request body without Content-Length is rejected when actual bytes exceed limit", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    return new Response("{}", { status: 200 });
  };
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(400_001));
      controller.close();
    }
  });
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/octet-stream" },
      body,
      duplex: "half"
    }), authorizedEnv);
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: "payload_too_large" });
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed Content-Length is rejected before contacting upstream", async () => {
  const originalFetch = globalThis.fetch;
  let upstreamCalled = false;
  globalThis.fetch = async () => {
    upstreamCalled = true;
    return new Response("{}", { status: 200 });
  };
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "text/plain", "Content-Length": "not-a-number" },
      body: "payload"
    }), authorizedEnv);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid_content_length" });
    assert.equal(upstreamCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("body exactly at the configured limit is accepted", async () => {
  const originalFetch = globalThis.fetch;
  let receivedLength = -1;
  globalThis.fetch = async (_url, init) => {
    receivedLength = init.body.byteLength;
    return new Response("{}", { status: 200 });
  };
  try {
    const response = await worker.fetch(req("/api/ontology/objects", {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/octet-stream" },
      body: new Uint8Array(1_000_000)
    }), authorizedEnv);
    assert.equal(response.status, 200);
    assert.equal(receivedLength, 1_000_000);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
