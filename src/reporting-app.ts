import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  decisionCardDemoOutput,
  getAdsReportInput,
  getAdsReportOutput,
  getCreativePerformanceDemoInput,
  reviewCampaignLaunchDemoInput,
  reviewCampaignUpdateDemoInput
} from "./app-contract.js";
import {
  createCampaignLaunchReviewDemo,
  createCampaignUpdateReviewDemo,
  createCreativePerformanceDemo
} from "./decision-demo.js";
import { createReportExport } from "./report-export.js";
import { createDemoTikTokAdsReport } from "./reporting-demo.js";
import { getTikTokAdsReport } from "./reporting.js";
import type { GetAdsReportInput, ReportState } from "./reporting.js";

export const REPORT_WIDGET_URI = "ui://widget/tiktok-ads-report-v13.html";
const REPORT_WIDGET_DESCRIPTION =
  "Interactive TikTok Ads performance reporting and deterministic decision-card previews.";

const currentDir = dirname(fileURLToPath(import.meta.url));
const widgetJs = readFileSync(join(currentDir, "../web/reporting-widget.js"), "utf8");
const widgetCss = readFileSync(join(currentDir, "../web/reporting-widget.css"), "utf8");

const TOOL_META = {
  ui: { resourceUri: REPORT_WIDGET_URI, visibility: ["model", "app"] },
  "openai/outputTemplate": REPORT_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Generating TikTok Ads report...",
  "openai/toolInvocation/invoked": "TikTok Ads report ready."
} as const;

const RESULT_META = {
  [RESOURCE_URI_META_KEY]: REPORT_WIDGET_URI,
  ui: { resourceUri: REPORT_WIDGET_URI },
  "openai/outputTemplate": REPORT_WIDGET_URI
} as const;

function formatNumber(value: number, fractionDigits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: fractionDigits }).format(value);
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function breakdown(reportState: ReportState, currency: string) {
  const rows = reportState.rows.slice(0, 10);
  if (reportState.filters.level === "adgroup") {
    return [
      "#### Ad group performance",
      "",
      "| Name | Status | Ad group ID | Budget | Bid | Ad scheduling | Attribution setting |",
      "|---|---|---|---|---|---|---|",
      ...rows.map((row) => `| ${[
        row.name,
        row.status,
        row.details.adgroupId || row.id,
        row.details.budget || "--",
        row.details.bid || "--",
        row.details.adScheduling || "--",
        row.details.attributionSetting || "--"
      ].map((value) => escapeCell(value)).join(" | ")} |`)
    ];
  }
  if (reportState.filters.level === "ad") {
    return [
      "#### Ad performance",
      "",
      "| Name | Status | Source | Ad group ID | Ad group name | Ad ID |",
      "|---|---|---|---|---|---|",
      ...rows.map((row) => `| ${[
        row.name,
        row.status,
        row.details.source || "--",
        row.details.adgroupId || "--",
        row.details.adgroupName || "--",
        row.details.adId || row.id
      ].map((value) => escapeCell(value)).join(" | ")} |`)
    ];
  }
  return [
    "#### Campaign performance",
    "",
    "| Name | Status | Campaign budget | Spend | CPC (destination) | CPM | Impressions |",
    "|---|---|---|---:|---:|---:|---:|",
    ...rows.map((row) =>
      `| ${escapeCell(row.name)} | ${escapeCell(row.status)} | ${escapeCell(row.details.campaignBudget || "--")} | ${formatNumber(row.spend)} ${currency} | ${formatNumber(row.cpc)} ${currency} | ${formatNumber(row.cpm)} ${currency} | ${formatNumber(row.impressions, 0)} |`
    )
  ];
}

export function claudeReportFallback(reportState: ReportState) {
  if (reportState.status !== "ready") {
    const accounts = (reportState.accountOptions || []).map(
      (account) => `- ${account.advertiserName} (${account.advertiserId}, ${account.currency})`
    );
    return [
      "### TikTok Ads performance report",
      "",
      reportState.message || `Report status: ${reportState.status.replaceAll("_", " ")}.`,
      ...(accounts.length ? ["", "**Advertiser Account options:**", ...accounts] : [])
    ].join("\n");
  }

  const currency = reportState.advertiser?.currency || "";
  const rows = reportState.kpis.map((kpi) => {
    const suffix = kpi.key === "ctr" ? "%" : kpi.key === "spend" || kpi.key === "cpc" || kpi.key === "cpm" ? ` ${currency}` : "";
    const delta = kpi.deltaPercent === null ? "-" : `${kpi.deltaPercent >= 0 ? "+" : ""}${formatNumber(kpi.deltaPercent, 1)}%`;
    return `| ${kpi.label} | ${formatNumber(kpi.value)}${suffix} | ${delta} |`;
  });
  const breakdownRows = breakdown(reportState, currency);

  return [
    "### TikTok Ads performance report",
    "",
    `**Account:** ${reportState.advertiser?.name || "TikTok Ads account"}`,
    `**Period:** ${reportState.filters.startDate} to ${reportState.filters.endDate}`,
    `**Level:** ${reportState.filters.level}`,
    "",
    "| Metric | Value | Change vs previous period |",
    "|---|---:|---:|",
    ...rows,
    "",
    ...breakdownRows
  ].join("\n");
}

function registerResource(server: McpServer, resourceMeta: Record<string, unknown>) {
  registerAppResource(
    server,
    "tiktok-ads-report-v13",
    REPORT_WIDGET_URI,
    {
      title: "TikTok Ads performance report",
      description: REPORT_WIDGET_DESCRIPTION,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: resourceMeta
    },
    async () => ({
      contents: [{
        uri: REPORT_WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: `<div id="report-root"></div>\n<style>${widgetCss}</style>\n<script type="module">${widgetJs}</script>`,
        _meta: resourceMeta
      }]
    })
  );
}

export function registerReportingApp(
  server: McpServer,
  options: { publicBaseUrl: string; resourceMeta: Record<string, unknown> }
) {
  registerResource(server, options.resourceMeta);

  registerAppTool(
    server,
    "get_ads_report",
    {
      title: "Get TikTok Ads report",
      description:
        "Generate an interactive TikTok Ads performance report from Flat MCP report_integrated_get and official tool_diagnosis_get. Advertiser Account is required and must come from user selection or an authorized account. Defaults to the last seven complete days, Campaign level, and previous-period comparison.",
      inputSchema: getAdsReportInput,
      outputSchema: getAdsReportOutput,
      _meta: TOOL_META,
        annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (input: GetAdsReportInput) => {
      const generated = await getTikTokAdsReport(input);
      const exportUrl = createReportExport(generated, options.publicBaseUrl);
      const reportState = exportUrl ? { ...generated, exportUrl } : generated;
      return {
        structuredContent: { reportState },
        content: [{ type: "text" as const, text: claudeReportFallback(reportState) }],
        _meta: {
          ...RESULT_META,
          diagnosisApi: "tool_diagnosis_get",
          reportApi: "report_integrated_get",
          reportMcpSurface: "flat"
        }
      };
    }
  );

  registerAppTool(
    server,
    "get_ads_report_demo",
    {
      title: "Preview TikTok Ads report",
      description:
        "Generate the interactive reporting UI with deterministic demo data. Use only for an explicit demo, preview, or UI test. It does not call TikTok APIs and must not be presented as live data.",
      inputSchema: getAdsReportInput,
      outputSchema: getAdsReportOutput,
      _meta: TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true }
    },
    async (input: GetAdsReportInput) => {
      const generated = createDemoTikTokAdsReport(input);
      const exportUrl = createReportExport(generated, options.publicBaseUrl);
      const reportState = exportUrl ? { ...generated, exportUrl } : generated;
      return {
        structuredContent: { reportState },
        content: [{ type: "text" as const, text: `Demo data for UI testing only.\n\n${claudeReportFallback(reportState)}` }],
        _meta: { ...RESULT_META, dataMode: "demo", reportMcpSurface: "local-demo" }
      };
    }
  );

  const decisionTools = [
    {
      name: "get_creative_performance_demo",
      title: "Preview creative performance",
      description: "Render a deterministic creative-performance evidence card for an explicit demo or UI test. It contains no AI analysis, never calls TikTok APIs, and must not be presented as live data.",
      inputSchema: getCreativePerformanceDemoInput,
      create: createCreativePerformanceDemo,
      experienceType: "creative_performance"
    },
    {
      name: "review_campaign_launch_demo",
      title: "Preview campaign launch review",
      description: "Render a deterministic pre-launch review card for an explicit demo or UI test. Confirmation is simulated and does not create TikTok Ads objects.",
      inputSchema: reviewCampaignLaunchDemoInput,
      create: createCampaignLaunchReviewDemo,
      experienceType: "campaign_launch_review"
    },
    {
      name: "review_campaign_update_demo",
      title: "Preview campaign update review",
      description: "Render a deterministic campaign budget-update review card for an explicit demo or UI test. Confirmation is simulated and does not modify TikTok Ads data.",
      inputSchema: reviewCampaignUpdateDemoInput,
      create: createCampaignUpdateReviewDemo,
      experienceType: "campaign_update_review"
    }
  ] as const;

  for (const tool of decisionTools) {
    registerAppTool(
      server,
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: decisionCardDemoOutput,
        _meta: TOOL_META,
        annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true }
      },
      async (input: Record<string, unknown>) => ({
        structuredContent: { decisionState: tool.create(input as never) },
        content: [{ type: "text" as const, text: `Show the ${tool.title.toLowerCase()} demo card. This is deterministic demo data.` }],
        _meta: { ...RESULT_META, dataMode: "demo", experienceType: tool.experienceType }
      })
    );
  }
}
