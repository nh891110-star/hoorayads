import { callTikTokMcpTool, listTikTokAdvertiserAccounts } from "./tiktok-mcp.js";
import type { TikTokAdvertiserAccount, TikTokToolResponse } from "./tiktok-mcp.js";

export type ReportLevel = "campaign" | "adgroup" | "ad";
export type ReportSource = "live" | "demo";
export type ReportStatus = "ready" | "needs_authorization" | "needs_account" | "empty" | "error";

export type ReportMetrics = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export type ReportKpi = {
  key: keyof ReportMetrics;
  label: string;
  value: number;
  deltaPercent: number | null;
};

export type ReportRow = ReportMetrics & {
  id: string;
  name: string;
  status: string;
};

export type ReportTrendPoint = {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
};

export type ReportAccountOption = {
  advertiserId: string;
  advertiserName: string;
  currency: string;
  timezone: string;
};

export type ReportState = {
  status: ReportStatus;
  source: ReportSource;
  generatedAt: string;
  advertiser: {
    id: string;
    name: string;
    currency: string;
    timezone: string;
  } | null;
  filters: {
    startDate: string;
    endDate: string;
    level: ReportLevel;
    comparePreviousPeriod: boolean;
  };
  kpis: ReportKpi[];
  totals: ReportMetrics;
  trend: ReportTrendPoint[];
  rows: ReportRow[];
  insights: string[];
  accountOptions?: ReportAccountOption[];
  authorizationUrl?: string;
  message?: string;
  technicalDetail?: string;
};

export type GetAdsReportInput = {
  advertiserId?: string;
  startDate?: string;
  endDate?: string;
  level?: ReportLevel;
  mode?: ReportSource;
  comparePreviousPeriod?: boolean;
};

type RawReportRow = {
  dimensions?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
};

type RawReportPayload = {
  list?: RawReportRow[];
  page_info?: {
    page?: number;
    page_size?: number;
    total_number?: number;
    total_page?: number;
  };
  total_page?: number;
  [key: string]: unknown;
};

type EntityMetadata = {
  id: string;
  name: string;
  status: string;
};

const LEVEL_CONFIG: Record<
  ReportLevel,
  { dataLevel: "AUCTION_CAMPAIGN" | "AUCTION_ADGROUP" | "AUCTION_AD"; dimension: string; metadataTool: string; idField: string; nameField: string }
> = {
  campaign: {
    dataLevel: "AUCTION_CAMPAIGN",
    dimension: "campaign_id",
    metadataTool: "campaign_get",
    idField: "campaign_id",
    nameField: "campaign_name"
  },
  adgroup: {
    dataLevel: "AUCTION_ADGROUP",
    dimension: "adgroup_id",
    metadataTool: "adgroup_get",
    idField: "adgroup_id",
    nameField: "adgroup_name"
  },
  ad: {
    dataLevel: "AUCTION_AD",
    dimension: "ad_id",
    metadataTool: "ad_get",
    idField: "ad_id",
    nameField: "ad_name"
  }
};

const ZERO_METRICS: ReportMetrics = {
  spend: 0,
  impressions: 0,
  clicks: 0,
  ctr: 0,
  cpc: 0,
  cpm: 0
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveDateRange(input: GetAdsReportInput) {
  const defaults = defaultDateRange();
  const startDate = input.startDate || defaults.startDate;
  const endDate = input.endDate || defaults.endDate;
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end || startDate.length !== 10 || endDate.length !== 10) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (dayCount < 1) {
    throw new Error("The report start date must be on or before the end date.");
  }
  if (dayCount > 30) {
    throw new Error("Daily TikTok Ads reports support a maximum range of 30 days.");
  }

  return { startDate, endDate, start, end, dayCount };
}

function previousDateRange(start: Date, dayCount: number) {
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - dayCount + 1);
  return { startDate: formatDate(previousStart), endDate: formatDate(previousEnd) };
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value !== "string") {
    return 0;
  }

  const normalized = value.replaceAll(",", "").replace("%", "").trim();
  if (!normalized || normalized === "-") {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if ((typeof value === "string" || typeof value === "number") && String(value)) {
      return String(value);
    }
  }
  return "";
}

function extractList(payload: unknown): RawReportRow[] {
  if (Array.isArray(payload)) {
    return payload as RawReportRow[];
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as RawReportPayload;
  if (Array.isArray(record.list)) {
    return record.list;
  }
  const nestedData = record.data;
  if (nestedData && typeof nestedData === "object" && Array.isArray((nestedData as RawReportPayload).list)) {
    return (nestedData as RawReportPayload).list || [];
  }
  return [];
}

function totalPages(payload: RawReportPayload) {
  return Math.max(1, Number(payload.page_info?.total_page || payload.total_page || 1));
}

async function fetchReportRows(options: {
  advertiserId: string;
  startDate: string;
  endDate: string;
  level: ReportLevel;
}): Promise<TikTokToolResponse<{ rows: RawReportRow[] }>> {
  const config = LEVEL_CONFIG[options.level];
  const rows: RawReportRow[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await callTikTokMcpTool<RawReportPayload>("flat", "report_integrated_get", {
      advertiser_id: options.advertiserId,
      report_type: "BASIC",
      service_type: "AUCTION",
      data_level: config.dataLevel,
      dimensions: [config.dimension, "stat_time_day"],
      metrics: ["spend", "impressions", "clicks", "ctr", "cpc", "cpm"],
      start_date: options.startDate,
      end_date: options.endDate,
      order_field: "spend",
      order_type: "DESC",
      page,
      page_size: 1000
    });

    if (response.status !== "connected") {
      return response;
    }

    const pageRows = extractList(response.data);
    rows.push(...pageRows);
    if (page >= totalPages(response.data) || pageRows.length < 1000) {
      break;
    }
  }

  return { status: "connected", data: { rows } };
}

function aggregateReportRows(rawRows: RawReportRow[], level: ReportLevel) {
  const dimension = LEVEL_CONFIG[level].dimension;
  const entityMap = new Map<string, ReportRow>();
  const trendMap = new Map<string, ReportTrendPoint>();

  for (const rawRow of rawRows) {
    const dimensions = rawRow.dimensions && typeof rawRow.dimensions === "object" ? rawRow.dimensions : rawRow;
    const metrics = rawRow.metrics && typeof rawRow.metrics === "object" ? rawRow.metrics : rawRow;
    const id = readString(dimensions, [dimension, "id"]);
    const date = readString(dimensions, ["stat_time_day", "date"]);
    const spend = toNumber(metrics.spend);
    const impressions = toNumber(metrics.impressions);
    const clicks = toNumber(metrics.clicks);

    if (id) {
      const current = entityMap.get(id) || {
        ...ZERO_METRICS,
        id,
        name: `${level === "campaign" ? "Campaign" : level === "adgroup" ? "Ad group" : "Ad"} ${id}`,
        status: "Unknown"
      };
      current.spend += spend;
      current.impressions += impressions;
      current.clicks += clicks;
      entityMap.set(id, current);
    }

    if (date) {
      const point = trendMap.get(date) || { date, spend: 0, impressions: 0, clicks: 0 };
      point.spend += spend;
      point.impressions += impressions;
      point.clicks += clicks;
      trendMap.set(date, point);
    }
  }

  const rows = [...entityMap.values()]
    .map((row) => completeMetrics(row))
    .sort((a, b) => b.spend - a.spend);
  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { rows, trend, totals: totalsFromRows(rows) };
}

function completeMetrics<T extends { spend: number; impressions: number; clicks: number }>(metrics: T): T & ReportMetrics {
  return {
    ...metrics,
    ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0,
    cpm: metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0
  };
}

function totalsFromRows(rows: ReportRow[]) {
  const totals = rows.reduce(
    (sum, row) => ({
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  );
  return completeMetrics(totals);
}

function percentageDelta(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return ((current - previous) / previous) * 100;
}

function buildKpis(current: ReportMetrics, previous?: ReportMetrics): ReportKpi[] {
  const definitions: Array<{ key: keyof ReportMetrics; label: string }> = [
    { key: "spend", label: "Spend" },
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clicks" },
    { key: "ctr", label: "CTR" }
  ];
  return definitions.map(({ key, label }) => ({
    key,
    label,
    value: current[key],
    deltaPercent: previous ? percentageDelta(current[key], previous[key]) : null
  }));
}

function normalizeStatus(value: string) {
  const status = value.toUpperCase();
  if (status.includes("ENABLE") || status.includes("ACTIVE") || status.includes("DELIVERY_OK")) {
    return "Active";
  }
  if (status.includes("DISABLE") || status.includes("PAUSE")) {
    return "Paused";
  }
  if (status.includes("NOT_DELIVER") || status.includes("REJECT") || status.includes("LIMIT")) {
    return "Not delivering";
  }
  return value || "Unknown";
}

async function fetchEntityMetadata(advertiserId: string, level: ReportLevel, ids: string[]) {
  const config = LEVEL_CONFIG[level];
  const metadata = new Map<string, EntityMetadata>();

  for (let offset = 0; offset < Math.min(ids.length, 500); offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const filterKey = `${config.dimension}s`;
    const response = await callTikTokMcpTool<Record<string, unknown>>("flat", config.metadataTool, {
      advertiser_id: advertiserId,
      filtering: { [filterKey]: batch },
      fields: [config.idField, config.nameField, "operation_status", "secondary_status"],
      page: 1,
      page_size: 100
    });
    if (response.status !== "connected") {
      break;
    }

    for (const item of extractList(response.data)) {
      const id = readString(item, [config.idField]);
      if (!id) {
        continue;
      }
      metadata.set(id, {
        id,
        name: readString(item, [config.nameField]) || id,
        status: normalizeStatus(readString(item, ["secondary_status", "operation_status"]))
      });
    }
  }

  return metadata;
}

function applyMetadata(rows: ReportRow[], metadata: Map<string, EntityMetadata>) {
  return rows.map((row) => {
    const item = metadata.get(row.id);
    return item ? { ...row, name: item.name, status: item.status } : row;
  });
}

function buildInsights(rows: ReportRow[], totals: ReportMetrics) {
  if (rows.length === 0) {
    return [];
  }
  const top = rows[0];
  const spendShare = totals.spend > 0 ? (top.spend / totals.spend) * 100 : 0;
  const bestCtr = [...rows].filter((row) => row.impressions >= 100).sort((a, b) => b.ctr - a.ctr)[0];
  const insights = [`${top.name} drove ${spendShare.toFixed(0)}% of spend in this period.`];
  if (bestCtr && bestCtr.id !== top.id) {
    insights.push(`${bestCtr.name} had the strongest CTR at ${bestCtr.ctr.toFixed(2)}%.`);
  } else if (totals.cpc > 0) {
    insights.push(`Blended CPC was ${totals.cpc.toFixed(2)} for the selected period.`);
  }
  return insights;
}

function baseState(input: GetAdsReportInput, source: ReportSource): Omit<ReportState, "status"> {
  const range = resolveDateRange(input);
  return {
    source,
    generatedAt: new Date().toISOString(),
    advertiser: null,
    filters: {
      startDate: range.startDate,
      endDate: range.endDate,
      level: input.level || "campaign",
      comparePreviousPeriod: input.comparePreviousPeriod !== false
    },
    kpis: [],
    totals: { ...ZERO_METRICS },
    trend: [],
    rows: [],
    insights: []
  };
}

function accountOption(account: TikTokAdvertiserAccount): ReportAccountOption {
  return {
    advertiserId: account.advertiserId,
    advertiserName: account.advertiserName,
    currency: account.currency,
    timezone: account.timezone
  };
}

const DEMO_ACCOUNT: ReportAccountOption = {
  advertiserId: "demo-advertiser-001",
  advertiserName: "Sample Advertiser Account",
  currency: "USD",
  timezone: "America/Los_Angeles"
};

function fallbackAccountOption(advertiserId: string): ReportAccountOption {
  return {
    advertiserId,
    advertiserName: `TikTok Ads Account ${advertiserId.slice(-6)}`,
    currency: "USD",
    timezone: "Account timezone"
  };
}

function makeDemoState(input: GetAdsReportInput): ReportState {
  const state = baseState(input, "demo");
  const labels = ["Summer Sale | Prospecting", "Always-on Retargeting", "Creator Spark Test", "Catalog Best Sellers", "App Install | US"];
  const spend = [1842.6, 1260.4, 922.15, 714.8, 466.25];
  const impressions = [284100, 146220, 121800, 103700, 89700];
  const clicks = [4688, 3224, 2777, 1984, 1421];
  const rows = labels.map((name, index) =>
    completeMetrics({
      id: `demo-${index + 1}`,
      name,
      status: index === 4 ? "Paused" : "Active",
      spend: spend[index],
      impressions: impressions[index],
      clicks: clicks[index]
    })
  );
  const totals = totalsFromRows(rows);
  const range = resolveDateRange(input);
  const dailyWeights = [0.11, 0.13, 0.12, 0.15, 0.14, 0.17, 0.18];
  const trend: ReportTrendPoint[] = [];
  for (let index = 0; index < Math.min(7, range.dayCount); index += 1) {
    const date = new Date(range.start);
    date.setUTCDate(date.getUTCDate() + index);
    const weight = dailyWeights[index];
    trend.push({
      date: formatDate(date),
      spend: totals.spend * weight,
      impressions: Math.round(totals.impressions * weight),
      clicks: Math.round(totals.clicks * weight)
    });
  }
  const previous = completeMetrics({
    spend: totals.spend / 1.124,
    impressions: totals.impressions / 1.086,
    clicks: totals.clicks / 1.158
  });

  return {
    ...state,
    status: "ready",
    advertiser: {
      id: DEMO_ACCOUNT.advertiserId,
      name: DEMO_ACCOUNT.advertiserName,
      currency: DEMO_ACCOUNT.currency,
      timezone: DEMO_ACCOUNT.timezone
    },
    accountOptions: [DEMO_ACCOUNT],
    totals,
    kpis: buildKpis(totals, state.filters.comparePreviousPeriod ? previous : undefined),
    trend,
    rows,
    insights: buildInsights(rows, totals)
  };
}

export async function getTikTokAdsReport(input: GetAdsReportInput = {}): Promise<ReportState> {
  if ((input.mode || "live") === "demo") {
    try {
      return makeDemoState(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid demo report request.";
      return { ...baseState({}, "demo"), status: "error", message };
    }
  }

  let state: Omit<ReportState, "status">;
  let range: ReturnType<typeof resolveDateRange>;
  try {
    state = baseState(input, "live");
    range = resolveDateRange(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid report request.";
    return { ...baseState({}, "live"), status: "error", message };
  }

  const configuredAdvertiserId = input.advertiserId || process.env.REPORTING_DEFAULT_ADVERTISER_ID?.trim();
  let selectedAccount: TikTokAdvertiserAccount | undefined;
  let advertiserId = configuredAdvertiserId || "";
  let accountOptions: ReportAccountOption[] = [];

  try {
    if (!advertiserId) {
      const accountsResponse = await listTikTokAdvertiserAccounts("flat");
      if (accountsResponse.status === "needs_authorization") {
        return {
          ...state,
          status: "needs_authorization",
          authorizationUrl: accountsResponse.authorizationUrl,
          message: "Connect TikTok Ads to load live reporting data."
        };
      }
      if (accountsResponse.status === "misconfigured") {
        return { ...state, status: "error", message: accountsResponse.message };
      }
      if (accountsResponse.data.accounts.length === 0) {
        return { ...state, status: "empty", message: "No TikTok advertiser accounts were available for this user." };
      }
      accountOptions = accountsResponse.data.accounts.map(accountOption);
      if (accountsResponse.data.accounts.length > 1) {
        return {
          ...state,
          status: "needs_account",
          accountOptions,
          message: "Choose an advertiser account to generate the report."
        };
      }
      selectedAccount = accountsResponse.data.accounts[0];
      advertiserId = selectedAccount.advertiserId;
    } else {
      // Keep account discovery non-blocking when an explicit advertiser ID was supplied.
      // This preserves direct reporting while still letting the UI offer account switching.
      const accountsResponse = await listTikTokAdvertiserAccounts("flat");
      if (accountsResponse.status === "connected") {
        accountOptions = accountsResponse.data.accounts.map(accountOption);
        selectedAccount = accountsResponse.data.accounts.find((account) => account.advertiserId === advertiserId);
      }
    }

    if (accountOptions.length === 0) {
      accountOptions = [selectedAccount ? accountOption(selectedAccount) : fallbackAccountOption(advertiserId)];
    }

    const currentResponse = await fetchReportRows({
      advertiserId,
      startDate: range.startDate,
      endDate: range.endDate,
      level: state.filters.level
    });
    if (currentResponse.status === "needs_authorization") {
      return {
        ...state,
        status: "needs_authorization",
        authorizationUrl: currentResponse.authorizationUrl,
        message: "Connect TikTok Ads to load live reporting data."
      };
    }
    if (currentResponse.status === "misconfigured") {
      return { ...state, status: "error", message: currentResponse.message };
    }

    const current = aggregateReportRows(currentResponse.data.rows, state.filters.level);
    if (current.rows.length === 0) {
      return {
        ...state,
        status: "empty",
        accountOptions,
        advertiser: {
          id: advertiserId,
          name: selectedAccount?.advertiserName || `TikTok Ads Account ${advertiserId.slice(-6)}`,
          currency: selectedAccount?.currency || "USD",
          timezone: selectedAccount?.timezone || "Account timezone"
        },
        message: "No delivery data was found for the selected account and date range."
      };
    }

    let previousTotals: ReportMetrics | undefined;
    if (state.filters.comparePreviousPeriod) {
      const previousRange = previousDateRange(range.start, range.dayCount);
      const previousResponse = await fetchReportRows({
        advertiserId,
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
        level: state.filters.level
      });
      if (previousResponse.status === "connected") {
        previousTotals = aggregateReportRows(previousResponse.data.rows, state.filters.level).totals;
      }
    }

    const metadata = await fetchEntityMetadata(
      advertiserId,
      state.filters.level,
      current.rows.map((row) => row.id)
    ).catch(() => new Map<string, EntityMetadata>());
    const rows = applyMetadata(current.rows, metadata);
    const advertiser = {
      id: advertiserId,
      name: selectedAccount?.advertiserName || `TikTok Ads Account ${advertiserId.slice(-6)}`,
      currency: selectedAccount?.currency || "USD",
      timezone: selectedAccount?.timezone || "Account timezone"
    };

    return {
      ...state,
      status: "ready",
      advertiser,
      accountOptions,
      totals: current.totals,
      kpis: buildKpis(current.totals, previousTotals),
      trend: current.trend,
      rows,
      insights: buildInsights(rows, current.totals)
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok Ads reporting failed.";
    return {
      ...state,
      status: "error",
      message: "The report could not be generated. Retry, or switch to demo mode for the product walkthrough.",
      technicalDetail: message
    };
  }
}
