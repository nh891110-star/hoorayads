import { setTimeout as wait } from "node:timers/promises";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

const endpoint = process.env.MCP_ENDPOINT || "http://localhost:3010/mcp/reporting";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const client = new Client({ name: "qa-campaign-review-demo", version: "1.0.0" }, { capabilities: {} });
const transport = new StreamableHTTPClientTransport(new URL(endpoint));
await client.connect(transport);

async function call(name, args) {
  return client.request({ method: "tools/call", params: { name, arguments: args } }, CallToolResultSchema);
}

const base = {
  advertiserName: "Education Coaching0315",
  budget: 50,
  budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
  budgetOptimizeOn: true,
  catalogEnabled: false,
  specialIndustries: [],
  specialIndustriesConfirmed: true,
  aiSuggestedFields: ["budget"]
};

try {
  const tools = await client.listTools();
  const names = new Set(tools.tools.map((tool) => tool.name));
  for (const name of [
    "review_smartplus_campaign_demo",
    "revise_smartplus_campaign_review_demo",
    "get_smartplus_campaign_review_demo_status",
    "submit_smartplus_campaign_review_demo"
  ]) {
    assert(names.has(name), `${name} is missing.`);
  }
  const submitTool = tools.tools.find((tool) => tool.name === "submit_smartplus_campaign_review_demo");
  assert(submitTool?.annotations?.destructiveHint === false, "Demo submission must be non-destructive.");
  const reviewTool = tools.tools.find((tool) => tool.name === "review_smartplus_campaign_demo");
  const objectives = reviewTool?.inputSchema?.properties?.objectiveType?.enum || [];
  assert(objectives.join(",") === "WEB_CONVERSIONS,LEAD_GENERATION,APP_PROMOTION", "Demo objectives differ from Smart+ create support.");

  const web = await call("review_smartplus_campaign_demo", {
    ...base,
    campaignName: "Demo QA - Web conversions",
    objectiveType: "WEB_CONVERSIONS",
    salesDestination: "WEBSITE"
  });
  const webState = web.structuredContent?.campaignReviewState;
  assert(webState?.mode === "demo" && webState?.status === "proposed", "Website demo did not return a proposed demo state.");
  assert(webState?.actionTools?.submit === "submit_smartplus_campaign_review_demo", "Demo action routing is wrong.");
  assert(webState?.campaign?.objectiveType === "WEB_CONVERSIONS", "Website objective was not preserved.");

  const revised = await call("revise_smartplus_campaign_review_demo", {
    proposalId: webState.proposalId,
    expectedVersion: webState.version,
    campaignName: "Demo QA - Lead generation",
    objectiveType: "LEAD_GENERATION",
    budget: 75,
    budgetMode: "BUDGET_MODE_TOTAL",
    budgetOptimizeOn: true,
    catalogEnabled: false,
    specialIndustries: [],
    specialIndustriesConfirmed: true,
    aiSuggestedFields: []
  });
  const revisedState = revised.structuredContent?.campaignReviewState;
  assert(revisedState?.version === 2 && revisedState?.campaign?.objectiveType === "LEAD_GENERATION", "Lead revision failed.");
  const stale = await call("get_smartplus_campaign_review_demo_status", {
    proposalId: webState.proposalId,
    expectedVersion: 1
  });
  assert(stale.structuredContent?.campaignReviewState?.status === "outdated", "Old demo proposal was not invalidated.");

  const submitting = await call("submit_smartplus_campaign_review_demo", {
    proposalId: revisedState.proposalId,
    expectedVersion: revisedState.version,
    confirmed: true
  });
  assert(submitting.structuredContent?.campaignReviewState?.status === "creating", "Demo did not expose the submitting state.");
  const duplicateWhileSubmitting = await call("submit_smartplus_campaign_review_demo", {
    proposalId: revisedState.proposalId,
    expectedVersion: revisedState.version,
    confirmed: true
  });
  assert(duplicateWhileSubmitting.structuredContent?.campaignReviewState?.status === "creating", "A duplicate submission must reuse the in-flight operation.");
  await wait(1000);
  const completed = await call("get_smartplus_campaign_review_demo_status", {
    proposalId: revisedState.proposalId,
    expectedVersion: revisedState.version
  });
  const completedState = completed.structuredContent?.campaignReviewState;
  assert(completedState?.status === "created", "Demo submission did not complete.");
  assert(completedState?.execution?.campaignId?.startsWith("demo-"), "Demo receipt resembles a real TikTok Campaign ID.");
  assert(completed._meta?.mutationOccurred === false, "Demo result incorrectly claims a TikTok mutation.");
  const duplicateAfterCompletion = await call("submit_smartplus_campaign_review_demo", {
    proposalId: revisedState.proposalId,
    expectedVersion: revisedState.version,
    confirmed: true
  });
  assert(
    duplicateAfterCompletion.structuredContent?.campaignReviewState?.execution?.campaignId === completedState.execution.campaignId,
    "A duplicate approval after completion must return the original receipt."
  );

  const app = await call("review_smartplus_campaign_demo", {
    ...base,
    campaignName: "Demo QA - App install",
    objectiveType: "APP_PROMOTION",
    appPromotionType: "APP_INSTALL",
    appId: "1234567890123456789",
    campaignType: "REGULAR_CAMPAIGN"
  });
  const appState = app.structuredContent?.campaignReviewState;
  assert(appState?.campaign?.objectiveType === "APP_PROMOTION" && appState?.readyToCreate === true, "App Promotion demo is not ready.");

  const failed = await call("review_smartplus_campaign_demo", {
    ...base,
    campaignName: "Demo QA - Submission error",
    objectiveType: "WEB_CONVERSIONS",
    salesDestination: "WEBSITE",
    simulationOutcome: "SUBMISSION_ERROR"
  });
  const failedState = failed.structuredContent?.campaignReviewState;
  await call("submit_smartplus_campaign_review_demo", {
    proposalId: failedState.proposalId,
    expectedVersion: failedState.version,
    confirmed: true
  });
  await wait(1000);
  const failedStatus = await call("get_smartplus_campaign_review_demo_status", {
    proposalId: failedState.proposalId,
    expectedVersion: failedState.version
  });
  assert(failedStatus.structuredContent?.campaignReviewState?.status === "error", "Simulated submission error did not render an error state.");

  const unknown = await call("review_smartplus_campaign_demo", {
    ...base,
    campaignName: "Demo QA - Outcome unknown",
    objectiveType: "WEB_CONVERSIONS",
    salesDestination: "WEBSITE",
    simulationOutcome: "OUTCOME_UNKNOWN"
  });
  const unknownState = unknown.structuredContent?.campaignReviewState;
  await call("submit_smartplus_campaign_review_demo", {
    proposalId: unknownState.proposalId,
    expectedVersion: unknownState.version,
    confirmed: true
  });
  await wait(1000);
  const unknownStatus = await call("get_smartplus_campaign_review_demo_status", {
    proposalId: unknownState.proposalId,
    expectedVersion: unknownState.version
  });
  assert(unknownStatus.structuredContent?.campaignReviewState?.status === "outcome_unknown", "An unconfirmed result must remain in the reconciliation state.");
  const blockedUnknownRetry = await call("submit_smartplus_campaign_review_demo", {
    proposalId: unknownState.proposalId,
    expectedVersion: unknownState.version,
    confirmed: true
  });
  assert(
    blockedUnknownRetry.structuredContent?.campaignReviewState?.status === "outcome_unknown",
    "An unconfirmed create outcome must block a second create request."
  );

  console.log(JSON.stringify({
    ok: true,
    checked: [
      "tool_isolation",
      "web_conversions",
      "lead_generation_revision",
      "app_promotion",
      "immutable_versions",
      "duplicate_approval_idempotency",
      "submitting",
      "demo_receipt",
      "submission_error",
      "outcome_unknown_reconciliation_lock",
      "no_tiktok_mutation"
    ]
  }, null, 2));
} finally {
  await transport.close();
}
