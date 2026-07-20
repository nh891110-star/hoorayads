import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { Express, NextFunction, Request, Response } from "express";

const DEFAULT_TIKTOK_FLAT_MCP_URL = "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat";
const OAUTH_SCOPE = "mcp:tt4b";
const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;
const DYNAMIC_CLIENT_PREFIX = "hooray-dcr-v1";

type RegisteredClientPayload = {
  issuedAt: number;
  redirectUris: string[];
  version: 1;
};

type PendingAuthorization = {
  clientId: string;
  clientRedirectUri: string;
  clientState?: string;
  clientCodeChallenge: string;
  correlationId: string;
  expiresAt: number;
  scope: string;
  upstreamClientId: string;
  upstreamCode?: string;
  upstreamCodeVerifier: string;
  upstreamState: string;
};

type DelegatedOAuthOptions = {
  publicBaseUrl: string;
  tikTokFlatMcpUrl?: string;
  upstreamClientId?: string;
  registrationSigningKey?: string;
  fetchFn?: typeof fetch;
};

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function sha256Base64Url(value: string) {
  return createHash("sha256").update(value).digest("base64url");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAllowedChatGptRedirect(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["chatgpt.com", "chat.openai.com"].includes(url.hostname) &&
      url.pathname.startsWith("/connector/oauth/") &&
      url.pathname.length > "/connector/oauth/".length &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function redirectSummary(value: string) {
  try {
    const url = new URL(value);
    return {
      origin: url.origin,
      pathHash: fingerprint(url.pathname),
      trustedOpenAiCallback: isAllowedChatGptRedirect(value)
    };
  } catch {
    return { origin: "invalid", pathHash: fingerprint(value), trustedOpenAiCallback: false };
  }
}

function publicRedirectSummary(value: string) {
  try {
    const url = new URL(value);
    return { origin: url.origin, path: url.pathname };
  } catch {
    return { origin: "invalid", path: "invalid" };
  }
}

function logOAuth(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ component: "delegated_oauth", event, ...details }));
}

function encodeRegisteredClient(payload: RegisteredClientPayload, signingKey: string) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const unsignedClientId = `${DYNAMIC_CLIENT_PREFIX}.${encodedPayload}`;
  const signature = createHmac("sha256", signingKey).update(unsignedClientId).digest("base64url");
  return `${unsignedClientId}.${signature}`;
}

function decodeRegisteredClient(clientId: string, signingKey: string): RegisteredClientPayload | undefined {
  const [prefix, encodedPayload, signature, extra] = clientId.split(".");
  if (prefix !== DYNAMIC_CLIENT_PREFIX || !encodedPayload || !signature || extra) return undefined;
  const expected = createHmac("sha256", signingKey)
    .update(`${prefix}.${encodedPayload}`)
    .digest("base64url");
  if (!secureEqual(signature, expected)) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as RegisteredClientPayload;
    if (
      payload.version !== 1 ||
      !Number.isSafeInteger(payload.issuedAt) ||
      !Array.isArray(payload.redirectUris) ||
      payload.redirectUris.length === 0 ||
      !payload.redirectUris.every((value) => typeof value === "string" && isAllowedChatGptRedirect(value))
    ) {
      return undefined;
    }
    return payload;
  } catch {
    return undefined;
  }
}

function firstString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function appendOAuthResult(redirectUri: string, values: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function readClientCredentials(req: Request) {
  let clientId = firstString(req.body?.client_id);
  let secretProvided = Boolean(firstString(req.body?.client_secret));
  let method = secretProvided ? "client_secret_post" : "none";
  const authorization = req.headers.authorization || "";
  if (/^Basic\s+/i.test(authorization)) {
    try {
      const decoded = Buffer.from(authorization.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        clientId = decodeURIComponent(decoded.slice(0, separator));
        secretProvided = Boolean(decodeURIComponent(decoded.slice(separator + 1)));
        method = "client_secret_basic";
      }
    } catch {
      // Invalid Basic input is rejected below without logging credential material.
    }
  }
  return { clientId, method, secretProvided };
}

export function registerDelegatedOAuthRoutes(app: Express, options: DelegatedOAuthOptions) {
  const publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
  const tikTokResource = (options.tikTokFlatMcpUrl || DEFAULT_TIKTOK_FLAT_MCP_URL).replace(/\/$/, "");
  const tikTokAuthorizationServer = `${tikTokResource}/oauth`;
  const tikTokAuthorizationEndpoint = `${tikTokAuthorizationServer}/authorize`;
  const tikTokTokenEndpoint = `${tikTokAuthorizationServer}/token`;
  const issuer = `${publicBaseUrl}/oauth`;
  const resource = `${publicBaseUrl}/mcp/chatgpt`;
  const resourceMetadataUrl = `${publicBaseUrl}/.well-known/oauth-protected-resource/mcp/chatgpt`;
  const upstreamRedirectUri = `${publicBaseUrl}/oauth/tiktok/callback`;
  const configuredUpstreamClientId = options.upstreamClientId?.trim() || "";
  const registrationSigningKey = options.registrationSigningKey?.trim() || "";
  const registrationEnabled = Boolean(configuredUpstreamClientId && registrationSigningKey);
  const fetchFn = options.fetchFn || fetch;
  const pendingByUpstreamState = new Map<string, PendingAuthorization>();
  const pendingByDownstreamCode = new Map<string, PendingAuthorization>();

  const cleanupExpired = () => {
    const now = Date.now();
    for (const [key, value] of pendingByUpstreamState) {
      if (value.expiresAt <= now) pendingByUpstreamState.delete(key);
    }
    for (const [key, value] of pendingByDownstreamCode) {
      if (value.expiresAt <= now) pendingByDownstreamCode.delete(key);
    }
  };

  const authorizationServerMetadata = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    ...(registrationEnabled ? { registration_endpoint: `${issuer}/register` } : {}),
    response_types_supported: ["code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    scopes_supported: [OAUTH_SCOPE]
  };
  const protectedResourceMetadata = {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: [OAUTH_SCOPE],
    resource_name: "Hooray TikTok Campaign Review"
  };

  app.get(["/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/oauth"], (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(authorizationServerMetadata);
  });
  app.get("/.well-known/oauth-protected-resource/mcp/chatgpt", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(protectedResourceMetadata);
  });

  app.post("/oauth/register", (req: Request, res: Response) => {
    const correlationId = randomUUID();
    res.setHeader("Cache-Control", "no-store");
    if (!registrationEnabled) {
      logOAuth("registration_unavailable", { correlationId });
      res.status(503).json({
        error: "temporarily_unavailable",
        error_description: "Dynamic client registration is not configured for this server.",
        correlation_id: correlationId
      });
      return;
    }

    const redirectUris = Array.isArray(req.body?.redirect_uris)
      ? req.body.redirect_uris.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const grantTypes = Array.isArray(req.body?.grant_types) ? req.body.grant_types : ["authorization_code"];
    const responseTypes = Array.isArray(req.body?.response_types) ? req.body.response_types : ["code"];
    const tokenEndpointAuthMethod = firstString(req.body?.token_endpoint_auth_method) || "none";
    const validRequest =
      redirectUris.length > 0 &&
      redirectUris.length <= 5 &&
      redirectUris.every(isAllowedChatGptRedirect) &&
      grantTypes.includes("authorization_code") &&
      grantTypes.every((value: unknown) => ["authorization_code", "refresh_token"].includes(String(value))) &&
      responseTypes.length === 1 &&
      responseTypes[0] === "code" &&
      tokenEndpointAuthMethod === "none";

    if (!validRequest) {
      logOAuth("registration_rejected", {
        correlationId,
        redirectCount: redirectUris.length,
        redirects: redirectUris.slice(0, 5).map(redirectSummary),
        tokenEndpointAuthMethod
      });
      res.status(400).json({
        error: "invalid_client_metadata",
        error_description: "Registration requires a trusted OpenAI connector callback and a PKCE public client without a secret.",
        correlation_id: correlationId
      });
      return;
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const clientId = encodeRegisteredClient({ issuedAt, redirectUris, version: 1 }, registrationSigningKey);
    logOAuth("registration_succeeded", {
      clientFingerprint: fingerprint(clientId),
      correlationId,
      redirects: redirectUris.map(redirectSummary)
    });
    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: issuedAt,
      redirect_uris: redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPE
    });
  });

  app.get("/oauth/authorize", (req: Request, res: Response) => {
    cleanupExpired();
    const correlationId = randomUUID();
    const responseType = firstString(req.query.response_type);
    const clientId = firstString(req.query.client_id);
    const clientRedirectUri = firstString(req.query.redirect_uri);
    const clientState = firstString(req.query.state) || undefined;
    const clientCodeChallenge = firstString(req.query.code_challenge);
    const codeChallengeMethod = firstString(req.query.code_challenge_method);
    const requestedScope = firstString(req.query.scope) || OAUTH_SCOPE;
    const requestedResource = firstString(req.query.resource);
    const registeredClient = registrationEnabled && clientId.startsWith(`${DYNAMIC_CLIENT_PREFIX}.`)
      ? decodeRegisteredClient(clientId, registrationSigningKey)
      : undefined;
    const usesDynamicRegistration = clientId.startsWith(`${DYNAMIC_CLIENT_PREFIX}.`);
    const registeredRedirectMatches = registeredClient?.redirectUris.includes(clientRedirectUri) ?? false;
    const upstreamClientId = registeredClient ? configuredUpstreamClientId : clientId;

    if (
      responseType !== "code" ||
      !clientId ||
      !isAllowedChatGptRedirect(clientRedirectUri) ||
      (usesDynamicRegistration && !registeredRedirectMatches) ||
      !clientCodeChallenge ||
      codeChallengeMethod !== "S256" ||
      !requestedScope.split(/\s+/).includes(OAUTH_SCOPE) ||
      (requestedResource && requestedResource !== resource)
    ) {
      const errorDescription = usesDynamicRegistration && !registeredRedirectMatches
        ? "The redirect_uri does not match this registered OAuth client. Recreate or reconnect the ChatGPT app."
        : !isAllowedChatGptRedirect(clientRedirectUri)
          ? "The redirect_uri is not a trusted OpenAI connector callback."
          : "The OAuth authorization request is invalid or is missing PKCE S256 parameters.";
      logOAuth("authorization_rejected", {
        clientFingerprint: fingerprint(clientId),
        correlationId,
        redirect: redirectSummary(clientRedirectUri),
        usesDynamicRegistration
      });
      res.status(400).json({ error: "invalid_request", error_description: errorDescription, correlation_id: correlationId });
      return;
    }

    const upstreamState = randomUUID();
    const upstreamCodeVerifier = base64Url(randomBytes(48));
    const pending: PendingAuthorization = {
      clientId,
      clientRedirectUri,
      clientState,
      clientCodeChallenge,
      correlationId,
      expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
      scope: OAUTH_SCOPE,
      upstreamClientId,
      upstreamCodeVerifier,
      upstreamState
    };
    pendingByUpstreamState.set(upstreamState, pending);
    logOAuth("authorization_started", {
      clientFingerprint: fingerprint(clientId),
      correlationId,
      redirect: redirectSummary(clientRedirectUri),
      upstreamRedirect: publicRedirectSummary(upstreamRedirectUri),
      usesDynamicRegistration
    });

    const authorizationUrl = new URL(tikTokAuthorizationEndpoint);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", upstreamClientId);
    authorizationUrl.searchParams.set("code_challenge", sha256Base64Url(upstreamCodeVerifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("redirect_uri", upstreamRedirectUri);
    authorizationUrl.searchParams.set("state", upstreamState);
    authorizationUrl.searchParams.set("scope", OAUTH_SCOPE);
    authorizationUrl.searchParams.set("resource", tikTokResource);
    res.redirect(302, authorizationUrl.toString());
  });

  app.get("/oauth/tiktok/callback", (req: Request, res: Response) => {
    cleanupExpired();
    const requestCorrelationId = randomUUID();
    const upstreamState = firstString(req.query.state);
    const pending = pendingByUpstreamState.get(upstreamState);
    if (!pending) {
      logOAuth("upstream_callback_missing_or_expired", { correlationId: requestCorrelationId });
      res.status(400).type("text").send("This TikTok authorization request is missing or has expired. Return to ChatGPT and reconnect the app.");
      return;
    }
    const correlationId = pending.correlationId;
    pendingByUpstreamState.delete(upstreamState);
    const error = firstString(req.query.error);
    if (error) {
      logOAuth("upstream_authorization_failed", {
        clientFingerprint: fingerprint(pending.clientId),
        correlationId,
        oauthError: error,
        redirect: redirectSummary(pending.clientRedirectUri)
      });
      res.redirect(302, appendOAuthResult(pending.clientRedirectUri, {
        error,
        error_description: firstString(req.query.error_description) || "TikTok authorization was not completed.",
        state: pending.clientState
      }));
      return;
    }
    const upstreamCode = firstString(req.query.code);
    if (!upstreamCode) {
      logOAuth("upstream_code_missing", { clientFingerprint: fingerprint(pending.clientId), correlationId });
      res.redirect(302, appendOAuthResult(pending.clientRedirectUri, {
        error: "access_denied",
        error_description: "TikTok did not return an authorization code.",
        state: pending.clientState
      }));
      return;
    }
    const downstreamCode = base64Url(randomBytes(32));
    pending.upstreamCode = upstreamCode;
    pendingByDownstreamCode.set(downstreamCode, pending);
    logOAuth("upstream_authorization_succeeded", {
      clientFingerprint: fingerprint(pending.clientId),
      correlationId,
      redirect: redirectSummary(pending.clientRedirectUri)
    });
    res.redirect(302, appendOAuthResult(pending.clientRedirectUri, {
      code: downstreamCode,
      state: pending.clientState
    }));
  });

  app.post("/oauth/token", async (req: Request, res: Response) => {
    cleanupExpired();
    let correlationId: string = randomUUID();
    const grantType = firstString(req.body?.grant_type);
    const clientCredentials = readClientCredentials(req);
    const clientId = clientCredentials.clientId;
    if (!clientId) {
      logOAuth("token_client_missing", { correlationId });
      res.status(401).json({ error: "invalid_client", error_description: "An OAuth client ID is required.", correlation_id: correlationId });
      return;
    }
    if (clientCredentials.secretProvided) {
      logOAuth("token_secret_rejected", {
        clientFingerprint: fingerprint(clientId),
        correlationId,
        method: clientCredentials.method
      });
      res.status(401).json({
        error: "invalid_client",
        error_description: "This PKCE public client does not accept a Client Secret. Remove the secret and reconnect the app.",
        correlation_id: correlationId
      });
      return;
    }

    const registeredClient = registrationEnabled && clientId.startsWith(`${DYNAMIC_CLIENT_PREFIX}.`)
      ? decodeRegisteredClient(clientId, registrationSigningKey)
      : undefined;
    if (clientId.startsWith(`${DYNAMIC_CLIENT_PREFIX}.`) && !registeredClient) {
      logOAuth("token_registered_client_invalid", { clientFingerprint: fingerprint(clientId), correlationId });
      res.status(401).json({
        error: "invalid_client",
        error_description: "The registered OAuth client is invalid. Recreate or reconnect the ChatGPT app.",
        correlation_id: correlationId
      });
      return;
    }
    const resolvedUpstreamClientId = registeredClient ? configuredUpstreamClientId : clientId;

    const upstreamBody = new URLSearchParams({
      grant_type: grantType,
      client_id: resolvedUpstreamClientId,
      resource: tikTokResource
    });

    if (grantType === "authorization_code") {
      const downstreamCode = firstString(req.body?.code);
      const pending = pendingByDownstreamCode.get(downstreamCode);
      if (pending) correlationId = pending.correlationId;
      const redirectUri = firstString(req.body?.redirect_uri);
      const codeVerifier = firstString(req.body?.code_verifier);
      if (
        !pending ||
        pending.expiresAt <= Date.now() ||
        pending.clientId !== clientId ||
        pending.clientRedirectUri !== redirectUri ||
        !codeVerifier ||
        !secureEqual(sha256Base64Url(codeVerifier), pending.clientCodeChallenge) ||
        !pending.upstreamCode
      ) {
        logOAuth("token_grant_rejected", {
          clientFingerprint: fingerprint(clientId),
          correlationId,
          grantType,
          redirect: redirectSummary(redirectUri)
        });
        res.status(400).json({
          error: "invalid_grant",
          error_description: "The authorization code, PKCE verifier, or redirect_uri is invalid or has expired.",
          correlation_id: correlationId
        });
        return;
      }
      pendingByDownstreamCode.delete(downstreamCode);
      upstreamBody.set("code", pending.upstreamCode);
      upstreamBody.set("code_verifier", pending.upstreamCodeVerifier);
      upstreamBody.set("redirect_uri", upstreamRedirectUri);
    } else if (grantType === "refresh_token") {
      const refreshToken = firstString(req.body?.refresh_token);
      if (!refreshToken) {
        res.status(400).json({ error: "invalid_grant", error_description: "A refresh token is required.", correlation_id: correlationId });
        return;
      }
      upstreamBody.set("refresh_token", refreshToken);
    } else {
      res.status(400).json({ error: "unsupported_grant_type", correlation_id: correlationId });
      return;
    }

    try {
      const upstreamResponse = await fetchFn(tikTokTokenEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: upstreamBody
      });
      const payload = await upstreamResponse.text();
      logOAuth(upstreamResponse.ok ? "token_exchange_succeeded" : "token_exchange_failed", {
        clientFingerprint: fingerprint(clientId),
        correlationId,
        grantType,
        upstreamStatus: upstreamResponse.status
      });
      res.status(upstreamResponse.status);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.type("application/json").send(payload);
    } catch {
      logOAuth("token_exchange_unavailable", { clientFingerprint: fingerprint(clientId), correlationId, grantType });
      res.status(502).json({
        error: "temporarily_unavailable",
        error_description: "TikTok token exchange is temporarily unavailable.",
        correlation_id: correlationId
      });
    }
  });

  return {
    issuer,
    resource,
    resourceMetadataUrl,
    registrationEnabled,
    registrationEndpoint: `${issuer}/register`,
    scope: OAUTH_SCOPE,
    upstreamRedirectUri
  };
}

export function requireDelegatedChatGptOAuth(resourceMetadataUrl: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization?.trim() || "";
    if (/^Bearer\s+\S+$/i.test(authorization)) {
      next();
      return;
    }
    res.setHeader(
      "WWW-Authenticate",
      `Bearer error="invalid_token", error_description="TikTok advertiser authorization is required", scope="${OAUTH_SCOPE}", resource_metadata="${resourceMetadataUrl}"`
    );
    res.status(401).json({ error: "invalid_token", error_description: "Connect a TikTok advertiser account to use Hooray TikTok Ads." });
  };
}
