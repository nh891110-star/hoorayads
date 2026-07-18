import { z } from "zod";

import {
  campaignReviewFields
} from "../src/campaign-review-contract.ts";
import {
  buildSmartPlusCampaignPayload,
  validateCampaignReview
} from "../src/campaign-review.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const reviewSchema = z.object(campaignReviewFields);
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
assert(!("adgroup_id" in payload) && !("ad_id" in payload), "Campaign payload must not contain Ad Group or Ad fields.");

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

const unsupported = reviewSchema.safeParse({ ...base, objectiveType: "REACH" });
assert(!unsupported.success, "Brand/Reach must be rejected by the Smart+ Campaign Review schema.");

const unconfirmedSpecial = { ...web, specialIndustriesConfirmed: false };
assert(validateCampaignReview(unconfirmedSpecial).some((message) => message.includes("Special ad category")), "Special ad category confirmation must be required.");

const invalidBudget = { ...web, budgetMode: "BUDGET_MODE_INFINITE", budget: 50 };
assert(validateCampaignReview(invalidBudget).some((message) => message.includes("omitted")), "Unlimited budget must reject a numeric budget.");

console.log(JSON.stringify({
  ok: true,
  checked: [
    "web_conversions",
    "lead_generation",
    "app_promotion",
    "brand_negative_routing",
    "special_industry_confirmation",
    "budget_dependencies",
    "campaign_only_payload",
    "active_campaign_only_creation"
  ]
}, null, 2));
