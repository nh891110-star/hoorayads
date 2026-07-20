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
import {
  createCampaignReviewStore,
  getCampaignReviewStoreForProposal,
  getSharedCampaignReviewStore,
  registerCampaignReviewProposal
} from "./campaign-review.js";
import type { CampaignReviewState } from "./campaign-review.js";
import type { TikTokMcpAuthContext } from "./tiktok-mcp.js";

export const CAMPAIGN_REVIEW_WIDGET_URI = "ui://widget/tiktok-smartplus-campaign-review-v12.html";
const LEGACY_CAMPAIGN_REVIEW_WIDGET_URIS = [
  "ui://widget/tiktok-smartplus-campaign-review-v11.html",
  "ui://widget/tiktok-smartplus-campaign-review-v10.html",
  "ui://widget/tiktok-smartplus-campaign-review-v9.html",
  "ui://widget/tiktok-smartplus-campaign-review-v8.html",
  "ui://widget/tiktok-smartplus-campaign-review-v7.html",
  "ui://widget/tiktok-smartplus-campaign-review-v6.html",
  "ui://widget/tiktok-smartplus-campaign-review-v5.html",
  "ui://widget/tiktok-smartplus-campaign-review-v4.html",
  "ui://widget/tiktok-smartplus-campaign-review-v3.html",
  "ui://widget/tiktok-smartplus-campaign-review-v2.html"
] as const;
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
    ...(["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(objectiveValue)
      ? [`- Catalog: ${(verified?.catalogEnabled ?? state.campaign.catalogEnabled) ? verified?.catalogType || state.campaign.catalogType || "Used" : "Not used"}`]
      : []),
    `- Special ad category: ${verified?.specialIndustries !== undefined ? verified.specialIndustries.join(", ") || "None selected" : state.campaign.specialIndustriesConfirmed ? state.campaign.specialIndustries.join(", ") || "None selected" : "Not confirmed"}`,
    ...(state.execution?.campaignId ? [`- ${state.mode === "demo" ? "Demo receipt" : "Campaign ID"}: ${state.execution.campaignId}`] : []),
    ...(verified ? ["- Data source: TikTok Campaign read-back; fields omitted by TikTok remain proposal values."] : []),
    ...(state.validationErrors.length ? ["", `Review required: ${state.validationErrors.join(" ")}`] : []),
    "",
    state.mode === "demo"
      ? "Interaction demo only. Confirmation does not call TikTok APIs or create any TikTok object."
      : state.status === "created"
        ? "This campaign was submitted successfully. It cannot deliver or spend until an eligible Ad Group and Ad are added. We’ll guide you through those next steps. Fields returned by TikTok Campaign read-back are verified; omitted fields remain approved proposal values."
        : state.status === "outcome_unknown"
          ? "TikTok read-back is not verified. Check status before taking another action and do not submit this proposal again."
          : "After a successful submission, this campaign will be created in TikTok. It cannot deliver or spend until an eligible Ad Group and Ad are added. We’ll guide you through those next steps."
  ].join("\n");
}

function result(campaignReviewState: CampaignReviewState, message: string, rendersWidget = true) {
  return {
    structuredContent: { campaignReviewState },
    content: [{ type: "text" as const, text: `${message}\n\n${fallback(campaignReviewState)}` }],
    _meta: {
      ...(rendersWidget ? RESULT_META : {}),
      experienceType: "smartplus_campaign_review",
      dataMode: campaignReviewState.mode,
      campaignScope: "campaign_only",
      executionTool: campaignReviewState.mode === "demo" ? "none" : "smart_plus_campaign_create",
      mutationOccurred: campaignReviewState.mode === "live" && campaignReviewState.status === "created"
    }
  };
}

function registerResourceAt(
  server: McpServer,
  name: string,
  uri: string,
  resourceMeta: Record<string, unknown>
) {
  registerAppResource(
    server,
    name,
    uri,
    {
      title: "TikTok Smart+ Campaign Review",
      description: CAMPAIGN_REVIEW_WIDGET_DESCRIPTION,
      mimeType: RESOURCE_MIME_TYPE,
      _meta: resourceMeta
    },
    async () => ({
      contents: [{
        uri,
        mimeType: RESOURCE_MIME_TYPE,
        text: `<div id="campaign-review-root"></div>\n<style>${widgetCss}</style>\n<script type="module">${widgetJs}</script>`,
        _meta: resourceMeta
      }]
    })
  );
}

function registerResource(server: McpServer, resourceMeta: Record<string, unknown>) {
  registerResourceAt(
    server,
    "tiktok-smartplus-campaign-review-v12",
    CAMPAIGN_REVIEW_WIDGET_URI,
    resourceMeta
  );
  for (const legacyUri of LEGACY_CAMPAIGN_REVIEW_WIDGET_URIS) {
    const version = legacyUri.match(/-v(\d+)\.html$/)?.[1] || "legacy";
    registerResourceAt(
      server,
      `tiktok-smartplus-campaign-review-v${version}`,
      legacyUri,
      resourceMeta
    );
  }
}

function registerLiveTools(
  server: McpServer,
  store: ReturnType<typeof createCampaignReviewStore>,
  authContext: TikTokMcpAuthContext = {}
) {
  registerAppTool(
    server,
    "review_smartplus_campaign",
    {
      title: "Review Smart+ Campaign",
      description:
        "MUST call this tool instead of returning a free-form proposal whenever the user asks to create, propose, recommend, or review exactly one supported Smart+ Campaign and enough Campaign-level information exists. Support three starting states: (1) for complete user inputs, preserve confirmed values and do not include them in aiSuggestedFields; (2) for partial inputs, preserve confirmed values, propose only missing Campaign settings supported by conversation or retrieved business context, list every model-proposed field in aiSuggestedFields, and call this tool; (3) for an exploratory request, first ask a concise business-language interview about outcome, website/app/lead destination, advertiser account, and budget comfort, and do not call until enough information exists. specialIndustriesConfirmed is required and must be true: ask the user whether Housing, Employment, Credit, or none applies before calling; never infer the answer. Resolve the advertiser from explicit user selection or the only authorized account; never invent an advertiser ID or App ID. Submit only fields present in this tool schema. Catalog is available only for Website Conversions or Lead Generation in this experience; App Promotion uses App promotion type, optional App ID, and Campaign type instead. This is Campaign-level only: do not add industry, schedule, bid strategy, attribution, audience, placements, optimization event, or creative settings. Explain recommendation rationale in chat text after rendering the card. The card creates nothing until the user explicitly confirms.",
      inputSchema: reviewSmartPlusCampaignInput,
      outputSchema: reviewSmartPlusCampaignOutput,
      _meta: TOOL_META,
      annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false, idempotentHint: false }
    },
    async (input: CampaignReviewInput) => {
      const state = registerCampaignReviewProposal(store, await store.prepare(input));
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
    async ({ proposalId, expectedVersion, ...input }) => {
      const proposalStore = getCampaignReviewStoreForProposal(proposalId, store);
      const state = registerCampaignReviewProposal(
        proposalStore,
        proposalStore.revise(
          proposalId,
          expectedVersion,
          input as Omit<CampaignReviewInput, "advertiserId" | "advertiserName">
        )
      );
      return result(state, "Show the latest Campaign Review proposal version.", false);
    }
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
    async ({ proposalId, expectedVersion }) => {
      const proposalStore = getCampaignReviewStoreForProposal(proposalId, store);
      return result(
        await proposalStore.getStatus(proposalId, expectedVersion, authContext),
        "Refresh the existing Campaign Review state.",
        false
      );
    }
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
      const proposalStore = getCampaignReviewStoreForProposal(proposalId, store);
      const state = await proposalStore.create(proposalId, expectedVersion, authContext);
      return result(state, state.status === "created"
        ? "Show the verified Campaign creation receipt."
        : "Show the current Campaign creation status without retrying the write.", false);
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
      "Show the latest interaction-demo proposal version.",
      false
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
      "Refresh the interaction-demo Campaign Review state.",
      false
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
      "Show the simulated Campaign submission state.",
      false
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
  registerLiveTools(
    server,
    getSharedCampaignReviewStore(options.authContext, "flat"),
    options.authContext
  );
  if (options.includeDemo) {
    registerDemoTools(server, createCampaignReviewStore({ mode: "demo" }));
  }
}
