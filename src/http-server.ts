import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createTikTokAdsPocServer } from "./server.js";
import type { HostSurface } from "./server.js";
import { getTikTokAppConfig, getTikTokConfigSummary } from "./config.js";
import { getTikTokMcpAuthSummary, saveTikTokMcpAuthorizationCode } from "./tiktok-mcp.js";
import { getReportExport } from "./report-export.js";
import {
  createCampaignLaunchReviewDemo,
  createCampaignUpdateReviewDemo,
  createCreativePerformanceDemo
} from "./decision-demo.js";
import { registerDelegatedOAuthRoutes, requireDelegatedChatGptOAuth } from "./delegated-oauth.js";

const port = process.env.PORT
  ? Number.parseInt(process.env.PORT, 10)
  : process.env.MCP_PORT
    ? Number.parseInt(process.env.MCP_PORT, 10)
    : 3010;
const currentDir = dirname(fileURLToPath(import.meta.url));
const reportingWidgetJs = readFileSync(join(currentDir, "../web/reporting-widget.js"), "utf8");
const reportingWidgetCss = readFileSync(join(currentDir, "../web/reporting-widget.css"), "utf8");
const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Last-Event-Id", "Mcp-Protocol-Version"],
    origin: "*"
  })
);
const publicBaseUrl = (
  process.env.PUBLIC_BASE_URL || process.env.HOORAY_PUBLIC_BASE_URL || "https://tiktok-ads-agent-poc.onrender.com"
).replace(/\/$/, "");
const tikTokAppConfig = getTikTokAppConfig();
const delegatedOAuth = registerDelegatedOAuthRoutes(app, {
  publicBaseUrl,
  tikTokFlatMcpUrl: process.env.TIKTOK_FLAT_MCP_URL
});
const requireChatGptOAuth = requireDelegatedChatGptOAuth(
  delegatedOAuth.resourceMetadataUrl,
  delegatedOAuth.resource
);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

type SessionTransport = StreamableHTTPServerTransport;
const transports: Record<string, SessionTransport> = {};

function delegatedTikTokAuthorization(req: Request) {
  const authorization = req.headers.authorization?.trim();
  return authorization && /^Bearer\s+\S+$/i.test(authorization) ? authorization : undefined;
}

function hostSurfaceForPath(path: string): HostSurface {
  if (path.endsWith("/claude")) return "claude";
  if (path.endsWith("/reporting")) return "reporting";
  if (path.endsWith("/chatgpt")) return "chatgpt";
  return "generic";
}

async function createTransport(hostSurface: HostSurface, tikTokAuthorization?: string) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId: string) => {
      transports[sessionId] = transport;
    }
  });

  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId && transports[sessionId]) {
      delete transports[sessionId];
    }
  };

  const server = createTikTokAdsPocServer(hostSurface, { tikTokAuthorization });
  await server.connect(transport);
  return transport;
}

async function handleStatelessPost(req: Request, res: Response, hostSurface: HostSurface) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  const server = createTikTokAdsPocServer(hostSurface, {
    tikTokAuthorization: delegatedTikTokAuthorization(req)
  });
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    void Promise.allSettled([transport.close(), server.close()]);
  };

  res.once("finish", close);
  res.once("close", close);
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

async function handlePost(req: Request, res: Response) {
  const hostSurface = hostSurfaceForPath(req.path);

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (hostSurface === "claude") {
      await handleStatelessPost(req, res, hostSurface);
      return;
    }

    let transport = sessionId ? transports[sessionId] : undefined;

    if (!transport && !sessionId && isInitializeRequest(req.body)) {
      transport = await createTransport(hostSurface, delegatedTikTokAuthorization(req));
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!transport && sessionId) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Session not found" },
        id: null
      });
      return;
    }

    if (!transport) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: initialize first" },
        id: null
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP POST request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
}

async function handleGet(req: Request, res: Response) {
  if (hostSurfaceForPath(req.path) === "claude") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null
    });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId) {
    res.status(400).send("Missing session ID");
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handleRequest(req, res);
}

async function handleDelete(req: Request, res: Response) {
  if (hostSurfaceForPath(req.path) === "claude") {
    res.setHeader("Allow", "POST");
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null
    });
    return;
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId) {
    res.status(400).send("Missing session ID");
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send("Session not found");
    return;
  }

  await transport.handleRequest(req, res);
}

const mcpEndpoints = ["/mcp", "/mcp-v2", "/mcp/chatgpt", "/mcp/claude", "/mcp/reporting"];
app.post(mcpEndpoints, (req, res, next) => req.path === "/mcp/chatgpt" ? requireChatGptOAuth(req, res, next) : next(), handlePost);
app.get(mcpEndpoints, (req, res, next) => req.path === "/mcp/chatgpt" ? requireChatGptOAuth(req, res, next) : next(), handleGet);
app.delete(mcpEndpoints, (req, res, next) => req.path === "/mcp/chatgpt" ? requireChatGptOAuth(req, res, next) : next(), handleDelete);
app.get("/report-preview", (req: Request, res: Response) => {
  const preview = typeof req.query.card === "string" ? req.query.card : "";
  const decisionState = preview === "creative"
    ? createCreativePerformanceDemo()
    : preview === "launch"
      ? createCampaignLaunchReviewDemo()
      : preview === "update"
        ? createCampaignUpdateReviewDemo()
        : null;
  const serializedDecisionState = JSON.stringify(decisionState).replaceAll("<", "\\u003c");
  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Hooray TikTok Ads Reporting</title>
        <style>body { padding: 20px; background: #eef4f1; } ${reportingWidgetCss}</style>
      </head>
      <body>
        <div id="report-root"></div>
        <script>window.__DECISION_PREVIEW_STATE__ = ${serializedDecisionState};</script>
        <script type="module">${reportingWidgetJs}</script>
      </body>
    </html>
  `);
});
app.get("/report-exports/:token.csv", (req: Request, res: Response) => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const storedExport = getReportExport(token);
  if (!storedExport) {
    res.status(404).type("text").send("This report export has expired. Generate the report again to create a new CSV.");
    return;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Disposition", `attachment; filename="${storedExport.filename}"`);
  res.type("text/csv; charset=utf-8").send(`\uFEFF${storedExport.csv}`);
});
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    name: "tiktok-ads-agent-poc",
    mcpEndpoint: "/mcp",
    mcpEndpointV2: "/mcp-v2",
    chatGptMcpEndpoint: "/mcp/chatgpt",
    claudeMcpEndpoint: "/mcp/claude",
    reportingMcpEndpoint: "/mcp/reporting",
    chatGptOAuth: {
      mode: "direct_tiktok_per_user",
      authorizationServer: delegatedOAuth.upstreamAuthorizationServer,
      tokenResource: delegatedOAuth.upstreamResource,
      resourceMetadataUrl: delegatedOAuth.resourceMetadataUrl,
      expectedClientRedirect: "https://chatgpt.com/connector/oauth/{connector-id}"
    },
    claudeTransportMode: "stateless",
    reportPreview: "/report-preview",
    sessions: Object.keys(transports).length,
    tikTokConfig: getTikTokConfigSummary(),
    tikTokMcpAuth: getTikTokMcpAuthSummary()
  });
});

app.get("/callback", (req: Request, res: Response) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const error = typeof req.query.error === "string" ? req.query.error : "";

  try {
    if (error) {
      res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h1>TikTok authorization failed</h1>
            <p>The TikTok MCP callback returned an error. Go back to ChatGPT and retry the authorization step.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.status(400).send(`
        <html>
          <body style="font-family: sans-serif; padding: 24px;">
            <h1>Missing authorization code</h1>
            <p>The callback did not include a TikTok authorization code. Go back to ChatGPT and retry the authorization step.</p>
          </body>
        </html>
      `);
      return;
    }

    const surface = saveTikTokMcpAuthorizationCode(code, state);

    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>TikTok authorization received</h1>
          <p>You can return to your TikTok Ads app in ChatGPT or Claude and continue.</p>
          <p>Authorization target: ${surface === "flat" ? "TikTok Ads Flat MCP reporting" : "TikTok Ads Progressive MCP"}.</p>
        </body>
      </html>
    `);
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "Unknown callback error";
    res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>TikTok authorization could not be saved</h1>
          <p>${escapeHtml(message)}</p>
        </body>
      </html>
    `);
  }
});

app.listen(port, (error?: Error) => {
  if (error) {
    console.error("Failed to start MCP server:", error);
    process.exit(1);
  }

  console.log(`TikTok Ads Agent POC MCP server listening on http://localhost:${port}/mcp`);
  console.log(`Health check available at http://localhost:${port}/health`);
});
