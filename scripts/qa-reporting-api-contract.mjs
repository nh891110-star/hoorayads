import {
  buildActiveAdgroupRequest,
  buildDiagnosisRequest,
  buildEntityMetadataRequest,
  buildIntegratedReportRequest,
  getReportLevelContract,
  normalizeReportEntityMetadata,
  normalizeTikTokDiagnosis
} from "../src/reporting.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const expected = {
  campaign: {
    dataLevel: "AUCTION_CAMPAIGN",
    dimension: "campaign_id",
    metadataTool: "campaign_get",
    filterKey: "campaign_ids",
    metadataFields: ["campaign_id", "campaign_name", "operation_status", "secondary_status", "budget", "budget_mode"]
  },
  adgroup: {
    dataLevel: "AUCTION_ADGROUP",
    dimension: "adgroup_id",
    metadataTool: "adgroup_get",
    filterKey: "adgroup_ids",
    metadataFields: [
      "adgroup_id", "adgroup_name", "operation_status", "secondary_status", "budget", "budget_mode",
      "bid_price", "bid_type", "conversion_bid_price", "deep_cpa_bid", "roas_bid", "schedule_type",
      "schedule_start_time", "schedule_end_time", "dayparting", "click_attribution_window",
      "view_attribution_window", "engaged_view_attribution_window"
    ]
  },
  ad: {
    dataLevel: "AUCTION_AD",
    dimension: "ad_id",
    metadataTool: "ad_get",
    filterKey: "ad_ids",
    metadataFields: [
      "ad_name", "operation_status", "secondary_status", "tiktok_item_id", "identity_type",
      "creative_type", "ad_format", "adgroup_id", "adgroup_name", "ad_id"
    ]
  }
};

for (const [level, contractExpectation] of Object.entries(expected)) {
  const contract = getReportLevelContract(level);
  assert(contract.dataLevel === contractExpectation.dataLevel, `${level} uses the wrong TikTok data_level.`);
  assert(contract.dimension === contractExpectation.dimension, `${level} uses the wrong report dimension.`);
  assert(contract.metadataTool === contractExpectation.metadataTool, `${level} uses the wrong metadata tool.`);

  const reportRequest = buildIntegratedReportRequest({
    advertiserId: "7390012345",
    startDate: "2026-07-06",
    endDate: "2026-07-12",
    level
  });
  assert(reportRequest.report_type === "BASIC", `${level} report_type must be BASIC.`);
  assert(reportRequest.service_type === "AUCTION", `${level} service_type must be AUCTION.`);
  assert(reportRequest.data_level === contractExpectation.dataLevel, `${level} request has the wrong data_level.`);
  assert(
    JSON.stringify(reportRequest.dimensions) === JSON.stringify([contractExpectation.dimension, "stat_time_day"]),
    `${level} request has the wrong dimensions.`
  );

  const metadataRequest = buildEntityMetadataRequest("7390012345", level, ["entity-1"]);
  assert(metadataRequest.tool === contractExpectation.metadataTool, `${level} metadata lookup uses the wrong tool.`);
  assert(
    JSON.stringify(metadataRequest.arguments.filtering) === JSON.stringify({ [contractExpectation.filterKey]: ["entity-1"] }),
    `${level} metadata lookup uses the wrong ID filter.`
  );
  assert(
    JSON.stringify(metadataRequest.arguments.fields) === JSON.stringify(contractExpectation.metadataFields),
    `${level} metadata lookup does not request the exact breakdown fields.`
  );
}

const campaignMetadata = normalizeReportEntityMetadata("campaign", {
  campaign_id: "campaign-1",
  campaign_name: "Summer sale",
  operation_status: "ENABLE",
  budget: 500,
  budget_mode: "BUDGET_MODE_DAY"
}, "USD");
assert(campaignMetadata.details.campaignBudget === "500 USD | Daily", "Campaign budget was not normalized.");

const adgroupMetadata = normalizeReportEntityMetadata("adgroup", {
  adgroup_id: "adgroup-1",
  adgroup_name: "Broad audience",
  operation_status: "ENABLE",
  budget: 100,
  budget_mode: "BUDGET_MODE_DAY",
  bid_price: 12,
  bid_type: "BID_TYPE_CUSTOM",
  schedule_type: "SCHEDULE_START_END",
  schedule_start_time: "2026-07-01 00:00:00",
  schedule_end_time: "2026-07-31 23:59:59",
  click_attribution_window: "ONE_DAY",
  view_attribution_window: "SEVEN_DAYS",
  engaged_view_attribution_window: "ONE_DAY"
}, "USD");
assert(adgroupMetadata.details.adgroupId === "adgroup-1", "Ad group ID was not normalized.");
assert(adgroupMetadata.details.budget === "100 USD | Daily", "Ad group budget was not normalized.");
assert(adgroupMetadata.details.bid === "12 USD | Custom", "Ad group bid was not normalized.");
assert(
  adgroupMetadata.details.adScheduling === "2026-07-01 00:00:00 to 2026-07-31 23:59:59",
  "Ad group scheduling was not normalized."
);
assert(
  adgroupMetadata.details.attributionSetting === "1-day click | 7-day view | 1-day engaged view",
  "Ad group attribution settings were not normalized."
);

const adMetadata = normalizeReportEntityMetadata("ad", {
  ad_id: "ad-1",
  ad_name: "Creator video",
  operation_status: "ENABLE",
  tiktok_item_id: "post-1",
  identity_type: "AUTH_CODE",
  adgroup_id: "adgroup-1",
  adgroup_name: "Broad audience"
}, "USD");
assert(adMetadata.details.source === "Spark Ad", "Ad source was not derived from TikTok's Spark Ad fields.");
assert(adMetadata.details.adgroupId === "adgroup-1", "Ad group ID was not preserved for the ad breakdown.");
assert(adMetadata.details.adgroupName === "Broad audience", "Ad group name was not preserved for the ad breakdown.");
assert(adMetadata.details.adId === "ad-1", "Ad ID was not preserved for the ad breakdown.");

const diagnosisRequest = buildDiagnosisRequest(
  "7390012345",
  Array.from({ length: 24 }, (_, index) => `adgroup-${index + 1}`)
);
assert(diagnosisRequest.tool === "tool_diagnosis_get", "Diagnosis must use TikTok's official tool_diagnosis_get.");
assert(diagnosisRequest.arguments.advertiser_id === "7390012345", "Diagnosis is missing the required advertiser_id.");
assert(diagnosisRequest.arguments.filtering.adgroup_ids.length === 20, "Diagnosis must enforce TikTok's 20-ad-group limit.");
const activeAdgroupRequest = buildActiveAdgroupRequest("7390012345");
assert(
  activeAdgroupRequest.filtering.primary_status === "STATUS_NOT_DELETE",
  "Active-ad-group discovery must use a primary_status accepted by adgroup_get."
);
assert(activeAdgroupRequest.fields.includes("operation_status"), "Active-ad-group discovery must inspect operation_status.");

const diagnosis = normalizeTikTokDiagnosis(
  {
    results: [
      {
        adgroup_id: "adgroup-1",
        adgroup_name: "Prospecting | Broad US",
        diagnosis: {
          diagnosis_time: "2026-07-13 10:30:00",
          suggestions: {
            creative: [
              {
                suggestion_id: "creative-1",
                suggestion_time: "2026-07-13 10:20:00",
                issue_suggestion: "VIDEO_RESOLUTION",
                name: "Prospecting video A",
                ad_id: "ad-1",
                vid: "video-1"
              }
            ],
            bid_and_budget: [
              {
                suggestion_id: "budget-1",
                issue_suggestion: "SUGGEST_BUDGET",
                budget: 100,
                suggest_budget: 140
              }
            ],
            event_track: [
              {
                suggestion_id: "pixel-1",
                issue_suggestion: "PIXEL",
                pixel_id: "pixel-1",
                pixel_code: "PX-001"
              }
            ]
          }
        }
      }
    ]
  },
  "USD"
);
assert(diagnosis.status === "issues", "Official TikTok suggestions must produce an issues diagnosis state.");
assert(diagnosis.suggestions.length === 3, "All three official diagnosis categories must be preserved.");
assert(diagnosis.suggestions.every((item) => item.source === "tiktok"), "Diagnosis source must remain TikTok.");
assert(diagnosis.suggestions.every((item) => !("severity" in item)), "Diagnosis must not invent a severity field.");
assert(diagnosis.suggestions[1].currentValue === "100 USD", "Current budget was not preserved.");
assert(diagnosis.suggestions[1].recommendedValue === "140 USD", "Recommended budget was not preserved.");
assert(
  normalizeTikTokDiagnosis({ results: [] }, "USD").status === "clear",
  "An empty official diagnosis response must produce the clear state."
);

console.log(JSON.stringify({ ok: true, levels: Object.keys(expected), diagnosisTool: diagnosisRequest.tool }, null, 2));
