import { createReportExport, getReportExport } from "../src/report-export.ts";

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
    { id: "ag-1", name: "Authorized ad group", status: "Active", spend: 100, impressions: 10000, clicks: 200, ctr: 2, cpc: 0.5, cpm: 10 }
  ]
};

const exportUrl = createReportExport(reportState, "https://reports.example.com");
assert(exportUrl?.startsWith("https://reports.example.com/report-exports/"), "Export URL has the wrong origin or path.");
const token = exportUrl.split("/").at(-1).replace(".csv", "");
const storedExport = getReportExport(token);
assert(storedExport, "Created report export could not be read from the export store.");
assert(storedExport.filename === "tiktok-ads-adgroup-2026-07-06-2026-07-12.csv", "Export filename has the wrong level or date range.");
assert(storedExport.csv.includes("Authorized ad group"), "CSV export is missing the report row.");
assert(storedExport.csv.includes('"Impressions"'), "CSV export is missing metric headers.");

console.log(JSON.stringify({ ok: true, filename: storedExport.filename }, null, 2));
