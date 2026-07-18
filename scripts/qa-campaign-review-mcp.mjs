import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema, ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";

const endpoint = process.env.MCP_ENDPOINT || "http://localhost:3010/mcp/reporting";
const resourceUri = "ui://widget/tiktok-smartplus-campaign-review-v2.html";

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
const transport = new StreamableHTTPClientTransport(new URL(endpoint));
await client.connect(transport);

try {
  const tools = await client.listTools();
  assert(!tools.tools.some((tool) => tool.name === "open_tiktok_ads_workspace"), "Reporting endpoint leaked the Hooray workspace tool.");
  const reviewTool = tools.tools.find((tool) => tool.name === "review_smartplus_campaign");
  const reviseTool = tools.tools.find((tool) => tool.name === "revise_smartplus_campaign_review");
  const statusTool = tools.tools.find((tool) => tool.name === "get_smartplus_campaign_review_status");
  const createTool = tools.tools.find((tool) => tool.name === "create_smartplus_campaign_from_review");
  assert(reviewTool && reviseTool && statusTool && createTool, "One or more Campaign Review tools are missing.");
  assert(reviewTool._meta?.ui?.resourceUri === resourceUri, "Review tool has the wrong resource URI.");
  assert(createTool.annotations?.destructiveHint === true, "Real Campaign creation must be marked destructive.");
  assert(createTool.annotations?.idempotentHint === true, "Campaign creation must declare idempotency.");
  assert(statusTool.annotations?.readOnlyHint === true, "Status tool must be read-only.");
  const objectives = reviewTool.inputSchema?.properties?.objectiveType?.enum || [];
  assert(objectives.includes("WEB_CONVERSIONS") && objectives.includes("LEAD_GENERATION") && objectives.includes("APP_PROMOTION"), "Supported Smart+ objectives are incomplete.");
  assert(!objectives.includes("REACH") && !objectives.includes("VIDEO_VIEWS"), "Brand objectives leaked into the Smart+ review tool.");

  const hoorayClient = new Client({ name: "qa-campaign-review-isolation", version: "1.0.0" }, { capabilities: {} });
  const hoorayTransport = new StreamableHTTPClientTransport(new URL(endpoint.replace(/\/mcp\/reporting$/, "/mcp/chatgpt")));
  await hoorayClient.connect(hoorayTransport);
  try {
    const hoorayTools = await hoorayClient.listTools();
    assert(hoorayTools.tools.some((tool) => tool.name === "open_tiktok_ads_workspace"), "Hooray endpoint lost its workspace tool.");
    assert(!hoorayTools.tools.some((tool) => tool.name === "review_smartplus_campaign"), "Campaign Review leaked into the Hooray endpoint.");
  } finally {
    await hoorayTransport.close();
  }

  const resource = await client.request(
    { method: "resources/read", params: { uri: resourceUri } },
    ReadResourceResultSchema
  );
  const html = resource.contents[0]?.text || "";
  assert(resource.contents[0]?.mimeType === "text/html;profile=mcp-app", "Campaign Review resource has the wrong MIME type.");
  assert(html.includes('id="campaign-review-root"'), "Campaign Review root is missing.");
  assert(html.includes("Confirm"), "Campaign Review confirm CTA is missing.");
  assert(html.includes("Status after creation"), "Campaign Review status disclosure is missing.");

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
    console.log(JSON.stringify({
      ok: true,
      liveGate: proposedState.execution.errorCode,
      checked: ["reporting_endpoint_isolation", "tools_list", "resource", "live_config_or_oauth_gate", "brand_negative_schema"]
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
      checked: ["tools_list", "resource", "live_account_resolution", "proposed", "revision_cas", "outdated_version", "brand_negative_schema"]
    }, null, 2));
  }
} finally {
  await transport.close();
}
