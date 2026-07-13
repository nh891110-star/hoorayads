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

function reportCsv(reportState: ReportState) {
  const header = ["ID", "Name", "Status", "Spend", "Impressions", "Clicks", "CTR", "CPC", "CPM"];
  const body = reportState.rows.map((row) => [
    row.id,
    row.name,
    row.status,
    row.spend,
    row.impressions,
    row.clicks,
    row.ctr,
    row.cpc,
    row.cpm
  ]);
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
