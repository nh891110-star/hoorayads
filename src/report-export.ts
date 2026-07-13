import { randomUUID } from "node:crypto";

import type { ReportState } from "./reporting.js";

type StoredReportExport = {
  csv: string;
  expiresAt: number;
  filename: string;
};

const EXPORT_TTL_MS = 15 * 60 * 1000;
const reportExports = new Map<string, StoredReportExport>();

function csvValue(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function reportCsv(reportState: ReportState) {
  const { level } = reportState.filters;
  const header = level === "campaign"
    ? ["Name", "Status", "Campaign budget", "Spend", "CPC (destination)", "CPM", "Impressions"]
    : level === "adgroup"
      ? ["Name", "Status", "Ad group ID", "Budget", "Bid", "Ad scheduling", "Attribution setting"]
      : ["Name", "Status", "Source", "Ad group ID", "Ad group name", "Ad ID"];
  const body = reportState.rows.map((row) => level === "campaign"
    ? [row.name, row.status, row.details.campaignBudget, row.spend, row.cpc, row.cpm, row.impressions]
    : level === "adgroup"
      ? [
          row.name,
          row.status,
          row.details.adgroupId,
          row.details.budget,
          row.details.bid,
          row.details.adScheduling,
          row.details.attributionSetting
        ]
      : [row.name, row.status, row.details.source, row.details.adgroupId, row.details.adgroupName, row.details.adId]
  );
  return [header, ...body].map((row) => row.map(csvValue).join(",")).join("\n");
}

function removeExpiredExports(now = Date.now()) {
  for (const [token, storedExport] of reportExports) {
    if (storedExport.expiresAt <= now) {
      reportExports.delete(token);
    }
  }
}

export function createReportExport(reportState: ReportState, publicBaseUrl: string) {
  if (reportState.status !== "ready") {
    return undefined;
  }

  removeExpiredExports();
  const token = randomUUID();
  const filename = `tiktok-ads-${reportState.filters.level}-${reportState.filters.startDate}-${reportState.filters.endDate}.csv`;
  reportExports.set(token, {
    csv: reportCsv(reportState),
    expiresAt: Date.now() + EXPORT_TTL_MS,
    filename
  });
  return `${publicBaseUrl.replace(/\/$/, "")}/report-exports/${token}.csv`;
}

export function getReportExport(token: string) {
  removeExpiredExports();
  const storedExport = reportExports.get(token);
  if (!storedExport) {
    return null;
  }
  return storedExport;
}
