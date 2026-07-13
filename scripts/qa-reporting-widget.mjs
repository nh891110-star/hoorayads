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

const REPORT_URI = "ui://widget/tiktok-ads-report-v8.html";
const LEGACY_REPORT_URIS = [
  "ui://widget/tiktok-ads-report-v7.html",
  "ui://widget/tiktok-ads-report-v6.html",
  "ui://widget/tiktok-ads-report-v5.html",
  "ui://widget/tiktok-ads-report-v4.html",
  "ui://widget/tiktok-ads-report-v3.html",
  "ui://widget/tiktok-ads-report-v2.html",
  "ui://widget/tiktok-ads-report-v1.html"
];
const endpoint =
  process.env.MCP_ENDPOINT ||
  `${(process.env.MCP_BASE_URL || "https://tiktok-ads-agent-poc.onrender.com").replace(/\/$/, "")}/mcp/chatgpt`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function encodeForBrowser(value) {
  return Buffer.from(value, "utf8").toString("base64");
}

function createHostHarness(resourceHtml, toolResult, toolResultsByLevel = {}) {
  const encodedHtml = encodeForBrowser(resourceHtml);
  const encodedResult = encodeForBrowser(JSON.stringify(toolResult));
  const encodedLevelResults = encodeForBrowser(JSON.stringify(toolResultsByLevel));

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
      const toolResultsByLevel = JSON.parse(decode(${JSON.stringify(encodedLevelResults)}));
      const frame = document.getElementById("report-frame");
      const state = document.getElementById("harness-state");
      window.__lastToolCall = null;
      window.__lastOpenLink = null;

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

        if (message.method === "tools/call" && message.id !== undefined) {
          window.__lastToolCall = message.params;
          const level = message.params?.arguments?.level;
          send({ id: message.id, result: toolResultsByLevel[level] || toolResult });
          return;
        }

        if (message.method === "ui/open-link" && message.id !== undefined) {
          window.__lastOpenLink = message.params?.url || null;
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
    assert(!("mode" in (reportTool.inputSchema?.properties || {})), "Production get_ads_report must not expose a demo mode.");

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
    assert(resourceHtml.includes('data-filter="advertiserId"'), "Widget resource is missing the advertiser account filter.");
    assert(resourceHtml.includes('role="combobox"'), "Advertiser Account is not rendered as a searchable combobox.");
    assert(resourceHtml.includes("TIKTOK DIAGNOSIS"), "Widget resource is missing the TikTok Diagnosis module.");
    assert(!resourceHtml.includes("WHAT CHANGED"), "Widget resource still contains the old What changed module.");
    assert(!resourceHtml.includes("Quick read"), "Widget resource still contains the old Quick read label.");
    assert(
      resourceHtml.indexOf('data-filter="advertiserId"') < resourceHtml.indexOf('data-filter="level"'),
      "Advertiser Account must appear before Level in the shared widget."
    );
    for (const legacyUri of LEGACY_REPORT_URIS) {
      const legacyResource = await client.request(
        { method: "resources/read", params: { uri: legacyUri } },
        ReadResourceResultSchema
      );
      const legacyContent = legacyResource.contents[0];
      assert(legacyContent?.uri === legacyUri, `Legacy resource returned a mismatched URI for ${legacyUri}.`);
      assert(legacyContent?.mimeType === "text/html;profile=mcp-app", `Legacy resource has the wrong MIME type for ${legacyUri}.`);
      assert(legacyContent?.text === resourceHtml, `Legacy resource does not serve the current widget HTML for ${legacyUri}.`);
    }

    const liveToolResult = await client.callTool(
      {
        name: "get_ads_report",
        arguments: {
          level: "campaign",
          startDate: "2026-07-06",
          endDate: "2026-07-12",
          comparePreviousPeriod: true
        }
      },
      CallToolResultSchema
    );
    const liveReportState = liveToolResult.structuredContent?.reportState;
    assert(liveReportState, "Live get_ads_report returned no report state.");
    if (liveReportState.status !== "ready") {
      assert((liveReportState.rows || []).length === 0, "An unavailable live report must not fall back to sample rows.");
      assert(!JSON.stringify(liveReportState).includes("Sample Advertiser Account"), "Live report returned sample account data.");
    }
    if (endpoint.endsWith("/mcp/claude")) {
      const fallbackText = liveToolResult.content?.find((item) => item.type === "text")?.text || "";
      assert(fallbackText.includes("### TikTok Ads performance report"), "Claude fallback heading is missing.");
    }

    const reportState = {
      status: "ready",
      generatedAt: "2026-07-13T12:00:00.000Z",
      advertiser: { id: "7390012345", name: "Authorized Advertiser", currency: "USD", timezone: "America/Los_Angeles" },
      accountOptions: [{ advertiserId: "7390012345", advertiserName: "Authorized Advertiser", currency: "USD", timezone: "America/Los_Angeles" }],
      filters: { startDate: "2026-07-06", endDate: "2026-07-12", level: "campaign", comparePreviousPeriod: true },
      totals: { spend: 5206.2, impressions: 745520, clicks: 14094, ctr: 1.89, cpc: 0.37, cpm: 6.98 },
      kpis: [
        { key: "spend", label: "Spend", value: 5206.2, deltaPercent: 12.4 },
        { key: "impressions", label: "Impressions", value: 745520, deltaPercent: 8.6 },
        { key: "clicks", label: "Clicks", value: 14094, deltaPercent: 15.8 },
        { key: "ctr", label: "CTR", value: 1.89, deltaPercent: 6.7 }
      ],
      trend: [
        ["2026-07-06", 520, 126738, 1268],
        ["2026-07-07", 625, 104373, 2255],
        ["2026-07-08", 469, 134194, 1691],
        ["2026-07-09", 833, 82007, 2819],
        ["2026-07-10", 677, 119283, 1409],
        ["2026-07-11", 937, 96918, 2678],
        ["2026-07-12", 1145, 82007, 1974]
      ].map(([date, spend, impressions, clicks]) => ({ date, spend, impressions, clicks })),
      rows: [
        ["qa-campaign-1", "Summer Sale | Prospecting", "Active", 1842.6, 284100, 4688],
        ["qa-campaign-2", "Always-on Retargeting", "Active", 1260.4, 146220, 3224],
        ["qa-campaign-3", "Creator Spark Test", "Active", 922.15, 121800, 2777],
        ["qa-campaign-4", "Catalog Best Sellers", "Active", 714.8, 103700, 1984],
        ["qa-campaign-5", "App Install | US", "Paused", 466.25, 89700, 1421]
      ].map(([id, name, status, spend, impressions, clicks]) => ({
        id,
        name,
        status,
        spend,
        impressions,
        clicks,
        ctr: (clicks / impressions) * 100,
        cpc: spend / clicks,
        cpm: (spend / impressions) * 1000
      })),
      diagnosis: {
        status: "issues",
        suggestions: [
          {
            source: "tiktok",
            category: "creative",
            suggestionCode: "VIDEO_RESOLUTION",
            suggestionId: "suggestion-creative-1",
            adgroupId: "qa-adgroup-1",
            adId: "qa-ad-1",
            entityName: "Prospecting video A",
            message: "Replace this video with a higher-resolution version.",
            suggestionTime: "2026-07-13 10:30:00",
            details: ["Ad group ID: qa-adgroup-1", "Ad ID: qa-ad-1"]
          },
          {
            source: "tiktok",
            category: "bid_and_budget",
            suggestionCode: "SUGGEST_BUDGET",
            suggestionId: "suggestion-budget-1",
            adgroupId: "qa-adgroup-2",
            entityName: "Retargeting | 14-day visitors",
            message: "TikTok recommends adjusting the budget.",
            currentValue: "100 USD",
            recommendedValue: "140 USD",
            suggestionTime: "2026-07-13 10:30:00"
          },
          {
            source: "tiktok",
            category: "event_track",
            suggestionCode: "PIXEL",
            suggestionId: "suggestion-pixel-1",
            adgroupId: "qa-adgroup-3",
            entityName: "Creator audience | US",
            message: "Check and test the Pixel setup; TikTok detected no recent activity.",
            suggestionTime: "2026-07-13 10:30:00"
          }
        ]
      },
      exportUrl: "https://example.test/report.csv"
    };
    const toolResult = {
      ...liveToolResult,
      isError: false,
      structuredContent: { reportState },
      content: [{ type: "text", text: "QA fixture for widget rendering only." }]
    };
    assert(reportState.kpis.length === 4, "QA fixture KPIs are invalid.");
    assert(reportState.rows.length > 0, "QA fixture rows are invalid.");
    assert(reportState.trend.length === 7, "QA fixture trend is invalid.");
    const trendSignatures = ["spend", "clicks", "impressions"].map((key) =>
      reportState.trend.map((point) => point[key]).join(",")
    );
    assert(new Set(trendSignatures).size === 3, "QA fixture metrics share the same trend series.");
    const adgroupResult = structuredClone(toolResult);
    adgroupResult.structuredContent.reportState = {
      ...reportState,
      filters: { ...reportState.filters, level: "adgroup" },
      rows: reportState.rows.map((row, index) => ({
        ...row,
        id: `qa-adgroup-${index + 1}`,
        name: ["Prospecting | Broad US", "Retargeting | 14-day visitors", "Creator audience | US", "Catalog | High intent", "App installs | iOS"][index]
      }))
    };
    const consoleMessages = [];
    const pageErrors = [];
    const failedRequests = [];
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    page.on("console", (message) => consoleMessages.push({ type: message.type(), text: message.text() }));
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText || "failed"}`));

    await page.setContent(createHostHarness(resourceHtml, toolResult, { adgroup: adgroupResult }), { waitUntil: "load" });
    await page.locator('#harness-state[data-mounted="true"]').waitFor({ timeout: 10000 });
    const widgetFrame = page.frames().find((frame) => frame !== page.mainFrame());
    assert(widgetFrame, "The report iframe did not mount.");
    await widgetFrame.locator("#report-root .report-shell").waitFor({ timeout: 5000 });
    const widgetText = await widgetFrame.locator("#report-root").innerText();
    const rootHtml = await widgetFrame.locator("#report-root").innerHTML();
    assert(rootHtml.trim().length > 0, "The report widget root remained empty.");
    assert(widgetText.includes(reportState.advertiser.name), "The mounted widget did not receive the tool result.");
    assert((await widgetFrame.locator(".kpi-card").count()) === 4, "The mounted widget did not render four KPI cards.");
    assert((await widgetFrame.locator(".source-badge").count()) === 0, "The report still exposes a data-source badge.");
    assert(widgetText.includes("TIKTOK DIAGNOSIS"), "The mounted widget did not render TikTok Diagnosis.");
    assert(widgetText.includes("Issues & recommendations"), "The Diagnosis heading is incorrect.");
    assert(!widgetText.includes("WHAT CHANGED"), "The mounted widget still shows What changed.");
    assert(!widgetText.includes("Quick read"), "The mounted widget still shows Quick read.");
    assert((await widgetFrame.locator(".diagnosis-panel > .diagnosis-list > .diagnosis-item").count()) === 2, "Diagnosis must show the first two official recommendations by default.");
    assert((await widgetFrame.locator("details.all-diagnoses").count()) === 1, "Additional diagnosis recommendations must be collapsed.");
    assert((await widgetFrame.locator(".date-chip").innerText()) === "Jul 6 – Jul 12", "The date chip shifted the selected range by one day.");
    const spendPoints = await widgetFrame.locator(".chart-line").getAttribute("points");
    await widgetFrame.locator('[data-trend="clicks"]').click();
    const clickPoints = await widgetFrame.locator(".chart-line").getAttribute("points");
    assert(spendPoints !== clickPoints, "Switching from Spend to Clicks did not change the trend line.");
    await widgetFrame.locator('[data-trend="impressions"]').click();
    const impressionPoints = await widgetFrame.locator(".chart-line").getAttribute("points");
    assert(clickPoints !== impressionPoints, "Switching from Clicks to Impressions did not change the trend line.");
    assert(spendPoints !== impressionPoints, "Spend and Impressions still render the same trend line.");

    await widgetFrame.locator('[data-action="expand"]').click();
    await widgetFrame.locator(".filter-bar").waitFor({ timeout: 5000 });
    await widgetFrame.locator('[data-action="export"]').click();
    await page.waitForFunction(() => Boolean(window.__lastOpenLink), null, { timeout: 5000 });
    const openedExportUrl = await page.evaluate(() => window.__lastOpenLink);
    assert(openedExportUrl === reportState.exportUrl, "Export CSV did not open the server-backed export URL.");
    const filterLabels = await widgetFrame.locator(".filter-bar > .account-field, .filter-bar > label").allTextContents();
    assert(filterLabels[0]?.trim().startsWith("Advertiser Account"), "Advertiser Account is not the first report control.");
    await widgetFrame.locator('[data-filter="level"]').selectOption("adgroup");
    await widgetFrame.locator(".table-toolbar h2").filter({ hasText: "ad group performance" }).waitFor({ timeout: 5000 });
    assert((await widgetFrame.locator("tbody tr:first-child td:first-child strong").innerText()) === "Prospecting | Broad US", "Ad group selection did not replace campaign rows.");
    const levelToolCall = await page.evaluate(() => window.__lastToolCall);
    assert(levelToolCall?.arguments?.level === "adgroup", "Level selection did not call get_ads_report with adgroup level.");
    const accountFilter = widgetFrame.locator('[data-filter="advertiserId"]');
    assert((await widgetFrame.locator('[data-filter="mode"]').count()) === 0, "The report still exposes a data-source selector.");
    assert((await accountFilter.inputValue()).includes("Authorized Advertiser"), "Authorized account is not shown in the account input.");
    assert(!(await accountFilter.isDisabled()), "Advertiser Account must stay editable so users can search or type an ID.");
    await accountFilter.focus();
    assert((await accountFilter.inputValue()).includes("7390012345"), "Focusing the account input lost the selected advertiser ID.");

    const needsAccountResult = {
      ...toolResult,
      structuredContent: {
        reportState: {
          ...reportState,
          status: "needs_account",
          advertiser: null,
          accountOptions: [
            { advertiserId: "adv-001", advertiserName: "North America Shop", currency: "USD", timezone: "America/Los_Angeles" },
            { advertiserId: "adv-002", advertiserName: "Europe Shop", currency: "EUR", timezone: "Europe/Paris" }
          ],
          kpis: [],
          trend: [],
          rows: [],
          message: "Choose an advertiser account to generate the report."
        }
      }
    };
    const setupPage = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    await setupPage.setContent(createHostHarness(resourceHtml, needsAccountResult), { waitUntil: "load" });
    await setupPage.locator('#harness-state[data-mounted="true"]').waitFor({ timeout: 10000 });
    const setupFrame = setupPage.frames().find((frame) => frame !== setupPage.mainFrame());
    assert(setupFrame, "The advertiser setup iframe did not mount.");
    const setupLabels = await setupFrame.locator(".filter-bar > .account-field, .filter-bar > label").allTextContents();
    assert(setupLabels[0]?.trim().startsWith("Advertiser Account"), "Account selection is not first in the setup state.");
    const setupAccountFilter = setupFrame.locator('[data-filter="advertiserId"]');
    assert(!(await setupAccountFilter.isDisabled()), "Live advertiser account selection should be enabled.");
    await setupAccountFilter.fill("Europe");
    const europeOption = setupFrame.locator('[data-advertiser-option="adv-002"]');
    await europeOption.waitFor({ state: "visible", timeout: 5000 });
    assert(!(await setupFrame.locator('[data-advertiser-option="adv-001"]').isVisible()), "Account search did not filter non-matching accounts.");
    const accountScreenshotPath = process.env.REPORT_WIDGET_ACCOUNT_SCREENSHOT;
    if (accountScreenshotPath) {
      await mkdir(dirname(accountScreenshotPath), { recursive: true });
      await setupPage.screenshot({ path: accountScreenshotPath, fullPage: true });
    }
    await europeOption.click();
    assert((await setupAccountFilter.inputValue()).includes("Europe Shop"), "Selected account label was not written back to the input.");
    await setupFrame.locator('[data-action="apply"]').click();
    await setupPage.waitForFunction(() => Boolean(window.__lastToolCall), null, { timeout: 5000 });
    const setupToolCall = await setupPage.evaluate(() => window.__lastToolCall);
    assert(setupToolCall?.arguments?.advertiserId === "adv-002", "Apply did not send the selected advertiserId.");
    assert(setupToolCall?.arguments?.level === "campaign", "Apply did not preserve the selected report level.");
    const rawIdInput = setupFrame.locator('[data-filter="advertiserId"]');
    await rawIdInput.fill("7380012345");
    await setupFrame.locator('[data-action="apply"]').click();
    await setupPage.waitForFunction(
      () => window.__lastToolCall?.arguments?.advertiserId === "7380012345",
      null,
      { timeout: 5000 }
    );
    const rawIdToolCall = await setupPage.evaluate(() => window.__lastToolCall);
    assert(rawIdToolCall?.arguments?.advertiserId === "7380012345", "An exact typed advertiser ID was not sent unchanged.");
    await setupPage.close();

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
        firstFilter: filterLabels[0]?.trim() || null,
        accountEditable: !(await accountFilter.isDisabled()),
        levelSelectionSent: levelToolCall.arguments.level,
        selectedAdvertiserIdSent: setupToolCall.arguments.advertiserId,
        typedAdvertiserIdSent: rawIdToolCall.arguments.advertiserId,
        accountSearchScreenshotPath: accountScreenshotPath || null,
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
