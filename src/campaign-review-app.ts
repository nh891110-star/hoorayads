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
  createSmartPlusCampaignFromReviewInput,
  createSmartPlusCampaignFromReviewOutput,
  getSmartPlusCampaignReviewStatusInput,
  getSmartPlusCampaignReviewStatusOutput,
  reviewSmartPlusCampaignDemoInput,
  reviewSmartPlusCampaignDemoOutput,
  reviewSmartPlusCampaignInput,
  reviewSmartPlusCampaignOutput,
  reviseSmartPlusCampaignReviewInput,
  reviseSmartPlusCampaignReviewOutput
} from "./campaign-review-contract.js";
import type { CampaignReviewDemoInput, CampaignReviewInput } from "./campaign-review-contract.js";
import { createCampaignReviewStore } from "./campaign-review.js";
import type { CampaignReviewState } from "./campaign-review.js";
import type { TikTokMcpAuthContext } from "./tiktok-mcp.js";

export const CAMPAIGN_REVIEW_WIDGET_URI = "ui://widget/tiktok-smartplus-campaign-review-v2.html";
export const CAMPAIGN_REVIEW_WIDGET_DESCRIPTION =
  "Interactive Campaign-level review and approval card for one TikTok Upgraded Smart+ Campaign. Live confirmation creates one Active Campaign only. It never creates an Ad Group, Ad, creative, delivery, or spend.";

const currentDir = dirname(fileURLToPath(import.meta.url));
const widgetJs = readFileSync(join(currentDir, "../web/campaign-review-widget.js"), "utf8");
const widgetCss = readFileSync(join(currentDir, "../web/campaign-review-widget.css"), "utf8");

const TOOL_META = {
  ui: { resourceUri: CAMPAIGN_REVIEW_WIDGET_URI, visibility: ["model", "app"] },
  "openai/outputTemplate": CAMPAIGN_REVIEW_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Preparing Campaign Review...",
  "openai/toolInvocation/invoked": "Campaign Review ready."
} as const;

const APP_TOOL_META = {
  ui: { resourceUri: CAMPAIGN_REVIEW_WIDGET_URI, visibility: ["app"] },
  "openai/outputTemplate": CAMPAIGN_REVIEW_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Updating Campaign Review...",
  "openai/toolInvocation/invoked": "Campaign Review updated."
} as const;

const RESULT_META = {
  [RESOURCE_URI_META_KEY]: CAMPAIGN_REVIEW_WIDGET_URI,
  ui: { resourceUri: CAMPAIGN_REVIEW_WIDGET_URI },
  "openai/outputTemplate": CAMPAIGN_REVIEW_WIDGET_URI
} as const;

function fallback(state: CampaignReviewState) {
  const verified = state.status === "created" ? state.execution?.verifiedCampaign : undefined;
  const campaignName = verified?.campaignName ?? state.campaign.campaignName;
  const objectiveValue = verified?.objectiveType ?? state.campaign.objectiveType;
  const objective = ({
    WEB_CONVERSIONS: "Website conversions",
    LEAD_GENERATION: "Lead generation",
    APP_PROMOTION: "App promotion"
  } as Record<string, string>)[objectiveValue] || objectiveValue;
  const budgetMode = verified?.budgetMode ?? state.campaign.budgetMode;
  const budgetValue = verified?.budget ?? state.campaign.budget;
  const daily = budgetMode.includes("DAILY") || budgetMode === "BUDGET_MODE_DAY";
  const budget = budgetValue === undefined
    ? "Not set"
    : `${state.account.currency} ${budgetValue.toFixed(2)}${daily ? "/day" : " total"}`;
  const status = {
    proposed: "Proposed campaign",
    outdated: "Inactive proposal",
    creating: "Creating campaign",
    checking: "Checking creation status",
    created: "Submitted successfully",
    error: "Needs attention",
    outcome_unknown: "Creation status unconfirmed"
  }[state.status];
  const accountLabel = state.account.status === "UNKNOWN"
    ? `Requested advertiser: ${state.account.advertiserName}`
    : `${state.account.advertiserName} · ${state.account.maskedAdvertiserId}`;

  return [
    `### ${campaignName}`,
    "",
    `**${status}** · ${accountLabel}`,
    "",
    `- Campaign objective: ${objective}`,
    `- Campaign budget: ${budget}`,
    `- Campaign Budget Optimization: ${(verified?.budgetOptimizeOn ?? state.campaign.budgetOptimizeOn) ? "On" : "Off"}`,
    `- Catalog: ${(verified?.catalogEnabled ?? state.campaign.catalogEnabled) ? verified?.catalogType || state.campaign.catalogType || "Used" : "Not used"}`,
    `- Special ad category: ${verified?.specialIndustries !== undefined ? verified.specialIndustries.join(", ") || "None selected" : state.campaign.specialIndustriesConfirmed ? state.campaign.specialIndustries.join(", ") || "None selected" : "Not confirmed"}`,
    `- Status after creation: ${state.status === "outcome_unknown" ? "Unconfirmed" : "Active"}`,
    ...(state.execution?.campaignId ? [`- ${state.mode === "demo" ? "Demo receipt" : "Campaign ID"}: ${state.execution.campaignId}`] : []),
    ...(verified ? ["- Data source: TikTok Campaign read-back; fields omitted by TikTok remain proposal values."] : []),
    ...(state.validationErrors.length ? ["", `Review required: ${state.validationErrors.join(" ")}`] : []),
    "",
    state.mode === "demo"
      ? "Interaction demo only. Confirmation does not call TikTok APIs or create any TikTok object."
      : "This review creates one Active Campaign only. It does not create Ad Groups, Ads, creatives, delivery, or spend."
  ].join("\n");
}

function result(campaignReviewState: CampaignReviewState, message: string) {
  return {
    structuredContent: { campaignReviewState },
    content: [{ type: "text" as const, text: `${message}\n\n${fallback(campaignReviewState)}` }],
    _meta: {
      ...RESULT_META,
      experienceType: "smartplus_campaign_review",
      dataMode: campaignReviewState.mode,
      campaignScope: "campaign_only",
      executionTool: campaignReviewState.mode === "demo" ? "none" : "smart_plus_campaign_create",
      mutationOccurred: campaignReviewState.mode === "live" && campaignReviewState.status === "created"
    }
  };
}

function registerResource(server: McpServer, resourceMeta: Record<string, unknown>) {
  registerAppResource(
    server,
    "tiktok-smartplus-campaign-review-v2",
    CAMPAIGN_REVIEW_WIDGET_URI,
    {
      title: "TikTok Smart+ Campaign Review",
      description: CAMPAIGN_REVIEW_WIDGET_DESCRIPTION,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: resourceMeta
    },
    async () => ({
      contents: [{
        uri: CAMPAIGN_REVIEW_WIDGET_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: `<div id="campaign-review-root"></div>\n<style>${widgetCss}</style>\n<script type="module">${widgetJs}</script>`,
        _meta: resourceMeta
      }]
    })
  );
}

function registerLiveTools(server: McpServer, store: ReturnType<typeof createCampaignReviewStore>) {
  registerAppTool(
    server,
    "review_smartplus_campaign",
    {
      title: "Review Smart+ Campaign",
      description:
        "Prepare the human-review card for exactly one TikTok Upgraded Smart+ Campaign through TikTok Ads Flat MCP. Use only after the conversation contains enough Campaign-level information for WEB_CONVERSIONS, LEAD_GENERATION, or APP_PROMOTION and before any create call. Resolve the advertiser from the user's explicit selection or the only authorized account; never invent an advertiser ID. Pass model-selected fields in aiSuggestedFields. The card creates nothing until the user explicitly confirms.",
      inputSchema: reviewSmartPlusCampaignInput,
      outputSchema: reviewSmartPlusCampaignOutput,
      _meta: TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false, idempotentHint: false }
    },
    async (input: CampaignReviewInput) => {
      const state = await store.prepare(input);
      return result(state, state.status === "error"
        ? "Show the Campaign Review connection or validation state."
        : "Show the Campaign Review card and wait for the user's action.");
    }
  );

  registerAppTool(
    server,
    "revise_smartplus_campaign_review",
    {
      title: "Apply Campaign Review changes",
      description:
        "App-only action that applies edits and creates a new immutable proposal version. It changes review state only and does not create or update TikTok Ads objects.",
      inputSchema: reviseSmartPlusCampaignReviewInput,
      outputSchema: reviseSmartPlusCampaignReviewOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ proposalId, expectedVersion, ...input }) => result(
      store.revise(proposalId, expectedVersion, input as Omit<CampaignReviewInput, "advertiserId" | "advertiserName">),
      "Show the latest Campaign Review proposal version."
    )
  );

  registerAppTool(
    server,
    "get_smartplus_campaign_review_status",
    {
      title: "Check Campaign Review status",
      description:
        "App-only read that marks older cards Inactive and reconciles an unconfirmed creation outcome. It never retries campaign creation.",
      inputSchema: getSmartPlusCampaignReviewStatusInput,
      outputSchema: getSmartPlusCampaignReviewStatusOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ proposalId, expectedVersion }) => result(
      await store.getStatus(proposalId, expectedVersion),
      "Refresh the existing Campaign Review state."
    )
  );

  registerAppTool(
    server,
    "create_smartplus_campaign_from_review",
    {
      title: "Create approved Smart+ Campaign",
      description:
        "App-only destructive action that creates exactly one Active TikTok Upgraded Smart+ Campaign from the latest server-owned proposal after the user selects Confirm. It rechecks the current user's advertiser authorization, uses an idempotent request ID, and performs TikTok read-back. It never creates an Ad Group, Ad, creative, delivery, or spend.",
      inputSchema: createSmartPlusCampaignFromReviewInput,
      outputSchema: createSmartPlusCampaignFromReviewOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: true, idempotentHint: true }
    },
    async ({ proposalId, expectedVersion }) => {
      const state = await store.create(proposalId, expectedVersion);
      return result(state, state.status === "created"
        ? "Show the verified Campaign creation receipt."
        : "Show the current Campaign creation status without retrying the write.");
    }
  );
}

function registerDemoTools(server: McpServer, store: ReturnType<typeof createCampaignReviewStore>) {
  registerAppTool(
    server,
    "review_smartplus_campaign_demo",
    {
      title: "Preview Smart+ Campaign Review",
      description:
        "Render an OAuth-free interaction demo of the Campaign-level Smart+ review card. Use only for an explicit demo, preview, QA, or simulation request. Edit, stale-version, Confirm, success, and error states work, but no TikTok API is called and no object is created.",
      inputSchema: reviewSmartPlusCampaignDemoInput,
      outputSchema: reviewSmartPlusCampaignDemoOutput,
      _meta: TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: false }
    },
    async (input: CampaignReviewDemoInput) => result(
      await store.prepare(input),
      "Show the Campaign Review interaction demo. This demo does not write to TikTok."
    )
  );

  registerAppTool(
    server,
    "revise_smartplus_campaign_review_demo",
    {
      title: "Apply demo Campaign Review changes",
      description: "App-only action that creates a new demo proposal version without calling TikTok APIs.",
      inputSchema: reviseSmartPlusCampaignReviewInput,
      outputSchema: reviseSmartPlusCampaignReviewOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ proposalId, expectedVersion, ...input }) => result(
      store.revise(proposalId, expectedVersion, input as Omit<CampaignReviewInput, "advertiserId" | "advertiserName">),
      "Show the latest interaction-demo proposal version."
    )
  );

  registerAppTool(
    server,
    "get_smartplus_campaign_review_demo_status",
    {
      title: "Check demo Campaign Review status",
      description: "App-only read that marks stale demo cards Inactive and advances a simulated submission.",
      inputSchema: getSmartPlusCampaignReviewStatusInput,
      outputSchema: getSmartPlusCampaignReviewStatusOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ proposalId, expectedVersion }) => result(
      await store.getStatus(proposalId, expectedVersion),
      "Refresh the interaction-demo Campaign Review state."
    )
  );

  registerAppTool(
    server,
    "submit_smartplus_campaign_review_demo",
    {
      title: "Simulate approved Smart+ Campaign submission",
      description: "App-only simulated submission. It never calls TikTok APIs or creates any object.",
      inputSchema: createSmartPlusCampaignFromReviewInput,
      outputSchema: createSmartPlusCampaignFromReviewOutput,
      _meta: APP_TOOL_META,
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true }
    },
    async ({ proposalId, expectedVersion }) => result(
      await store.create(proposalId, expectedVersion),
      "Show the simulated Campaign submission state."
    )
  );
}

export function registerCampaignReviewApp(
  server: McpServer,
  options: {
    authContext?: TikTokMcpAuthContext;
    includeDemo?: boolean;
    resourceMeta: Record<string, unknown>;
  }
) {
  registerResource(server, options.resourceMeta);
  registerLiveTools(server, createCampaignReviewStore({ authContext: options.authContext, surface: "flat" }));
  if (options.includeDemo) {
    registerDemoTools(server, createCampaignReviewStore({ mode: "demo" }));
  }
}
