import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createTikTokAdsPocServer } from "./server.js";
import { getTikTokConfigSummary } from "./config.js";
import { getTikTokMcpAuthSummary, saveTikTokMcpAuthorizationCode } from "./tiktok-mcp.js";

const port = process.env.PORT
  ? Number.parseInt(process.env.PORT, 10)
  : process.env.MCP_PORT
    ? Number.parseInt(process.env.MCP_PORT, 10)
    : 3010;
const currentDir = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: "5mb" }));

app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate", "Mcp-Session-Id", "Last-Event-Id", "Mcp-Protocol-Version"],
    origin: "*"
  })
);

type SessionTransport = StreamableHTTPServerTransport;
const transports: Record<string, SessionTransport> = {};

async function createTransport() {
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

  const server = createTikTokAdsPocServer();
  await server.connect(transport);
  return transport;
}

async function handlePost(req: Request, res: Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport = sessionId ? transports[sessionId] : undefined;

    if (!transport && !sessionId && isInitializeRequest(req.body)) {
      transport = await createTransport();
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

app.post("/mcp", handlePost);
app.get("/mcp", handleGet);
app.delete("/mcp", handleDelete);
app.use(
  "/assets",
  express.static(join(currentDir, "../web/assets"), {
    immutable: true,
    maxAge: "1h"
  })
);

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    name: "tiktok-ads-agent-poc",
    mcpEndpoint: "/mcp",
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
            <pre>${JSON.stringify(req.query, null, 2)}</pre>
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
            <pre>${JSON.stringify(req.query, null, 2)}</pre>
          </body>
        </html>
      `);
      return;
    }

    saveTikTokMcpAuthorizationCode(code, state);

    res.status(200).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>TikTok authorization received</h1>
          <p>You can return to ChatGPT and continue the Hooray TikTok Ads flow.</p>
          <pre>${JSON.stringify(req.query, null, 2)}</pre>
        </body>
      </html>
    `);
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : "Unknown callback error";
    res.status(400).send(`
      <html>
        <body style="font-family: sans-serif; padding: 24px;">
          <h1>TikTok authorization could not be saved</h1>
          <p>${message}</p>
          <pre>${JSON.stringify(req.query, null, 2)}</pre>
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
