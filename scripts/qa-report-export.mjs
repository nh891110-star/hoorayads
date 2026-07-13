import { createReportExport, getReportExport, reportCsv } from "../src/report-export.ts";
import { claudeReportFallback } from "../src/server.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const reportState = {
  status: "ready",
  generatedAt: "2026-07-13T12:00:00.000Z",
  advertiser: { id: "7390012345", name: "Authorized advertiser", currency: "USD", timezone: "America/Los_Angeles" },
  filters: { startDate: "2026-07-06", endDate: "2026-07-12", level: "adgroup", comparePreviousPeriod: true },
  kpis: [],
  totals: { spend: 100, impressions: 10000, clicks: 200, ctr: 2, cpc: 0.5, cpm: 10 },
  trend: [],
  rows: [
    {
      id: "ag-1",
      name: "Authorized ad group",
      status: "Active",
      spend: 100,
      impressions: 10000,
      clicks: 200,
      ctr: 2,
      cpc: 0.5,
      cpm: 10,
      details: {
        adgroupId: "ag-1",
        budget: "100 USD | Daily",
        bid: "12 USD | Custom",
        adScheduling: "2026-07-01 00:00:00 to 2026-07-31 23:59:59",
        attributionSetting: "1-day click | 7-day view"
      }
    }
  ]
};

const exportUrl = createReportExport(reportState, "https://reports.example.com");
assert(exportUrl?.startsWith("https://reports.example.com/report-exports/"), "Export URL has the wrong origin or path.");
const token = exportUrl.split("/").at(-1).replace(".csv", "");
const storedExport = getReportExport(token);
assert(storedExport, "Created report export could not be read from the export store.");
assert(storedExport.filename === "tiktok-ads-adgroup-2026-07-06-2026-07-12.csv", "Export filename has the wrong level or date range.");
assert(storedExport.csv.includes("Authorized ad group"), "CSV export is missing the report row.");
assert(
  storedExport.csv.startsWith('"Name","Status","Ad group ID","Budget","Bid","Ad scheduling","Attribution setting"'),
  "Ad group CSV does not use the level-specific breakdown headers."
);
assert(
  claudeReportFallback(reportState).includes("| Name | Status | Ad group ID | Budget | Bid | Ad scheduling | Attribution setting |"),
  "Claude fallback does not use the Ad group breakdown schema."
);

const campaignCsv = reportCsv({
  ...reportState,
  filters: { ...reportState.filters, level: "campaign" },
  rows: [{
    ...reportState.rows[0],
    id: "campaign-1",
    name: "Summer sale",
    details: { campaignBudget: "500 USD | Daily" }
  }]
});
assert(
  campaignCsv.startsWith('"Name","Status","Campaign budget","Spend","CPC (destination)","CPM","Impressions"'),
  "Campaign CSV does not use the level-specific breakdown headers."
);
assert(
  claudeReportFallback({
    ...reportState,
    filters: { ...reportState.filters, level: "campaign" },
    rows: [{ ...reportState.rows[0], id: "campaign-1", name: "Summer sale", details: { campaignBudget: "500 USD | Daily" } }]
  }).includes("| Name | Status | Campaign budget | Spend | CPC (destination) | CPM | Impressions |"),
  "Claude fallback does not use the Campaign breakdown schema."
);

const adCsv = reportCsv({
  ...reportState,
  filters: { ...reportState.filters, level: "ad" },
  rows: [{
    ...reportState.rows[0],
    id: "ad-1",
    name: "Creator video",
    details: { source: "Spark Ad", adgroupId: "ag-1", adgroupName: "Authorized ad group", adId: "ad-1" }
  }]
});
assert(
  adCsv.startsWith('"Name","Status","Source","Ad group ID","Ad group name","Ad ID"'),
  "Ad CSV does not use the level-specific breakdown headers."
);
assert(
  claudeReportFallback({
    ...reportState,
    filters: { ...reportState.filters, level: "ad" },
    rows: [{
      ...reportState.rows[0],
      id: "ad-1",
      name: "Creator video",
      details: { source: "Spark Ad", adgroupId: "ag-1", adgroupName: "Authorized ad group", adId: "ad-1" }
    }]
  }).includes("| Name | Status | Source | Ad group ID | Ad group name | Ad ID |"),
  "Claude fallback does not use the Ad breakdown schema."
);

console.log(JSON.stringify({ ok: true, filename: storedExport.filename }, null, 2));
