import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { Express, NextFunction, Request, Response } from "express";

const DEFAULT_TIKTOK_FLAT_MCP_URL = "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat";
const OAUTH_SCOPE = "mcp:tt4b";
const AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

type PendingAuthorization = {
  clientId: string;
  clientRedirectUri: string;
  clientState?: string;
  clientCodeChallenge: string;
  expiresAt: number;
  scope: string;
  upstreamCode?: string;
  upstreamCodeVerifier: string;
  upstreamState: string;
};

type DelegatedOAuthOptions = {
  publicBaseUrl: string;
  tikTokFlatMcpUrl?: string;
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
      url.pathname.startsWith("/connector/oauth/")
    );
  } catch {
    return false;
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

function readClientId(req: Request) {
  let clientId = firstString(req.body?.client_id);
  const authorization = req.headers.authorization || "";
  if (/^Basic\s+/i.test(authorization)) {
    try {
      const decoded = Buffer.from(authorization.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        clientId = decodeURIComponent(decoded.slice(0, separator));
      }
    } catch {
      // Invalid Basic input is rejected below without logging credential material.
    }
  }
  return clientId;
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

  app.get("/oauth/authorize", (req: Request, res: Response) => {
    cleanupExpired();
    const responseType = firstString(req.query.response_type);
    const clientId = firstString(req.query.client_id);
    const clientRedirectUri = firstString(req.query.redirect_uri);
    const clientState = firstString(req.query.state) || undefined;
    const clientCodeChallenge = firstString(req.query.code_challenge);
    const codeChallengeMethod = firstString(req.query.code_challenge_method);
    const requestedScope = firstString(req.query.scope) || OAUTH_SCOPE;
    const requestedResource = firstString(req.query.resource);

    if (
      responseType !== "code" ||
      !clientId ||
      !isAllowedChatGptRedirect(clientRedirectUri) ||
      !clientCodeChallenge ||
      codeChallengeMethod !== "S256" ||
      !requestedScope.split(/\s+/).includes(OAUTH_SCOPE) ||
      (requestedResource && requestedResource !== resource)
    ) {
      res.status(400).json({ error: "invalid_request", error_description: "The OAuth authorization request is invalid." });
      return;
    }

    const upstreamState = randomUUID();
    const upstreamCodeVerifier = base64Url(randomBytes(48));
    const pending: PendingAuthorization = {
      clientId,
      clientRedirectUri,
      clientState,
      clientCodeChallenge,
      expiresAt: Date.now() + AUTHORIZATION_TTL_MS,
      scope: OAUTH_SCOPE,
      upstreamCodeVerifier,
      upstreamState
    };
    pendingByUpstreamState.set(upstreamState, pending);

    const authorizationUrl = new URL(tikTokAuthorizationEndpoint);
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("client_id", clientId);
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
    const upstreamState = firstString(req.query.state);
    const pending = pendingByUpstreamState.get(upstreamState);
    if (!pending) {
      res.status(400).type("text").send("This TikTok authorization request is missing or has expired. Return to ChatGPT and reconnect the app.");
      return;
    }
    pendingByUpstreamState.delete(upstreamState);
    const error = firstString(req.query.error);
    if (error) {
      res.redirect(302, appendOAuthResult(pending.clientRedirectUri, {
        error,
        error_description: firstString(req.query.error_description) || "TikTok authorization was not completed.",
        state: pending.clientState
      }));
      return;
    }
    const upstreamCode = firstString(req.query.code);
    if (!upstreamCode) {
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
    res.redirect(302, appendOAuthResult(pending.clientRedirectUri, {
      code: downstreamCode,
      state: pending.clientState
    }));
  });

  app.post("/oauth/token", async (req: Request, res: Response) => {
    cleanupExpired();
    const grantType = firstString(req.body?.grant_type);
    const clientId = readClientId(req);
    if (!clientId) {
      res.status(401).json({ error: "invalid_client", error_description: "An OAuth client ID is required." });
      return;
    }

    const upstreamBody = new URLSearchParams({
      grant_type: grantType,
      client_id: clientId,
      resource: tikTokResource
    });

    if (grantType === "authorization_code") {
      const downstreamCode = firstString(req.body?.code);
      const pending = pendingByDownstreamCode.get(downstreamCode);
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
        res.status(400).json({ error: "invalid_grant", error_description: "The authorization code is invalid or has expired." });
        return;
      }
      pendingByDownstreamCode.delete(downstreamCode);
      upstreamBody.set("code", pending.upstreamCode);
      upstreamBody.set("code_verifier", pending.upstreamCodeVerifier);
      upstreamBody.set("redirect_uri", upstreamRedirectUri);
    } else if (grantType === "refresh_token") {
      const refreshToken = firstString(req.body?.refresh_token);
      if (!refreshToken) {
        res.status(400).json({ error: "invalid_grant", error_description: "A refresh token is required." });
        return;
      }
      upstreamBody.set("refresh_token", refreshToken);
    } else {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    try {
      const upstreamResponse = await fetchFn(tikTokTokenEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: upstreamBody
      });
      const payload = await upstreamResponse.text();
      res.status(upstreamResponse.status);
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.type("application/json").send(payload);
    } catch {
      res.status(502).json({ error: "temporarily_unavailable", error_description: "TikTok token exchange is temporarily unavailable." });
    }
  });

  return {
    issuer,
    resource,
    resourceMetadataUrl,
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
