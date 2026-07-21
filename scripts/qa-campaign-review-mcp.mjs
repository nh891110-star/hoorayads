import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";

const endpoint = process.env.MCP_ENDPOINT || "http://localhost:3010/mcp/chatgpt";
const resourceUri = "ui://widget/tiktok-smartplus-campaign-review-v19.html";
const legacyResourceUris = [
  "ui://widget/tiktok-smartplus-campaign-review-v18.html",
  "ui://widget/tiktok-smartplus-campaign-review-v17.html",
  "ui://widget/tiktok-smartplus-campaign-review-v16.html",
  "ui://widget/tiktok-smartplus-campaign-review-v15.html",
  "ui://widget/tiktok-smartplus-campaign-review-v14.html",
  "ui://widget/tiktok-smartplus-campaign-review-v13.html",
  "ui://widget/tiktok-smartplus-campaign-review-v12.html",
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
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const client = new Client(
  { name: "qa-campaign-review-mcp", version: "1.0.0" },
  {
    capabilities: {
      extensions: {
        "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] }
      }
    }
  }
);
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: {
    headers: { Authorization: `Bearer ${process.env.MCP_TEST_BEARER || "qa-delegated-token"}` }
  }
});
await client.connect(transport);

try {
  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  assert(!toolNames.includes("open_tiktok_ads_workspace"), "Hooray still exposes the legacy workspace entry tool.");
  assert(!toolNames.includes("get_ads_report"), "Hooray still exposes the legacy reporting tool.");
  assert(!toolNames.includes("review_campaign_launch_demo"), "Hooray still exposes the legacy launch demo.");
  assert(!toolNames.includes("review_smartplus_campaign_demo"), "Hooray must not expose demo Campaign Review tools.");
  assert(!toolNames.includes("create_smartplus_campaign"), "Hooray still exposes the old full-funnel creation tool.");
  const reviewTool = tools.tools.find((tool) => tool.name === "review_smartplus_campaign");
  const reviseTool = tools.tools.find((tool) => tool.name === "revise_smartplus_campaign_review");
  const statusTool = tools.tools.find((tool) => tool.name === "get_smartplus_campaign_review_status");
  const createTool = tools.tools.find((tool) => tool.name === "create_smartplus_campaign_from_review");
  const chatApprovalTool = tools.tools.find((tool) => tool.name === "approve_smartplus_campaign_review_from_chat");
  assert(reviewTool && reviseTool && statusTool && createTool && chatApprovalTool, "One or more Campaign Review tools are missing.");
  assert(reviewTool._meta?.ui?.resourceUri === resourceUri, "Review tool has the wrong resource URI.");
  for (const appTool of [reviseTool, statusTool, createTool]) {
    assert(appTool._meta?.ui?.visibility?.length === 1 && appTool._meta.ui.visibility[0] === "app", `${appTool.name} must remain app-only.`);
    assert(appTool._meta?.ui?.resourceUri === resourceUri, `${appTool.name} must stay associated with the Campaign Review app resource.`);
    assert(!appTool._meta?.["openai/outputTemplate"], `${appTool.name} must not declare an output template.`);
  }
  assert(!chatApprovalTool._meta?.ui?.resourceUri, "Chat approval must not render a duplicate Campaign Review card.");
  assert(!chatApprovalTool._meta?.["openai/outputTemplate"], "Chat approval must not declare an output template.");
  assert(!chatApprovalTool.outputSchema, "Chat approval must not return Campaign Review structured content that can trigger a duplicate widget.");
  assert(reviewTool.description?.includes("three starting states"), "Review tool lost the BRD complete/partial/exploratory routing guidance.");
  assert(reviewTool.description?.includes("aiSuggestedFields"), "Review tool lost model-suggested field provenance guidance.");
  assert(reviewTool.description?.includes("exploratory request"), "Review tool lost the exploratory business-interview behavior.");
  assert(reviewTool.description?.includes("MUST call this tool"), "Review tool no longer prevents free-form proposals when the card should render.");
  assert(reviewTool.description?.includes("Campaign-level only"), "Review tool lost the Campaign-only field boundary.");
  assert(createTool.annotations?.destructiveHint === true, "Real Campaign creation must be marked destructive.");
  assert(createTool.annotations?.idempotentHint === true, "Campaign creation must declare idempotency.");
  assert(chatApprovalTool.annotations?.destructiveHint === true, "Chat approval must be marked destructive.");
  assert(chatApprovalTool.annotations?.idempotentHint === true, "Chat approval must declare idempotency.");
  assert(chatApprovalTool.description?.includes("unambiguous later user instruction"), "Chat approval lost explicit prompt-routing guidance.");
  assert(chatApprovalTool.description?.includes("never modify and create in one step"), "Chat approval lost the review-before-write guard for prompt edits.");
  assert(chatApprovalTool.description?.includes("without rendering a duplicate card"), "Chat approval lost the single-card rendering requirement.");
  assert(statusTool.annotations?.readOnlyHint === true, "Status tool must be read-only.");
  const objectives = reviewTool.inputSchema?.properties?.objectiveType?.enum || [];
  assert(objectives.includes("WEB_CONVERSIONS") && objectives.includes("LEAD_GENERATION") && objectives.includes("APP_PROMOTION"), "Supported Smart+ objectives are incomplete.");
  assert(!objectives.includes("REACH") && !objectives.includes("VIDEO_VIEWS"), "Brand objectives leaked into the Smart+ review tool.");

  const reportingClient = new Client({ name: "qa-reporting-isolation", version: "1.0.0" }, { capabilities: {} });
  const reportingEndpoint = endpoint.replace(/\/mcp\/chatgpt$/, "/mcp/reporting");
  const reportingTransport = new StreamableHTTPClientTransport(new URL(reportingEndpoint));
  await reportingClient.connect(reportingTransport);
  try {
    const reportingTools = await reportingClient.listTools();
    assert(reportingTools.tools.some((tool) => tool.name === "get_ads_report"), "Reporting endpoint lost its live report tool.");
    assert(reportingTools.tools.some((tool) => tool.name === "review_smartplus_campaign_demo"), "Reporting endpoint lost its interaction demo.");
    assert(
      !reportingTools.tools.some((tool) => tool.name === "open_tiktok_ads_workspace"),
      "Reporting endpoint leaked the retired Hooray workspace."
    );
    const firstDemoProposal = await reportingClient.request(
      {
        method: "tools/call",
        params: {
          name: "review_smartplus_campaign_demo",
          arguments: {
            advertiserName: "Education Coaching0315",
            campaignName: "MCP UI QA - First Demo Proposal",
            objectiveType: "WEB_CONVERSIONS",
            budget: 50,
            budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
            budgetOptimizeOn: true,
            salesDestination: "WEBSITE",
            catalogEnabled: false,
            specialIndustries: [],
            specialIndustriesConfirmed: true
          }
        }
      },
      CallToolResultSchema
    );
    await reportingClient.request(
      {
        method: "tools/call",
        params: {
          name: "review_smartplus_campaign_demo",
          arguments: {
            advertiserName: "Education Coaching0315",
            campaignName: "MCP UI QA - Second Demo Proposal",
            objectiveType: "LEAD_GENERATION",
            budget: 60,
            budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
            budgetOptimizeOn: true,
            catalogEnabled: false,
            specialIndustries: [],
            specialIndustriesConfirmed: true
          }
        }
      },
      CallToolResultSchema
    );
    const firstDemoState = firstDemoProposal.structuredContent?.campaignReviewState;
    const refreshedFirstDemo = await reportingClient.request(
      {
        method: "tools/call",
        params: {
          name: "get_smartplus_campaign_review_demo_status",
          arguments: {
            proposalId: firstDemoState?.proposalId,
            expectedVersion: firstDemoState?.version
          }
        }
      },
      CallToolResultSchema
    );
    assert(refreshedFirstDemo.structuredContent?.campaignReviewState?.status === "outdated", "A prior proposal did not become Inactive after a new proposal was prepared.");
  } finally {
    await reportingTransport.close();
  }

  const resource = await client.request(
    { method: "resources/read", params: { uri: resourceUri } },
    ReadResourceResultSchema
  );
  const html = resource.contents[0]?.text || "";
  assert(resource.contents[0]?.mimeType === "text/html;profile=mcp-app", "Campaign Review resource has the wrong MIME type.");
  assert(html.includes('id="campaign-review-root"'), "Campaign Review root is missing.");
  assert(html.includes("Confirm"), "Campaign Review confirm CTA is missing.");
  assert(html.includes("Submitting…"), "Campaign Review does not provide immediate Confirm progress feedback.");
  assert(
    html.indexOf("if (window.openai?.callTool)") < html.indexOf('if (initialized) return rpc("tools/call"'),
    "ChatGPT native callTool must be preferred over the standard MCP Apps bridge."
  );
  assert(html.includes("AI suggested"), "Campaign Review is missing the model-suggestion source label.");
  assert(!html.includes("Status after creation"), "Campaign Review must not show a pre-creation status field.");
  assert(html.includes("After a successful submission"), "Campaign Review next-step disclosure is missing.");
  assert(html.includes("TikTok verified"), "Campaign Review is missing per-field TikTok read-back provenance.");
  assert(html.includes("TikTok Campaign read-back"), "Campaign Review success receipt is missing its TikTok read-back source.");

  for (const legacyResourceUri of legacyResourceUris) {
    const legacyResource = await client.request(
      { method: "resources/read", params: { uri: legacyResourceUri } },
      ReadResourceResultSchema
    );
    assert(legacyResource.contents[0]?.mimeType === "text/html;profile=mcp-app", `Legacy Campaign Review resource ${legacyResourceUri} has the wrong MIME type.`);
    assert((legacyResource.contents[0]?.text || "").includes("TikTok Campaign read-back"), `Legacy Campaign Review resource ${legacyResourceUri} is not compatible with the current widget.`);
  }

  const proposed = await client.request(
    {
      method: "tools/call",
      params: {
        name: "review_smartplus_campaign",
        arguments: {
          advertiserName: "Education Coaching0315",
          campaignName: "MCP UI QA - Contract Review",
          objectiveType: "WEB_CONVERSIONS",
          budget: 50,
          budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
          budgetOptimizeOn: true,
          salesDestination: "WEBSITE",
          catalogEnabled: false,
          specialIndustries: [],
          specialIndustriesConfirmed: true,
          aiSuggestedFields: ["budget"]
        }
      }
    },
    CallToolResultSchema
  );
  const proposedState = proposed.structuredContent?.campaignReviewState;
  if (
    proposedState?.status === "error" &&
    ["TIKTOK_AUTH_REQUIRED", "TIKTOK_MCP_MISCONFIGURED"].includes(proposedState?.execution?.errorCode)
  ) {
    assert(proposedState.campaign.campaignName === "MCP UI QA - Contract Review", "OAuth error state lost the proposed Campaign name.");
    assert(proposedState.campaign.budget === 50, "OAuth error state lost the proposed Campaign budget.");
    assert(proposedState.campaign.salesDestination === "WEBSITE", "OAuth error state lost the proposed sales destination.");
    assert(proposedState.campaign.specialIndustriesConfirmed === true, "OAuth error state lost the special ad category confirmation.");
    assert(proposedState.account.advertiserName === "Education Coaching0315", "OAuth error state lost the requested advertiser name.");
    console.log(JSON.stringify({
      ok: true,
      liveGate: proposedState.execution.errorCode,
      checked: ["hooray_endpoint_replacement", "reporting_endpoint_isolation", "tools_list", "resource", "single_active_proposal", "flat_oauth_gate", "oauth_error_input_preservation", "brand_negative_schema"]
    }, null, 2));
    process.exitCode = 0;
  } else {
    assert(proposedState?.status === "proposed", `Expected proposed state, got ${JSON.stringify(proposedState)}.`);
    assert(proposedState?.account?.advertiserName === "Education Coaching0315", "Authorized advertiser was not resolved from TikTok.");
    assert(proposedState?.campaign?.operationStatus === "ENABLE", "Review card must disclose Active creation status.");
    assert(proposedState?.readyToCreate === true, `Proposal is unexpectedly blocked: ${(proposedState?.validationErrors || []).join(" ")}`);

    const revised = await client.request(
    {
      method: "tools/call",
      params: {
        name: "revise_smartplus_campaign_review",
        arguments: {
          proposalId: proposedState.proposalId,
          expectedVersion: proposedState.version,
          campaignName: "MCP UI QA - Contract Review Lead",
          objectiveType: "LEAD_GENERATION",
          budget: 60,
          budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
          budgetOptimizeOn: true,
          catalogEnabled: false,
          specialIndustries: [],
          specialIndustriesConfirmed: true,
          aiSuggestedFields: []
        }
      }
    },
    CallToolResultSchema
  );
    const revisedState = revised.structuredContent?.campaignReviewState;
    assert(revisedState?.version === 2 && revisedState?.campaign?.objectiveType === "LEAD_GENERATION", "Revision did not create version 2.");

    const oldStatus = await client.request(
    {
      method: "tools/call",
      params: {
        name: "get_smartplus_campaign_review_status",
        arguments: { proposalId: proposedState.proposalId, expectedVersion: 1 }
      }
    },
    CallToolResultSchema
  );
    assert(oldStatus.structuredContent?.campaignReviewState?.status === "outdated", "The previous card was not invalidated on the server.");

    console.log(JSON.stringify({
      ok: true,
      auth: "connected",
      checked: ["hooray_endpoint_replacement", "reporting_endpoint_isolation", "tools_list", "resource", "single_active_proposal", "flat_live_account_resolution", "proposed", "revision_cas", "outdated_version", "brand_negative_schema"]
    }, null, 2));
  }
} finally {
  await transport.close();
}
