import {
  buildActiveAdgroupRequest,
  buildDiagnosisRequest,
  buildEntityMetadataRequest,
  buildIntegratedReportRequest,
  getReportLevelContract,
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
    filterKey: "campaign_ids"
  },
  adgroup: {
    dataLevel: "AUCTION_ADGROUP",
    dimension: "adgroup_id",
    metadataTool: "adgroup_get",
    filterKey: "adgroup_ids"
  },
  ad: {
    dataLevel: "AUCTION_AD",
    dimension: "ad_id",
    metadataTool: "ad_get",
    filterKey: "ad_ids"
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
}

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
