import { createHash } from "node:crypto";
import { createServer } from "node:http";

import cors from "cors";
import express from "express";

import { registerDelegatedOAuthRoutes, requireDelegatedChatGptOAuth } from "../src/delegated-oauth.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const publicBaseUrl = "https://tiktok-ads-agent-poc.onrender.com";
const resource = `${publicBaseUrl}/mcp/chatgpt`;
const upstreamClientId = "qa-tiktok-app-id";
const upstreamCalls = [];
const fakeFetch = async (url, init) => {
  upstreamCalls.push({ url: String(url), body: String(init?.body || "") });
  return new Response(JSON.stringify({
    access_token: "qa-access-token",
    refresh_token: "qa-refresh-token",
    token_type: "Bearer",
    expires_in: 3600,
    scope: "mcp:tt4b"
  }), { status: 200, headers: { "content-type": "application/json" } });
};

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({ exposedHeaders: ["WWW-Authenticate"], origin: "*" }));
const oauth = registerDelegatedOAuthRoutes(app, {
  publicBaseUrl,
  fetchFn: fakeFetch,
  registrationSigningKey: "qa-registration-signing-key-with-sufficient-entropy",
  upstreamClientId
});
app.get("/protected", requireDelegatedChatGptOAuth(oauth.resourceMetadataUrl), (_req, res) => res.json({ ok: true }));

const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const localBase = `http://127.0.0.1:${address.port}`;

const codeVerifier = "qa-chatgpt-pkce-verifier-0123456789-ABCDEFG";
const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
const clientId = "qa-client-id";
const clientRedirectUri = "https://chatgpt.com/connector/oauth/qa-callback";

async function beginAuthorization(verifierChallenge = codeChallenge) {
  const authorize = new URL(`${localBase}/oauth/authorize`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", clientRedirectUri);
  authorize.searchParams.set("state", "chatgpt-state");
  authorize.searchParams.set("scope", "mcp:tt4b");
  authorize.searchParams.set("resource", resource);
  authorize.searchParams.set("code_challenge", verifierChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  const response = await fetch(authorize, { redirect: "manual" });
  assert(response.status === 302, `Expected authorize redirect, got ${response.status}.`);
  const upstream = new URL(response.headers.get("location"));
  assert(upstream.origin === "https://business-api.tiktok.com", "Authorization did not redirect to TikTok Business API.");
  assert(upstream.pathname.endsWith("/oauth/authorize"), "TikTok authorization endpoint is incorrect.");
  assert(upstream.searchParams.get("client_id") === clientId, "OAuth client ID was not forwarded.");
  assert(upstream.searchParams.get("redirect_uri") === oauth.upstreamRedirectUri, "TikTok callback URI is incorrect.");
  assert(upstream.searchParams.get("resource") === "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat", "TikTok Flat MCP resource is incorrect.");
  assert(upstream.searchParams.get("code_challenge") !== verifierChallenge, "The broker must use a separate upstream PKCE verifier.");
  assert(!upstream.searchParams.has("client_secret"), "A client secret leaked into the authorization URL.");
  return upstream;
}

try {
  const metadata = await fetch(`${localBase}/.well-known/oauth-authorization-server/oauth`);
  const metadataBody = await metadata.json();
  assert(metadataBody.issuer === `${publicBaseUrl}/oauth`, "OAuth issuer metadata is incorrect.");
  assert(metadataBody.authorization_endpoint === `${publicBaseUrl}/oauth/authorize`, "Authorization endpoint metadata is incorrect.");
  assert(metadataBody.token_endpoint === `${publicBaseUrl}/oauth/token`, "Token endpoint metadata is incorrect.");
  assert(metadataBody.registration_endpoint === `${publicBaseUrl}/oauth/register`, "Registration endpoint metadata is incorrect.");
  assert(metadataBody.code_challenge_methods_supported.includes("S256"), "OAuth metadata must require PKCE S256.");
  assert(metadata.headers.get("access-control-allow-origin") === "*", "OAuth metadata is missing CORS headers.");

  const protectedMetadata = await fetch(`${localBase}/.well-known/oauth-protected-resource/mcp/chatgpt`);
  const protectedBody = await protectedMetadata.json();
  assert(protectedBody.resource === resource, "Protected resource metadata is incorrect.");
  assert(protectedBody.authorization_servers[0] === `${publicBaseUrl}/oauth`, "Protected resource issuer is incorrect.");

  const missingBearer = await fetch(`${localBase}/protected`);
  assert(missingBearer.status === 401, "Protected MCP request without bearer token was not rejected.");
  assert(missingBearer.headers.get("www-authenticate")?.includes(oauth.resourceMetadataUrl), "OAuth discovery header is missing resource metadata.");
  const delegatedBearer = await fetch(`${localBase}/protected`, { headers: { Authorization: "Bearer per-user-token" } });
  assert(delegatedBearer.status === 200, "Protected MCP request with bearer token was rejected.");

  const invalidRedirect = new URL(`${localBase}/oauth/authorize`);
  invalidRedirect.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: "https://attacker.example/callback",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "mcp:tt4b"
  }).toString();
  assert((await fetch(invalidRedirect, { redirect: "manual" })).status === 400, "An untrusted OAuth redirect URI was accepted.");

  const upstream = await beginAuthorization();
  const upstreamCallback = new URL(`${localBase}/oauth/tiktok/callback`);
  upstreamCallback.searchParams.set("code", "tiktok-upstream-code");
  upstreamCallback.searchParams.set("state", upstream.searchParams.get("state"));
  const callbackResponse = await fetch(upstreamCallback, { redirect: "manual" });
  assert(callbackResponse.status === 302, "TikTok callback did not return to ChatGPT.");
  const chatGptCallback = new URL(callbackResponse.headers.get("location"));
  assert(chatGptCallback.origin === "https://chatgpt.com", "OAuth callback escaped the ChatGPT allowlist.");
  assert(chatGptCallback.searchParams.get("state") === "chatgpt-state", "ChatGPT OAuth state was not preserved.");
  const downstreamCode = chatGptCallback.searchParams.get("code");
  assert(downstreamCode, "The broker did not mint a one-time downstream authorization code.");

  const tokenResponse = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: downstreamCode,
      redirect_uri: clientRedirectUri,
      code_verifier: codeVerifier
    })
  });
  assert(tokenResponse.status === 200, "Authorization-code token exchange failed.");
  const tokenBody = await tokenResponse.json();
  assert(tokenBody.access_token === "qa-access-token" && tokenBody.refresh_token === "qa-refresh-token", "TikTok tokens were not returned to the OAuth client.");
  const authorizationExchange = new URLSearchParams(upstreamCalls[0].body);
  assert(authorizationExchange.get("client_id") === clientId, "Client ID was not forwarded to TikTok token exchange.");
  assert(!authorizationExchange.has("client_secret"), "TikTok Flat MCP is a PKCE public client and must not receive a client secret.");
  assert(authorizationExchange.get("code") === "tiktok-upstream-code", "TikTok authorization code was not forwarded.");
  assert(authorizationExchange.get("redirect_uri") === oauth.upstreamRedirectUri, "TikTok token exchange callback URI is incorrect.");
  assert(authorizationExchange.get("code_verifier") !== codeVerifier, "The broker reused ChatGPT's PKCE verifier upstream.");

  const replay = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: downstreamCode,
      redirect_uri: clientRedirectUri,
      code_verifier: codeVerifier
    })
  });
  assert(replay.status === 400, "A one-time authorization code was accepted twice.");

  const refresh = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token: "qa-refresh-token" })
  });
  assert(refresh.status === 200, "Refresh-token exchange failed.");
  const refreshExchange = new URLSearchParams(upstreamCalls[1].body);
  assert(refreshExchange.get("refresh_token") === "qa-refresh-token", "Refresh token was not forwarded.");

  const mismatchUpstream = await beginAuthorization();
  const mismatchCallback = new URL(`${localBase}/oauth/tiktok/callback`);
  mismatchCallback.searchParams.set("code", "second-upstream-code");
  mismatchCallback.searchParams.set("state", mismatchUpstream.searchParams.get("state"));
  const mismatchCallbackResponse = await fetch(mismatchCallback, { redirect: "manual" });
  const mismatchCode = new URL(mismatchCallbackResponse.headers.get("location")).searchParams.get("code");
  const mismatch = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      code: mismatchCode,
      redirect_uri: clientRedirectUri,
      code_verifier: "wrong-code-verifier-with-sufficient-length-123456"
    })
  });
  assert(mismatch.status === 400, "A PKCE mismatch was accepted.");

  const dcrResponse = await fetch(`${localBase}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "ChatGPT QA",
      redirect_uris: [clientRedirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    })
  });
  assert(dcrResponse.status === 201, `Trusted ChatGPT DCR failed with ${dcrResponse.status}.`);
  const dcrClient = await dcrResponse.json();
  assert(dcrClient.client_id?.startsWith("hooray-dcr-v1."), "DCR did not return a signed client ID.");
  assert(!dcrClient.client_secret, "A public DCR client must not receive a client secret.");
  assert(dcrClient.token_endpoint_auth_method === "none", "DCR did not register a public client.");

  for (const rejectedRedirect of [
    "http://localhost:49152/callback",
    "https://54.81.22.17/callback",
    "https://ec2-54-81-22-17.compute-1.amazonaws.com/callback"
  ]) {
    const rejectedRegistration = await fetch(`${localBase}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [rejectedRedirect], token_endpoint_auth_method: "none" })
    });
    assert(rejectedRegistration.status === 400, `DCR accepted unsafe redirect ${rejectedRedirect}.`);
  }

  const confidentialRegistration = await fetch(`${localBase}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [clientRedirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_basic"
    })
  });
  assert(confidentialRegistration.status === 400, "DCR accepted a confidential client with a secret.");

  const dcrMismatch = new URL(`${localBase}/oauth/authorize`);
  dcrMismatch.search = new URLSearchParams({
    response_type: "code",
    client_id: dcrClient.client_id,
    redirect_uri: "https://chatgpt.com/connector/oauth/different-callback",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "mcp:tt4b",
    resource
  }).toString();
  assert((await fetch(dcrMismatch, { redirect: "manual" })).status === 400, "A DCR client used an unregistered redirect URI.");

  const tamperedClientId = `${dcrClient.client_id.slice(0, -1)}${dcrClient.client_id.endsWith("A") ? "B" : "A"}`;
  const tamperedAuthorize = new URL(`${localBase}/oauth/authorize`);
  tamperedAuthorize.search = new URLSearchParams({
    response_type: "code",
    client_id: tamperedClientId,
    redirect_uri: clientRedirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "mcp:tt4b",
    resource
  }).toString();
  assert((await fetch(tamperedAuthorize, { redirect: "manual" })).status === 400, "A tampered DCR client ID was accepted.");

  const dcrVerifier = "qa-dcr-pkce-verifier-0123456789-ABCDEFG";
  const dcrChallenge = createHash("sha256").update(dcrVerifier).digest("base64url");
  const dcrAuthorize = new URL(`${localBase}/oauth/authorize`);
  dcrAuthorize.search = new URLSearchParams({
    response_type: "code",
    client_id: dcrClient.client_id,
    redirect_uri: clientRedirectUri,
    state: "chatgpt-dcr-state",
    code_challenge: dcrChallenge,
    code_challenge_method: "S256",
    scope: "mcp:tt4b",
    resource
  }).toString();
  const dcrAuthorizeResponse = await fetch(dcrAuthorize, { redirect: "manual" });
  assert(dcrAuthorizeResponse.status === 302, "A registered DCR client could not authorize.");
  const dcrUpstream = new URL(dcrAuthorizeResponse.headers.get("location"));
  assert(dcrUpstream.searchParams.get("client_id") === upstreamClientId, "DCR did not map to the configured TikTok App ID.");
  assert(dcrUpstream.searchParams.get("redirect_uri") === oauth.upstreamRedirectUri, "DCR exposed the ChatGPT callback to TikTok.");

  const dcrCallback = new URL(`${localBase}/oauth/tiktok/callback`);
  dcrCallback.searchParams.set("code", "dcr-upstream-code");
  dcrCallback.searchParams.set("state", dcrUpstream.searchParams.get("state"));
  const dcrCallbackResponse = await fetch(dcrCallback, { redirect: "manual" });
  const dcrCode = new URL(dcrCallbackResponse.headers.get("location")).searchParams.get("code");
  const dcrUpstreamCallIndex = upstreamCalls.length;
  const dcrTokenResponse = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: dcrClient.client_id,
      code: dcrCode,
      redirect_uri: clientRedirectUri,
      code_verifier: dcrVerifier
    })
  });
  assert(dcrTokenResponse.status === 200, "DCR authorization-code exchange failed.");
  const dcrUpstreamExchange = new URLSearchParams(upstreamCalls[dcrUpstreamCallIndex].body);
  assert(dcrUpstreamExchange.get("client_id") === upstreamClientId, "DCR token exchange used the downstream client ID upstream.");

  const secretTokenAttempt = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${dcrClient.client_id}:must-not-be-used`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: "qa-refresh-token" })
  });
  assert(secretTokenAttempt.status === 401, "The public-client token endpoint accepted a Client Secret.");
  assert((await secretTokenAttempt.json()).error_description.includes("does not accept a Client Secret"), "Secret rejection was not actionable.");

  console.log(JSON.stringify({
    ok: true,
    checked: [
      "oauth_discovery",
      "protected_resource_metadata",
      "cors",
      "bearer_gate",
      "chatgpt_redirect_allowlist",
      "dynamic_client_registration",
      "dcr_exact_redirect_binding",
      "dcr_tamper_resistance",
      "localhost_and_dynamic_ip_rejection",
      "downstream_pkce",
      "independent_upstream_pkce",
      "authorization_code_exchange",
      "one_time_code",
      "refresh_token_exchange",
      "tiktok_public_client_no_secret",
      "actionable_secret_rejection"
    ]
  }, null, 2));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
