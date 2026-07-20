import { randomUUID } from "node:crypto";

import type { Express, NextFunction, Request, Response } from "express";

const DEFAULT_TIKTOK_FLAT_MCP_URL = "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat";
const OAUTH_SCOPE = "mcp:tt4b";

type DelegatedOAuthOptions = {
  publicBaseUrl: string;
  tikTokFlatMcpUrl?: string;
  fetchFn?: typeof fetch;
};

function firstString(value: unknown) {
  return typeof value === "string" ? value : "";
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

function redirectSummary(value: string) {
  try {
    const url = new URL(value);
    return { origin: url.origin, pathPrefix: url.pathname.split("/").slice(0, 3).join("/") };
  } catch {
    return { origin: "invalid", pathPrefix: "invalid" };
  }
}

function logOAuth(event: string, details: Record<string, unknown> = {}) {
  console.info(JSON.stringify({ component: "oauth_facade", event, ...details }));
}

function readClientSecret(req: Request) {
  if (firstString(req.body?.client_secret)) return true;
  return /^Basic\s+/i.test(req.headers.authorization || "");
}

async function sendUpstream(res: Response, response: globalThis.Response) {
  const payload = await response.text();
  res.status(response.status);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.send(payload);
}

export function registerDelegatedOAuthRoutes(app: Express, options: DelegatedOAuthOptions) {
  const publicBaseUrl = options.publicBaseUrl.replace(/\/$/, "");
  const tikTokResource = (options.tikTokFlatMcpUrl || DEFAULT_TIKTOK_FLAT_MCP_URL).replace(/\/$/, "");
  const tikTokAuthorizationServer = `${tikTokResource}/oauth`;
  const tikTokAuthorizationEndpoint = `${tikTokAuthorizationServer}/authorize`;
  const tikTokTokenEndpoint = `${tikTokAuthorizationServer}/token`;
  const tikTokRegistrationEndpoint = `${tikTokAuthorizationServer}/register`;
  const tikTokRevocationEndpoint = `${tikTokAuthorizationServer}/revoke`;
  const issuer = `${publicBaseUrl}/oauth`;
  const resource = `${publicBaseUrl}/mcp/chatgpt`;
  const resourceMetadataUrl = `${publicBaseUrl}/.well-known/oauth-protected-resource/mcp/chatgpt`;
  const fetchFn = options.fetchFn || fetch;

  const authorizationServerMetadata = {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    revocation_endpoint: `${issuer}/revoke`,
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

  app.get(
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-authorization-server/oauth",
      "/oauth/.well-known/oauth-authorization-server"
    ],
    (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.json(authorizationServerMetadata);
    }
  );
  app.get(
    ["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp/chatgpt"],
    (_req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(protectedResourceMetadata);
    }
  );

  app.post("/oauth/register", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const redirectUris = Array.isArray(req.body?.redirect_uris)
      ? req.body.redirect_uris.filter((value: unknown): value is string => typeof value === "string")
      : [];
    const authMethod = firstString(req.body?.token_endpoint_auth_method) || "none";
    if (
      redirectUris.length === 0 ||
      redirectUris.length > 5 ||
      !redirectUris.every(isAllowedChatGptRedirect) ||
      authMethod !== "none"
    ) {
      logOAuth("registration_rejected", {
        correlationId,
        redirectCount: redirectUris.length,
        redirects: redirectUris.map(redirectSummary),
        tokenEndpointAuthMethod: authMethod
      });
      res.status(400).json({
        error: "invalid_client_metadata",
        error_description: "Use an official ChatGPT connector callback with a PKCE public client.",
        correlation_id: correlationId
      });
      return;
    }

    try {
      const upstream = await fetchFn(tikTokRegistrationEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          ...req.body,
          redirect_uris: redirectUris,
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none"
        })
      });
      logOAuth(upstream.ok ? "registration_succeeded" : "registration_failed", {
        correlationId,
        redirects: redirectUris.map(redirectSummary),
        upstreamStatus: upstream.status
      });
      await sendUpstream(res, upstream);
    } catch {
      logOAuth("registration_unavailable", { correlationId });
      res.status(502).json({
        error: "temporarily_unavailable",
        error_description: "TikTok OAuth registration is temporarily unavailable.",
        correlation_id: correlationId
      });
    }
  });

  app.get("/oauth/authorize", (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const responseType = firstString(req.query.response_type);
    const clientId = firstString(req.query.client_id);
    const redirectUri = firstString(req.query.redirect_uri);
    const codeChallenge = firstString(req.query.code_challenge);
    const codeChallengeMethod = firstString(req.query.code_challenge_method);
    const requestedScope = firstString(req.query.scope) || OAUTH_SCOPE;
    const requestedResource = firstString(req.query.resource);
    if (
      responseType !== "code" ||
      !clientId ||
      !isAllowedChatGptRedirect(redirectUri) ||
      !codeChallenge ||
      codeChallengeMethod !== "S256" ||
      !requestedScope.split(/\s+/).includes(OAUTH_SCOPE) ||
      (requestedResource && requestedResource !== resource && requestedResource !== tikTokResource)
    ) {
      logOAuth("authorization_rejected", {
        correlationId,
        redirect: redirectSummary(redirectUri),
        requestedResource
      });
      res.status(400).json({
        error: "invalid_request",
        error_description: "The OAuth request must use the registered ChatGPT callback and PKCE S256.",
        correlation_id: correlationId
      });
      return;
    }

    const authorizationUrl = new URL(tikTokAuthorizationEndpoint);
    for (const name of [
      "response_type",
      "client_id",
      "redirect_uri",
      "state",
      "scope",
      "code_challenge",
      "code_challenge_method"
    ]) {
      const value = firstString(req.query[name]);
      if (value) authorizationUrl.searchParams.set(name, value);
    }
    authorizationUrl.searchParams.set("resource", tikTokResource);
    logOAuth("authorization_started", {
      correlationId,
      clientId,
      redirectUri,
      state: firstString(req.query.state),
      codeChallenge,
      codeChallengeMethod,
      requestedScope,
      redirect: redirectSummary(redirectUri),
      requestedResource: requestedResource || resource
    });
    res.redirect(302, authorizationUrl.toString());
  });

  app.post("/oauth/token", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    if (readClientSecret(req)) {
      logOAuth("token_secret_rejected", { correlationId });
      res.status(401).json({
        error: "invalid_client",
        error_description: "TikTok MCP uses a PKCE public client; do not send a Client Secret.",
        correlation_id: correlationId
      });
      return;
    }

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body || {})) {
      if (typeof value === "string" && key !== "client_secret") body.set(key, value);
    }
    body.set("resource", tikTokResource);
    try {
      const upstream = await fetchFn(tikTokTokenEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      logOAuth(upstream.ok ? "token_exchange_succeeded" : "token_exchange_failed", {
        correlationId,
        grantType: body.get("grant_type"),
        upstreamStatus: upstream.status
      });
      await sendUpstream(res, upstream);
    } catch {
      logOAuth("token_exchange_unavailable", { correlationId, grantType: body.get("grant_type") });
      res.status(502).json({
        error: "temporarily_unavailable",
        error_description: "TikTok token exchange is temporarily unavailable.",
        correlation_id: correlationId
      });
    }
  });

  app.post("/oauth/revoke", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(req.body || {})) {
      if (typeof value === "string" && key !== "client_secret") body.set(key, value);
    }
    try {
      const upstream = await fetchFn(tikTokRevocationEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      logOAuth(upstream.ok ? "revocation_succeeded" : "revocation_failed", {
        correlationId,
        upstreamStatus: upstream.status
      });
      await sendUpstream(res, upstream);
    } catch {
      logOAuth("revocation_unavailable", { correlationId });
      res.status(502).json({ error: "temporarily_unavailable", correlation_id: correlationId });
    }
  });

  return {
    issuer,
    resource,
    upstreamAuthorizationServer: tikTokAuthorizationServer,
    upstreamResource: tikTokResource,
    resourceMetadataUrl,
    registrationEnabled: true,
    registrationEndpoint: `${issuer}/register`,
    scope: OAUTH_SCOPE
  };
}

export function requireDelegatedChatGptOAuth(resourceMetadataUrl: string, tokenResource: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization?.trim() || "";
    if (/^Bearer\s+\S+$/i.test(authorization)) {
      next();
      return;
    }
    res.setHeader(
      "WWW-Authenticate",
      `Bearer error="invalid_token", error_description="TikTok advertiser authorization is required", scope="${OAUTH_SCOPE}", resource="${tokenResource}", resource_metadata="${resourceMetadataUrl}"`
    );
    res.status(401).json({
      error: "invalid_token",
      error_description: "Connect a TikTok advertiser account to use Hooray TikTok Ads."
    });
  };
}
