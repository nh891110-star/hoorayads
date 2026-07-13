import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  CallToolResultSchema,
  ReadResourceResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";

const REPORT_URI = "ui://widget/tiktok-ads-report-v3.html";
const endpoint =
  process.env.MCP_ENDPOINT ||
  `${(process.env.MCP_BASE_URL || "https://tiktok-ads-agent-poc.onrender.com").replace(/\/$/, "")}/mcp/chatgpt`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function encodeForBrowser(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function createHostHarness(resourceHtml, toolResult) {
  const encodedHtml = encodeForBrowser(resourceHtml);
  const encodedResult = encodeForBrowser(JSON.stringify(toolResult));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Report widget host contract test</title>
    <style>
      body { margin: 0; font-family: sans-serif; background: #eef4f1; }
      #harness-state { padding: 8px 12px; background: #111; color: #fff; font-size: 12px; }
      #report-frame { width: 100%; height: 760px; border: 0; }
    </style>
  </head>
  <body>
    <div id="harness-state" data-mounted="false">Starting MCP Apps bridge...</div>
    <iframe id="report-frame" sandbox="allow-scripts allow-same-origin allow-downloads"></iframe>
    <script>
      const decode = (value) => new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
      const resourceHtml = decode(${JSON.stringify(encodedHtml)});
      const toolResult = JSON.parse(decode(${JSON.stringify(encodedResult)}));
      const frame = document.getElementById("report-frame");
      const state = document.getElementById("harness-state");

      const send = (message) => frame.contentWindow.postMessage({ jsonrpc: "2.0", ...message }, "*");
      const updateMountedState = () => {
        const root = frame.contentDocument?.getElementById("report-root");
        const shell = root?.querySelector(".report-shell");
        const mounted = Boolean(shell && root.innerHTML.trim());
        state.dataset.mounted = String(mounted);
        state.textContent = mounted ? "Widget mounted" : "Widget root remained empty";
      };

      window.addEventListener("message", (event) => {
        if (event.source !== frame.contentWindow) return;
        const message = event.data;
        if (!message || message.jsonrpc !== "2.0") return;

        if (message.method === "ui/initialize" && message.id !== undefined) {
          send({
            id: message.id,
            result: {
              protocolVersion: message.params.protocolVersion,
              hostInfo: { name: "report-widget-qa-host", version: "1.0.0" },
              hostCapabilities: { openLinks: {}, serverTools: {}, logging: {} },
              hostContext: {
                theme: "light",
                displayMode: "inline",
                locale: "en-US",
                timeZone: "America/Los_Angeles",
                viewport: { width: 1024, height: 760, maxHeight: 760 }
              }
            }
          });
          return;
        }

        if (message.method === "ui/notifications/initialized") {
          send({ method: "ui/notifications/tool-result", params: toolResult });
          window.setTimeout(updateMountedState, 100);
          return;
        }

        if (message.method === "ui/request-display-mode" && message.id !== undefined) {
          send({ id: message.id, result: { displayMode: message.params.mode } });
          return;
        }

        if (message.method === "ui/open-link" && message.id !== undefined) {
          send({ id: message.id, result: {} });
        }
      });

      frame.srcdoc = resourceHtml;
    </script>
  </body>
</html>`;
}

async function main() {
  const client = new Client(
    { name: "qa-reporting-widget", version: "1.0.0" },
    {
      capabilities: {
        extensions: {
          "io.modelcontextprotocol/ui": {
            mimeTypes: ["text/html;profile=mcp-app"]
          }
        }
      }
    }
  );
  const transport = new StreamableHTTPClientTransport(new URL(endpoint));
  await client.connect(transport);

  let browser;
  try {
    const tools = await client.listTools();
    const reportTool = tools.tools.find((tool) => tool.name === "get_ads_report");
    assert(reportTool, "get_ads_report is missing from tools/list.");
    assert(reportTool._meta?.ui?.resourceUri === REPORT_URI, "Tool descriptor has the wrong ui.resourceUri.");
    assert(reportTool._meta?.["openai/outputTemplate"] === REPORT_URI, "Tool descriptor has the wrong outputTemplate.");
    assert(reportTool.annotations?.readOnlyHint === true, "Report tool must be read-only.");
    assert(reportTool.annotations?.openWorldHint === false, "Report tool must be closed-world.");
    assert(reportTool.annotations?.idempotentHint === true, "Report tool must be idempotent.");

    const resource = await client.request(
      { method: "resources/read", params: { uri: REPORT_URI } },
      ReadResourceResultSchema
    );
    const content = resource.contents[0];
    const resourceHtml = content?.text || "";
    assert(content?.uri === REPORT_URI, "resources/read returned a mismatched URI.");
    assert(content?.mimeType === "text/html;profile=mcp-app", "resources/read returned the wrong MIME type.");
    assert(resourceHtml.length > 0, "Widget resource HTML is empty.");
    assert(resourceHtml.includes('id="report-root"'), "Widget resource is missing #report-root.");
    assert(resourceHtml.includes("ui/notifications/tool-result"), "Widget resource is missing the tool-result bridge.");
    assert(!JSON.stringify({ reportTool, resource }).includes("tiktok-ads-report-v2"), "A stale v2 widget URI remains.");

    const toolResult = await client.callTool(
      {
        name: "get_ads_report",
        arguments: { mode: "demo", level: "campaign", comparePreviousPeriod: true }
      },
      CallToolResultSchema
    );
    const reportState = toolResult.structuredContent?.reportState;
    assert(reportState?.status === "ready", "Demo report state is not ready.");
    assert(Array.isArray(reportState.kpis) && reportState.kpis.length === 4, "Demo report KPIs are invalid.");
    assert(Array.isArray(reportState.rows) && reportState.rows.length > 0, "Demo report rows are invalid.");
    assert(Array.isArray(reportState.trend) && reportState.trend.length === 7, "Demo report trend is invalid.");
    if (endpoint.endsWith("/mcp/claude")) {
      const fallbackText = toolResult.content?.find((item) => item.type === "text")?.text || "";
      assert(fallbackText.includes("### TikTok Ads performance report"), "Claude fallback heading is missing.");
      assert(fallbackText.includes("| Metric | Value |"), "Claude fallback metric table is missing.");
    }

    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    page.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`));

    await page.setContent(createHostHarness(resourceHtml, toolResult), { waitUntil: "load" });
    await page.locator('#harness-state[data-mounted="true"]').waitFor({ timeout: 10000 });
    const widgetFrame = page.frames().find((frame) => frame !== page.mainFrame());
    assert(widgetFrame, "The report iframe did not mount.");
    await widgetFrame.locator("#report-root .report-shell").waitFor({ timeout: 5000 });
    const widgetText = await widgetFrame.locator("#report-root").innerText();
    const rootHtml = await widgetFrame.locator("#report-root").innerHTML();
    assert(rootHtml.trim().length > 0, "The report widget root remained empty.");
    assert(widgetText.includes(reportState.advertiser.name), "The mounted widget did not receive the tool result.");
    assert((await widgetFrame.locator(".kpi-card").count()) === 4, "The mounted widget did not render four KPI cards.");

    const screenshotPath = process.env.REPORT_WIDGET_SCREENSHOT;
    if (screenshotPath) {
      await mkdir(dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    const debug = {
      ok: true,
      endpoint,
      descriptorMeta: reportTool._meta,
      annotations: reportTool.annotations,
      resourceRead: {
        uri: content.uri,
        mimeType: content.mimeType,
        textBytes: Buffer.byteLength(resourceHtml),
        textSha256: createHash("sha256").update(resourceHtml).digest("hex"),
        meta: content._meta
      },
      toolResult: {
        isError: Boolean(toolResult.isError),
        status: reportState.status,
        kpis: reportState.kpis.length,
        rows: reportState.rows.length,
        trendPoints: reportState.trend.length
      },
      mount: {
        iframeMounted: true,
        rootBytes: Buffer.byteLength(rootHtml),
        kpiCards: 4,
        consoleMessages,
        pageErrors,
        failedRequests,
        screenshotPath: screenshotPath || null
      }
    };

    if (process.env.REPORT_WIDGET_DEBUG_OUTPUT) {
      await mkdir(dirname(process.env.REPORT_WIDGET_DEBUG_OUTPUT), { recursive: true });
      await writeFile(process.env.REPORT_WIDGET_DEBUG_OUTPUT, JSON.stringify(debug, null, 2));
    }
    if (process.env.REPORT_WIDGET_RAW_OUTPUT) {
      await mkdir(dirname(process.env.REPORT_WIDGET_RAW_OUTPUT), { recursive: true });
      await writeFile(
        process.env.REPORT_WIDGET_RAW_OUTPUT,
        JSON.stringify({ reportTool, resource, toolResult }, null, 2)
      );
    }
    console.log(JSON.stringify(debug, null, 2));
  } finally {
    await browser?.close();
    await transport.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
