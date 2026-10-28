const SECURITY_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};
const MAX_BODY_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...SECURITY_HEADERS, ...headers } });
}
function origins(env) {
  return (env.CORS_ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
}
function cors(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !origins(env).includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Request-ID",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}
async function secureEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !left || !right) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(left)),
    crypto.subtle.digest("SHA-256", enc.encode(right)),
  ]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
async function readLimitedBody(request, limit) {
  if (!request.body) return { body: undefined, tooLarge: false };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel("payload_too_large").catch(() => {});
        return { body: undefined, tooLarge: true };
      }
      chunks.push(value);
    }
  } catch {
    return { body: undefined, tooLarge: false, readError: true };
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { body, tooLarge: false };
}
function upstreamBase(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch { return null; }
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = cors(request, env);
    if (request.method === "OPTIONS") {
      if (!request.headers.get("Origin") || !corsHeaders["access-control-allow-origin"]) {
        return json({ error: "origin_not_allowed" }, 403);
      }
      return new Response(null, { status: 204, headers: { ...corsHeaders, "x-content-type-options": "nosniff" } });
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "openpalantir-edge", version: "1" }, 200, corsHeaders);
    }
    if (!url.pathname.startsWith("/api/ontology/")) return json({ error: "not_found" }, 404, corsHeaders);
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST, PUT, PATCH, DELETE", ...corsHeaders });
    }
    if (!env.API_ACCESS_TOKEN) return json({ error: "service_not_configured" }, 503, corsHeaders);
    const authorization = request.headers.get("Authorization") || "";
    const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!(await secureEqual(supplied, env.API_ACCESS_TOKEN))) {
      return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer", ...corsHeaders });
    }
    const declaredLength = Number(request.headers.get("Content-Length") || "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json({ error: "payload_too_large" }, 413, corsHeaders);
    }
    // The currently implemented ontology API is read-only. Do not expose write verbs
    // through the gateway until a separately reviewed authorization model exists.
    if (request.method !== "GET") {
      return json({ error: "read_only_endpoint" }, 405, { allow: "GET, OPTIONS", ...corsHeaders });
    }
    const base = upstreamBase(env.ONTOLOGY_API_URL);
    if (!base || !env.UPSTREAM_API_TOKEN) return json({ error: "upstream_not_configured" }, 503, corsHeaders);
    const relativePath = url.pathname.slice("/api/ontology/".length);
    const target = new URL("/v1/" + relativePath, base);
    target.search = url.search;
    const headers = new Headers();
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Authorization", "Bearer " + env.UPSTREAM_API_TOKEN);
    const requestId = request.headers.get("X-Request-ID");
    if (requestId && /^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) headers.set("X-Request-ID", requestId);
    const init = { method: request.method, headers, redirect: "manual", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) };
    try {
      const upstream = await fetch(target, init);
      if (upstream.status >= 300 && upstream.status < 400) return json({ error: "upstream_redirect_blocked" }, 502, corsHeaders);
      const responseHeaders = new Headers({
        "cache-control": "no-store", "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer", "x-frame-options": "DENY",
      });
      const type = upstream.headers.get("Content-Type");
      if (type) responseHeaders.set("Content-Type", type);
      for (const [key, value] of Object.entries(corsHeaders)) responseHeaders.set(key, value);
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch {
      return json({ error: "upstream_unavailable" }, 502, corsHeaders);
    }
  },
};
