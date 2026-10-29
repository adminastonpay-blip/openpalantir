const encoder = new TextEncoder();

function decodeBase64Url(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function decodeJsonSegment(value) {
  const bytes = decodeBase64Url(value);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function validIdentifier(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._:@-]*$/.test(value);
}

/**
 * Validate an HS256 identity token issued by a trusted authentication service.
 * The tenant identifier is accepted only from the signed claim, never from a
 * client-supplied tenant header. All configuration is supplied by Worker secrets/vars.
 */
export async function resolveTenantIdentity(request, env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const secret = env.TENANT_IDENTITY_SECRET;
  const issuer = env.TENANT_IDENTITY_ISSUER;
  const audience = env.TENANT_IDENTITY_AUDIENCE;
  if (typeof secret !== "string" || secret.length < 32 ||
      typeof issuer !== "string" || !issuer ||
      typeof audience !== "string" || !audience) {
    return { ok: false, status: 503, error: "tenant_identity_not_configured" };
  }

  const token = request.headers.get("X-Aston-Identity") || "";
  const parts = token.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    return { ok: false, status: 401, error: "tenant_identity_required" };
  }

  const header = decodeJsonSegment(parts[0]);
  const claims = decodeJsonSegment(parts[1]);
  const signature = decodeBase64Url(parts[2]);
  if (!header || !claims || !signature || header.alg !== "HS256" || header.typ !== "JWT") {
    return { ok: false, status: 401, error: "tenant_identity_invalid" };
  }

  let key;
  try {
    key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(parts[0] + "." + parts[1])));
    if (expected.length !== signature.length) {
      return { ok: false, status: 401, error: "tenant_identity_invalid" };
    }
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected[i] ^ signature[i];
    if (mismatch !== 0) return { ok: false, status: 401, error: "tenant_identity_invalid" };
  } catch {
    return { ok: false, status: 401, error: "tenant_identity_invalid" };
  }

  const audOk = claims.aud === audience || (Array.isArray(claims.aud) && claims.aud.includes(audience));
  if (claims.iss !== issuer || !audOk ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= nowSeconds ||
      (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds)) ||
      !validIdentifier(claims.sub) || !validIdentifier(claims.tenant_id) ||
      !Array.isArray(claims.permissions) ||
      claims.permissions.some((permission) => typeof permission !== "string" || permission.length > 128)) {
    return { ok: false, status: 401, error: "tenant_identity_invalid" };
  }

  if (!claims.permissions.includes("ontology:read")) {
    return { ok: false, status: 403, error: "tenant_permission_denied" };
  }

  return {
    ok: true,
    principal: claims.sub,
    tenantId: claims.tenant_id,
    permissions: claims.permissions
  };
}
