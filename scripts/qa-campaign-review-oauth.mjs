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
const upstreamResource = "https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat";
const upstreamCalls = [];
const fakeFetch = async (url, init = {}) => {
  const call = { url: String(url), method: init.method, body: String(init.body || "") };
  upstreamCalls.push(call);
  if (call.url.endsWith("/oauth/register")) {
    return new Response(JSON.stringify({
      client_id: "tiktok-dcr-client-id",
      client_id_issued_at: 1784540823,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: ["https://chatgpt.com/connector/oauth/qa-callback"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    }), { status: 201, headers: { "content-type": "application/json" } });
  }
  if (call.url.endsWith("/oauth/revoke")) {
    return new Response("", { status: 200 });
  }
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
const oauth = registerDelegatedOAuthRoutes(app, { publicBaseUrl, fetchFn: fakeFetch });
app.get("/protected", requireDelegatedChatGptOAuth(oauth.resourceMetadataUrl, oauth.resource), (_req, res) => res.json({ ok: true }));

const server = createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const localBase = `http://127.0.0.1:${address.port}`;
const callback = "https://chatgpt.com/connector/oauth/qa-callback";
const verifier = "qa-chatgpt-pkce-verifier-0123456789-ABCDEFG";
const challenge = createHash("sha256").update(verifier).digest("base64url");

try {
  for (const path of [
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-authorization-server/oauth",
    "/oauth/.well-known/oauth-authorization-server"
  ]) {
    const response = await fetch(`${localBase}${path}`);
    assert(response.status === 200, `OAuth discovery failed at ${path}.`);
    const body = await response.json();
    assert(body.issuer === `${publicBaseUrl}/oauth`, `Issuer mismatch at ${path}.`);
    assert(body.registration_endpoint === `${publicBaseUrl}/oauth/register`, "Registration endpoint mismatch.");
    assert(body.code_challenge_methods_supported.includes("S256"), "PKCE S256 is not advertised.");
    assert(body.token_endpoint_auth_methods_supported.includes("none"), "Public-client auth is not advertised.");
  }

  const protectedMetadata = await fetch(`${localBase}/.well-known/oauth-protected-resource/mcp/chatgpt`);
  const protectedBody = await protectedMetadata.json();
  assert(protectedBody.resource === resource, "Protected resource must be the Hooray MCP URL.");
  assert(protectedBody.authorization_servers[0] === `${publicBaseUrl}/oauth`, "Authorization server must be same-origin Hooray OAuth.");

  const missingBearer = await fetch(`${localBase}/protected`);
  assert(missingBearer.status === 401, "Missing bearer token was not rejected.");
  const challengeHeader = missingBearer.headers.get("www-authenticate") || "";
  assert(challengeHeader.includes(`resource=\"${resource}\"`), "OAuth challenge resource is inconsistent.");
  assert(challengeHeader.includes(oauth.resourceMetadataUrl), "OAuth challenge metadata URL is missing.");
  const bearer = await fetch(`${localBase}/protected`, { headers: { Authorization: "Bearer per-user-token" } });
  assert(bearer.status === 200, "Bearer token was rejected before TikTok delegation.");

  const registration = await fetch(`${localBase}/oauth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "ChatGPT QA",
      redirect_uris: [callback],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none"
    })
  });
  assert(registration.status === 201, "Official ChatGPT DCR did not pass through.");
  const registered = await registration.json();
  assert(registered.client_id === "tiktok-dcr-client-id", "TikTok DCR client ID was not returned unchanged.");
  const registrationCall = upstreamCalls.at(-1);
  assert(registrationCall.url === `${upstreamResource}/oauth/register`, "DCR did not reach TikTok Flat MCP.");
  const registrationBody = JSON.parse(registrationCall.body);
  assert(registrationBody.redirect_uris[0] === callback, "ChatGPT callback was rewritten during DCR.");
  assert(registrationBody.token_endpoint_auth_method === "none", "DCR did not enforce a public client.");

  for (const unsafe of [
    "http://localhost:49152/callback",
    "https://54.81.22.17/callback",
    "https://ec2-54-81-22-17.compute-1.amazonaws.com/callback"
  ]) {
    const rejected = await fetch(`${localBase}/oauth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [unsafe], token_endpoint_auth_method: "none" })
    });
    assert(rejected.status === 400, `Unsafe callback was accepted: ${unsafe}`);
  }

  const authorize = new URL(`${localBase}/oauth/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code",
    client_id: registered.client_id,
    redirect_uri: callback,
    state: "chatgpt-state",
    scope: "mcp:tt4b",
    resource,
    code_challenge: challenge,
    code_challenge_method: "S256"
  }).toString();
  const authorizeResponse = await fetch(authorize, { redirect: "manual" });
  assert(authorizeResponse.status === 302, "Authorization did not redirect to TikTok.");
  const upstreamAuthorize = new URL(authorizeResponse.headers.get("location"));
  assert(upstreamAuthorize.origin === "https://business-api.tiktok.com", "Authorization left TikTok Business API.");
  assert(upstreamAuthorize.searchParams.get("client_id") === registered.client_id, "DCR client ID was rewritten.");
  assert(upstreamAuthorize.searchParams.get("redirect_uri") === callback, "Official ChatGPT callback was rewritten.");
  assert(upstreamAuthorize.searchParams.get("code_challenge") === challenge, "PKCE challenge was rewritten.");
  assert(upstreamAuthorize.searchParams.get("resource") === upstreamResource, "TikTok token resource is incorrect.");

  const token = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: registered.client_id,
      code: "tiktok-authorization-code",
      redirect_uri: callback,
      code_verifier: verifier
    })
  });
  assert(token.status === 200, "Token exchange did not pass through.");
  const tokenBody = await token.json();
  assert(tokenBody.access_token === "qa-access-token", "TikTok access token was not returned.");
  const tokenCall = upstreamCalls.at(-1);
  const upstreamTokenBody = new URLSearchParams(tokenCall.body);
  assert(tokenCall.url === `${upstreamResource}/oauth/token`, "Token exchange did not reach TikTok.");
  assert(upstreamTokenBody.get("client_id") === registered.client_id, "Token client ID was rewritten.");
  assert(upstreamTokenBody.get("redirect_uri") === callback, "Token callback was rewritten.");
  assert(upstreamTokenBody.get("code_verifier") === verifier, "Token PKCE verifier was rewritten.");
  assert(upstreamTokenBody.get("resource") === upstreamResource, "Token resource was not normalized for TikTok.");

  const secretAttempt = await fetch(`${localBase}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: registered.client_id, client_secret: "must-not-send", refresh_token: "qa" })
  });
  assert(secretAttempt.status === 401, "A Client Secret was accepted for a PKCE public client.");

  const revoke = await fetch(`${localBase}/oauth/revoke`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: "qa-access-token", client_id: registered.client_id })
  });
  assert(revoke.status === 200, "Revocation did not pass through.");
  assert(upstreamCalls.at(-1).url === `${upstreamResource}/oauth/revoke`, "Revocation did not reach TikTok.");

  console.log(JSON.stringify({
    ok: true,
    checked: [
      "same_origin_oauth_discovery",
      "same_origin_protected_resource",
      "consistent_www_authenticate",
      "official_chatgpt_dcr_passthrough",
      "exact_callback_preservation",
      "pkce_preservation",
      "tiktok_resource_translation",
      "token_passthrough",
      "refresh_compatible_contract",
      "revocation_passthrough",
      "public_client_no_secret",
      "localhost_and_dynamic_ip_rejection"
    ]
  }, null, 2));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
