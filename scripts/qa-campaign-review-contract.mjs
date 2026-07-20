import { z } from "zod";

import {
  campaignReviewFields,
  reviewSmartPlusCampaignInput
} from "../src/campaign-review-contract.ts";
import {
  buildSmartPlusCampaignPayload,
  createCampaignReviewStore,
  normalizeCampaignInput,
  normalizeCampaignReadback,
  validateCampaignReadback,
  validateCampaignReview
} from "../src/campaign-review.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const reviewSchema = z.object(campaignReviewFields);
const liveReviewSchema = z.object(reviewSmartPlusCampaignInput).strict();
const base = {
  advertiserId: "7481826080479870993",
  campaignName: "MCP UI QA - Website Conversions",
  objectiveType: "WEB_CONVERSIONS",
  budget: 50,
  budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
  budgetOptimizeOn: true,
  salesDestination: "WEBSITE",
  catalogEnabled: false,
  specialIndustries: [],
  specialIndustriesConfirmed: true,
  campaignType: "REGULAR_CAMPAIGN",
  aiSuggestedFields: ["budget"]
};

const web = reviewSchema.parse(base);
const webErrors = validateCampaignReview(web, { country: "US", status: "STATUS_ENABLE" });
assert(webErrors.length === 0, `Valid Website Conversions review failed: ${webErrors.join(" ")}`);
const payload = buildSmartPlusCampaignPayload(web, "1234567890123456789");
assert(payload.operation_status === "ENABLE", "Campaign Review must create the approved Campaign as Active.");
assert(payload.request_id === "1234567890123456789", "Reviewed request ID must be preserved.");
assert(payload.objective_type === "WEB_CONVERSIONS", "Website objective was not preserved.");
assert(payload.sales_destination === "WEBSITE", "Website destination was not preserved.");
assert(!("campaign_type" in payload), "Web payload must omit the App-only Campaign type field.");
assert(!("special_industries" in payload), "No special ad category must serialize by omitting special_industries.");
assert(!("adgroup_id" in payload) && !("ad_id" in payload), "Campaign payload must not contain Ad Group or Ad fields.");
assert(!liveReviewSchema.safeParse({ ...base, industry: "EDUCATION" }).success, "Unsupported industry must be rejected by the live tool schema.");
assert(!liveReviewSchema.safeParse({ ...base, specialIndustriesConfirmed: undefined }).success, "The live tool must require explicit special-ad-category confirmation before rendering.");
assert(!liveReviewSchema.safeParse({ ...base, specialIndustriesConfirmed: false }).success, "The live tool must not render an initial card with unconfirmed special-ad-category status.");

const normalizedDefaults = normalizeCampaignInput({
  advertiserId: base.advertiserId,
  campaignName: "MCP UI QA - AI Suggested Defaults",
  objectiveType: "WEB_CONVERSIONS",
  budget: 50,
  salesDestination: "WEBSITE",
  specialIndustries: [],
  specialIndustriesConfirmed: true
}, base.advertiserId);
assert(normalizedDefaults.aiSuggestedFields.includes("budgetMode"), "A server-proposed budget mode must be labeled AI suggested.");
assert(normalizedDefaults.aiSuggestedFields.includes("budgetOptimizeOn"), "A server-proposed CBO setting must be labeled AI suggested.");
assert(normalizedDefaults.aiSuggestedFields.includes("catalogEnabled"), "A server-proposed catalog setting must be labeled AI suggested.");
assert(!normalizedDefaults.aiSuggestedFields.includes("budget"), "A user-supplied budget must not be labeled AI suggested.");

const readback = {
  campaign_id: "1840000000000000001",
  campaign_name: web.campaignName,
  objective_type: web.objectiveType,
  operation_status: "ENABLE",
  secondary_status: "CAMPAIGN_STATUS_ENABLE",
  budget: web.budget,
  current_budget: web.budget,
  budget_mode: web.budgetMode,
  budget_optimize_on: web.budgetOptimizeOn,
  catalog_enabled: web.catalogEnabled,
  sales_destination: web.salesDestination,
  special_industries: web.specialIndustries,
  create_time: "2026-07-19 09:00:00"
};
assert(validateCampaignReadback(web, readback).length === 0, "A matching TikTok Campaign read-back was rejected.");
const normalizedReadback = normalizeCampaignReadback(readback);
assert(normalizedReadback.campaignId === readback.campaign_id, "Verified Campaign ID was not normalized from TikTok read-back.");
assert(normalizedReadback.operationStatus === "ENABLE", "Verified Active status was not normalized from TikTok read-back.");
assert(
  validateCampaignReadback(web, { ...readback, campaign_name: "Unexpected Campaign" }).some((message) => message.includes("different Campaign name")),
  "A mismatched TikTok Campaign read-back must not be accepted as verified."
);
assert(
  validateCampaignReadback(web, { ...readback, operation_status: "DISABLE" }).some((message) => message.includes("Active operation status")),
  "A non-Active TikTok Campaign read-back must not be accepted as verified."
);

const lead = reviewSchema.parse({
  ...base,
  campaignName: "MCP UI QA - Lead Generation",
  objectiveType: "LEAD_GENERATION",
  salesDestination: undefined
});
assert(validateCampaignReview(lead, { country: "US", status: "STATUS_ENABLE" }).length === 0, "Lead Generation review should be valid without Sales destination.");

const app = reviewSchema.parse({
  ...base,
  campaignName: "MCP UI QA - App Promotion",
  objectiveType: "APP_PROMOTION",
  salesDestination: undefined,
  appPromotionType: "APP_INSTALL",
  appId: "1234567890123456789"
});
assert(validateCampaignReview(app, { country: "US", status: "STATUS_ENABLE" }).length === 0, "Regular App Promotion review should accept App promotion type.");
const appPayload = buildSmartPlusCampaignPayload(app, "1234567890123456790");
assert(appPayload.app_id === "1234567890123456789", "App Promotion App ID was not preserved in the API payload.");
assert(appPayload.app_promotion_type === "APP_INSTALL", "App Promotion type was not preserved in the API payload.");
assert(appPayload.campaign_type === "REGULAR_CAMPAIGN", "App Promotion Campaign type was not preserved in the API payload.");
assert(!("catalog_enabled" in appPayload) && !("catalog_type" in appPayload), "App Promotion payload must omit Catalog fields.");
assert(!("sales_destination" in appPayload), "App Promotion payload must omit Sales destination.");

const specialCategoryPayload = buildSmartPlusCampaignPayload({ ...web, specialIndustries: ["HOUSING"] }, "1234567890123456791");
assert(JSON.stringify(specialCategoryPayload.special_industries) === JSON.stringify(["HOUSING"]), "Confirmed special ad category was not serialized to the API enum.");

assert(
  validateCampaignReview({ ...web, catalogEnabled: false, catalogType: "ECOMMERCE" }).some((message) => message.includes("Catalog type must be omitted")),
  "A stale Catalog type must be rejected when Catalog is not used."
);
assert(
  validateCampaignReview({ ...web, appId: "1234567890123456789" }).some((message) => message.includes("App ID is available only")),
  "A Web Campaign must reject the App-only App ID field."
);
assert(
  validateCampaignReview({ ...web, campaignType: "IOS14_CAMPAIGN", appId: "1234567890123456789" }).some((message) => message.includes("iOS 14 Dedicated Campaign")),
  "A Web Campaign must reject the App-only iOS 14 Campaign type."
);

const unsupported = reviewSchema.safeParse({ ...base, objectiveType: "REACH" });
assert(!unsupported.success, "Brand/Reach must be rejected by the Smart+ Campaign Review schema.");

const unconfirmedSpecial = { ...web, specialIndustriesConfirmed: false };
assert(validateCampaignReview(unconfirmedSpecial).some((message) => message.includes("Special ad category")), "Special ad category confirmation must be required.");

const invalidBudget = { ...web, budgetMode: "BUDGET_MODE_INFINITE", budget: 50 };
assert(validateCampaignReview(invalidBudget).some((message) => message.includes("omitted")), "Unlimited budget must reject a numeric budget.");

const reviewStore = createCampaignReviewStore({ mode: "demo" });
const firstProposal = await reviewStore.prepare(web);
const secondProposal = await reviewStore.prepare({
  ...lead,
  campaignName: "MCP UI QA - New Active Proposal"
});
const refreshedFirstProposal = await reviewStore.getStatus(firstProposal.proposalId, firstProposal.version);
assert(secondProposal.status === "proposed", "The latest Campaign proposal must remain active.");
assert(refreshedFirstProposal.status === "outdated", "A previous Campaign proposal must become Inactive after a new proposal is prepared.");
assert(refreshedFirstProposal.readyToCreate === false, "An inactive Campaign proposal must never remain creatable.");
const staleSubmit = await reviewStore.create(firstProposal.proposalId, firstProposal.version);
assert(staleSubmit.status === "outdated", "The server must reject submission from an inactive Campaign proposal.");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "web_conversions",
    "lead_generation",
    "app_promotion",
    "brand_negative_routing",
    "special_industry_confirmation",
    "special_industry_pre_card_schema_guard",
    "unsupported_industry_rejection",
    "budget_dependencies",
    "objective_specific_field_omission",
    "ai_suggested_default_provenance",
    "campaign_only_payload",
    "active_campaign_only_creation",
    "tiktok_readback_normalization",
    "tiktok_readback_mismatch_guard",
    "single_active_proposal",
    "inactive_proposal_write_guard"
  ]
}, null, 2));
