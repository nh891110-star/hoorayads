import { callTikTokMcpTool, listTikTokAdvertiserAccounts } from "./tiktok-mcp.js";
import type { TikTokAdvertiserAccount, TikTokToolResponse } from "./tiktok-mcp.js";

export type ReportLevel = "campaign" | "adgroup" | "ad";
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

export type ReportDiagnosisSuggestion = {
  source: "tiktok";
  category: "creative" | "bid_and_budget" | "event_track";
  suggestionCode: string;
  suggestionId?: string;
  adgroupId?: string;
  adId?: string;
  entityName: string;
  message: string;
  currentValue?: string;
  recommendedValue?: string;
  suggestionTime?: string;
  details?: string[];
};

export type ReportDiagnosis = {
  status: "issues" | "clear" | "no_ads";
  suggestions: ReportDiagnosisSuggestion[];
};

export type ReportState = {
  status: ReportStatus;
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
  diagnosis?: ReportDiagnosis;
  accountOptions?: ReportAccountOption[];
  authorizationUrl?: string;
  exportUrl?: string;
  message?: string;
  technicalDetail?: string;
};

export type GetAdsReportInput = {
  advertiserId?: string;
  startDate?: string;
  endDate?: string;
  level?: ReportLevel;
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

type RawDiagnosisResult = {
  adgroup_id?: unknown;
  adgroup_name?: unknown;
  diagnosis?: unknown;
  [key: string]: unknown;
};

type DiagnosisCategory = ReportDiagnosisSuggestion["category"];

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

export function getReportLevelContract(level: ReportLevel) {
  return { ...LEVEL_CONFIG[level] };
}

export function buildIntegratedReportRequest(
  options: { advertiserId: string; startDate: string; endDate: string; level: ReportLevel },
  page = 1
) {
  const config = LEVEL_CONFIG[options.level];
  return {
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
  };
}

export function buildEntityMetadataRequest(advertiserId: string, level: ReportLevel, ids: string[]) {
  const config = LEVEL_CONFIG[level];
  return {
    tool: config.metadataTool,
    arguments: {
      advertiser_id: advertiserId,
      filtering: { [`${config.dimension}s`]: ids },
      fields: [config.idField, config.nameField, "operation_status", "secondary_status"],
      page: 1,
      page_size: 100
    }
  };
}

export function buildDiagnosisRequest(advertiserId: string, adgroupIds: string[] = []) {
  const filteredAdgroupIds = [...new Set(adgroupIds.filter(Boolean))].slice(0, 20);
  return {
    tool: "tool_diagnosis_get",
    arguments: {
      advertiser_id: advertiserId,
      ...(filteredAdgroupIds.length > 0 ? { filtering: { adgroup_ids: filteredAdgroupIds } } : {})
    }
  };
}

export function buildActiveAdgroupRequest(advertiserId: string, page = 1) {
  return {
    advertiser_id: advertiserId,
    filtering: { primary_status: "STATUS_NOT_DELETE" },
    fields: ["adgroup_id", "operation_status"],
    page,
    page_size: 1000
  };
}

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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readOptionalString(record: Record<string, unknown>, keys: string[]) {
  const value = readString(record, keys);
  return value || undefined;
}

function formatDiagnosisAmount(value: unknown, currency: string) {
  if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "") {
    return undefined;
  }
  const rawValue = String(value).trim();
  return currency && !rawValue.toUpperCase().includes(currency.toUpperCase()) ? `${rawValue} ${currency}` : rawValue;
}

const DIAGNOSIS_COPY: Record<string, string> = {
  NOBGM: "Add background music to this video.",
  VIDEO_LENGTH: "Use a longer video creative.",
  VIDEO_RESOLUTION: "Replace this video with a higher-resolution version.",
  SUGGEST_BID: "TikTok recommends adjusting the bid.",
  SUGGEST_BUDGET: "TikTok recommends adjusting the budget.",
  NOBID_SWITCH: "Switch the bidding strategy to Maximum Delivery.",
  BUDGET_EDR: "Review TikTok's budget scenarios and estimated results.",
  BID_EDR: "Review TikTok's bid scenarios and estimated costs.",
  PIXEL: "Check and test the Pixel setup; TikTok detected no recent activity."
};

function diagnosisMessage(code: string) {
  if (DIAGNOSIS_COPY[code]) {
    return DIAGNOSIS_COPY[code];
  }
  const label = code.replaceAll("_", " ").toLowerCase();
  return label ? `Review TikTok's ${label} recommendation.` : "Review this TikTok recommendation.";
}

function inferDiagnosisCategory(hint: string, suggestion: Record<string, unknown>): DiagnosisCategory | null {
  const normalizedHint = hint.toUpperCase();
  const code = readString(suggestion, ["issue_suggestion", "suggestion_code", "suggestion_type"]).toUpperCase();
  if (normalizedHint.includes("CREATIVE") || ["NOBGM", "VIDEO_LENGTH", "VIDEO_RESOLUTION"].includes(code)) {
    return "creative";
  }
  if (normalizedHint.includes("BID") || normalizedHint.includes("BUDGET") || ["SUGGEST_BID", "SUGGEST_BUDGET", "NOBID_SWITCH", "BUDGET_EDR", "BID_EDR"].includes(code)) {
    return "bid_and_budget";
  }
  if (normalizedHint.includes("EVENT") || normalizedHint.includes("PIXEL") || code === "PIXEL") {
    return "event_track";
  }
  return null;
}

function collectDiagnosisSuggestions(value: unknown) {
  const collected: Array<{ categoryHint: string; suggestion: Record<string, unknown> }> = [];

  const visit = (candidate: unknown, categoryHint = "") => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        visit(item, categoryHint);
      }
      return;
    }

    const record = asRecord(candidate);
    if (!record) {
      return;
    }

    const nestedKeys = ["creative", "bid_and_budget", "event_track"];
    let foundNestedCategory = false;
    for (const key of nestedKeys) {
      if (record[key] !== undefined) {
        foundNestedCategory = true;
        visit(record[key], key);
      }
    }

    if (!foundNestedCategory) {
      collected.push({
        categoryHint: readString(record, ["issue_category", "category", "suggestion_category"]) || categoryHint,
        suggestion: record
      });
    }
  };

  visit(value);
  return collected;
}

function diagnosisValues(
  category: DiagnosisCategory,
  code: string,
  suggestion: Record<string, unknown>,
  currency: string
) {
  if (category !== "bid_and_budget") {
    return {};
  }

  if (code === "SUGGEST_BUDGET" || code === "BUDGET_EDR") {
    return {
      currentValue: formatDiagnosisAmount(suggestion.budget, currency),
      recommendedValue: formatDiagnosisAmount(suggestion.suggest_budget, currency)
    };
  }
  if (code === "SUGGEST_BID" || code === "BID_EDR") {
    return {
      currentValue: formatDiagnosisAmount(suggestion.bid, currency),
      recommendedValue: formatDiagnosisAmount(suggestion.suggest_bid, currency)
    };
  }
  if (code === "NOBID_SWITCH") {
    return { recommendedValue: "Maximum Delivery" };
  }
  return {};
}

function diagnosisDetails(
  result: RawDiagnosisResult,
  suggestion: Record<string, unknown>,
  code: string
) {
  const details: string[] = [];
  const adgroupId = readOptionalString(result, ["adgroup_id"]);
  const adId = readOptionalString(suggestion, ["ad_id"]);
  const videoId = readOptionalString(suggestion, ["vid", "video_id"]);
  const pixelId = readOptionalString(suggestion, ["pixel_id"]);
  const pixelCode = readOptionalString(suggestion, ["pixel_code"]);
  const costFloor = readOptionalString(suggestion, ["cost_floor"]);

  if (adgroupId) details.push(`Ad group ID: ${adgroupId}`);
  if (adId) details.push(`Ad ID: ${adId}`);
  if (videoId) details.push(`Video ID: ${videoId}`);
  if (pixelId) details.push(`Pixel ID: ${pixelId}`);
  if (pixelCode) details.push(`Pixel code: ${pixelCode}`);
  if (costFloor && (code === "BID_EDR" || code === "BUDGET_EDR")) details.push(`Cost floor: ${costFloor}`);
  return details;
}

export function normalizeTikTokDiagnosis(payload: unknown, currency = ""): ReportDiagnosis {
  const payloadRecord = asRecord(payload);
  const nestedData = asRecord(payloadRecord?.data);
  const rawResults = payloadRecord?.results ?? nestedData?.results;
  const results = Array.isArray(rawResults) ? (rawResults as RawDiagnosisResult[]) : [];
  const suggestions: ReportDiagnosisSuggestion[] = [];

  for (const result of results) {
    const diagnosis = asRecord(result.diagnosis) || result;
    const diagnosisTime = readOptionalString(diagnosis, ["diagnosis_time"]);
    const rawSuggestions = diagnosis.suggestions ?? diagnosis.suggestion;

    for (const { categoryHint, suggestion } of collectDiagnosisSuggestions(rawSuggestions)) {
      const category = inferDiagnosisCategory(categoryHint, suggestion);
      if (!category) {
        continue;
      }
      const suggestionCode = readString(suggestion, ["issue_suggestion", "suggestion_code", "suggestion_type"]).toUpperCase();
      const suggestionId = readOptionalString(suggestion, ["suggestion_id"]);
      const adgroupId = readOptionalString(result, ["adgroup_id"]);
      const adId = readOptionalString(suggestion, ["ad_id"]);
      const entityName =
        readString(suggestion, ["name", "ad_name"]) ||
        readString(result, ["adgroup_name"]) ||
        (adgroupId ? `Ad group ${adgroupId}` : "TikTok Ads recommendation");
      const details = diagnosisDetails(result, suggestion, suggestionCode);

      suggestions.push({
        source: "tiktok",
        category,
        suggestionCode,
        ...(suggestionId ? { suggestionId } : {}),
        ...(adgroupId ? { adgroupId } : {}),
        ...(adId ? { adId } : {}),
        entityName,
        message: diagnosisMessage(suggestionCode),
        ...diagnosisValues(category, suggestionCode, suggestion, currency),
        ...(readOptionalString(suggestion, ["suggestion_time"]) || diagnosisTime
          ? { suggestionTime: readOptionalString(suggestion, ["suggestion_time"]) || diagnosisTime }
          : {}),
        ...(details.length > 0 ? { details } : {})
      });
    }
  }

  return {
    status: suggestions.length > 0 ? "issues" : "clear",
    suggestions
  };
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
  const rows: RawReportRow[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const response = await callTikTokMcpTool<RawReportPayload>(
      "flat",
      "report_integrated_get",
      buildIntegratedReportRequest(options, page)
    );

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
    const request = buildEntityMetadataRequest(advertiserId, level, batch);
    const response = await callTikTokMcpTool<Record<string, unknown>>("flat", request.tool, request.arguments);
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

async function hasActiveAdgroups(advertiserId: string): Promise<boolean | undefined> {
  for (let page = 1; page <= 20; page += 1) {
    const response = await callTikTokMcpTool<RawReportPayload>(
      "flat",
      "adgroup_get",
      buildActiveAdgroupRequest(advertiserId, page)
    );
    if (response.status !== "connected") {
      return undefined;
    }

    const rows = extractList(response.data);
    if (rows.some((row) => readString(row, ["operation_status"]).toUpperCase() === "ENABLE")) {
      return true;
    }
    if (page >= totalPages(response.data) || rows.length < 1000) {
      return false;
    }
  }
  return undefined;
}

async function fetchTikTokDiagnosis(advertiserId: string, currency: string): Promise<ReportDiagnosis | undefined> {
  const request = buildDiagnosisRequest(advertiserId);
  const response = await callTikTokMcpTool<Record<string, unknown>>("flat", request.tool, request.arguments);
  if (response.status !== "connected") {
    return undefined;
  }

  const diagnosis = normalizeTikTokDiagnosis(response.data, currency);
  if (diagnosis.status !== "clear") {
    return diagnosis;
  }

  const activeAdgroups = await hasActiveAdgroups(advertiserId);
  return activeAdgroups === false ? { status: "no_ads", suggestions: [] } : diagnosis;
}

function applyMetadata(rows: ReportRow[], metadata: Map<string, EntityMetadata>) {
  return rows.map((row) => {
    const item = metadata.get(row.id);
    return item ? { ...row, name: item.name, status: item.status } : row;
  });
}

function baseState(input: GetAdsReportInput): Omit<ReportState, "status"> {
  const range = resolveDateRange(input);
  return {
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
    rows: []
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

function fallbackAccountOption(advertiserId: string): ReportAccountOption {
  return {
    advertiserId,
    advertiserName: `TikTok Ads Account ${advertiserId.slice(-6)}`,
    currency: "USD",
    timezone: "Account timezone"
  };
}

export async function getTikTokAdsReport(input: GetAdsReportInput = {}): Promise<ReportState> {
  let state: Omit<ReportState, "status">;
  let range: ReturnType<typeof resolveDateRange>;
  try {
    state = baseState(input);
    range = resolveDateRange(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid report request.";
    return { ...baseState({}), status: "error", message };
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

    const advertiser = {
      id: advertiserId,
      name: selectedAccount?.advertiserName || `TikTok Ads Account ${advertiserId.slice(-6)}`,
      currency: selectedAccount?.currency || "USD",
      timezone: selectedAccount?.timezone || "Account timezone"
    };
    const diagnosisPromise = fetchTikTokDiagnosis(advertiserId, advertiser.currency).catch(() => undefined);

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

    const [metadata, diagnosis] = await Promise.all([
      fetchEntityMetadata(
        advertiserId,
        state.filters.level,
        current.rows.map((row) => row.id)
      ).catch(() => new Map<string, EntityMetadata>()),
      diagnosisPromise
    ]);
    const rows = applyMetadata(current.rows, metadata);

    return {
      ...state,
      status: "ready",
      advertiser,
      accountOptions,
      totals: current.totals,
      kpis: buildKpis(current.totals, previousTotals),
      trend: current.trend,
      rows,
      ...(diagnosis ? { diagnosis } : {})
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "TikTok Ads reporting failed.";
    return {
      ...state,
      status: "error",
      message: "The report could not be generated. Check the account access and retry.",
      technicalDetail: message
    };
  }
}
