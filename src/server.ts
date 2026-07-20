import { createHash } from "node:crypto";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  CAMPAIGN_REVIEW_WIDGET_DESCRIPTION,
  registerCampaignReviewApp
} from "./campaign-review-app.js";
import { registerReportingApp } from "./reporting-app.js";
export { claudeReportFallback } from "./reporting-app.js";
import type { TikTokMcpAuthContext } from "./tiktok-mcp.js";

export type HostSurface = "chatgpt" | "claude" | "reporting" | "generic";

const DEFAULT_PUBLIC_BASE_URL = "https://tiktok-ads-agent-poc.onrender.com";
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || process.env.HOORAY_PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL
).replace(/\/$/, "");

const CAMPAIGN_REVIEW_INSTRUCTIONS =
  "Hooray TikTok Ads is the live human-approval boundary for creating exactly one TikTok Upgraded Smart+ Campaign through TikTok Ads Flat MCP. When a user asks to create, propose, recommend, or review one supported Campaign and enough Campaign-level information exists, MUST call review_smartplus_campaign instead of returning a free-form proposal. Handle three starting states: complete inputs go directly to review after validation; partial inputs preserve user-confirmed values and recommend only missing settings before calling the card; exploratory requests first receive a concise business-language interview about outcome, destination, advertiser account, and budget comfort. Resolve the advertiser from explicit user selection or the only authorized account; never invent an advertiser ID or App ID, and never infer special-ad-category confirmation. Put every model-proposed field, and no user-confirmed field, in aiSuggestedFields so the card labels it AI suggested. This experience is Campaign-level only: do not propose schedule, bid strategy, attribution, audience, placements, optimization event, or creative settings. Explain recommendation rationale in chat text after the card, never as TikTok official guidance. Show the review card before any write. Wait for the user to review or edit the card and select Confirm; only the card may call create_smartplus_campaign_from_review. Confirmation creates one Active Campaign and performs TikTok read-back. It never creates an Ad Group, Ad, creative, delivery, or spend. Unsupported objectives such as Reach, Video Views, Traffic, or Brand Awareness must not call the Smart+ review tool. This server contains no demo tools or legacy ad-creation workspace.";

const REPORTING_INSTRUCTIONS =
  "TikTok Ads Reporting provides Flat MCP performance reports and explicitly labeled deterministic UI previews. Use live reporting unless the user explicitly requests demo or QA data. Campaign Review remains a separate, human-approved live flow. Never present demo data or a demo receipt as a TikTok API result.";

function claudeAppDomain(mcpServerUrl: string) {
  const hash = createHash("sha256").update(mcpServerUrl).digest("hex").slice(0, 32);
  return `${hash}.claudemcpcontent.com`;
}

function endpointPath(hostSurface: HostSurface) {
  if (hostSurface === "claude") return "/mcp/claude";
  if (hostSurface === "reporting") return "/mcp/reporting";
  if (hostSurface === "chatgpt") return "/mcp/chatgpt";
  return "/mcp";
}

function appResourceMeta(hostSurface: HostSurface, description: string) {
  const domain = claudeAppDomain(`${PUBLIC_BASE_URL}${endpointPath(hostSurface)}`);
  return {
    ui: {
      prefersBorder: true,
      ...(hostSurface === "claude" ? { domain } : {}),
      csp: { connectDomains: [], resourceDomains: [] }
    },
    ...(hostSurface === "claude"
      ? {}
      : {
          "openai/widgetDescription": description,
          "openai/widgetPrefersBorder": true,
          "openai/widgetCSP": {
            connect_domains: [],
            resource_domains: [],
            redirect_domains: [PUBLIC_BASE_URL, "https://ads.tiktok.com", "https://business-api.tiktok.com"]
          }
        })
  };
}

export function createTikTokAdsPocServer(
  hostSurface: HostSurface = "generic",
  options: { tikTokAuthorization?: string } = {}
) {
  const reporting = hostSurface === "reporting";
  const server = new McpServer(
    {
      name: reporting ? "tiktok-ads-reporting" : "hooray-tiktok-campaign-review",
      version: "0.7.0"
    },
    { instructions: reporting ? REPORTING_INSTRUCTIONS : CAMPAIGN_REVIEW_INSTRUCTIONS }
  );

  const authContext: TikTokMcpAuthContext = {
    authorization: options.tikTokAuthorization,
    requireDelegatedAuthorization: hostSurface === "chatgpt"
  };

  registerCampaignReviewApp(server, {
    authContext,
    includeDemo: reporting,
    resourceMeta: appResourceMeta(hostSurface, CAMPAIGN_REVIEW_WIDGET_DESCRIPTION)
  });

  if (reporting) {
    registerReportingApp(server, {
      publicBaseUrl: PUBLIC_BASE_URL,
      resourceMeta: appResourceMeta(hostSurface, "Interactive TikTok Ads performance report")
    });
  }

  return server;
}
