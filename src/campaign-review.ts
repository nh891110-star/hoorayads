import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

import type {
  CampaignAppPromotionType,
  CampaignBudgetMode,
  CampaignCatalogType,
  CampaignObjective,
  CampaignReviewDemoInput,
  CampaignReviewDemoOutcome,
  CampaignReviewHttpAction,
  CampaignReviewInput,
  CampaignSalesDestination,
  CampaignSourceField,
  CampaignSpecialIndustry,
  CampaignType
} from "./campaign-review-contract.js";
import { callTikTokMcpTool, listTikTokAdvertiserAccounts, TikTokToolCallError } from "./tiktok-mcp.js";
import type { TikTokMcpAuthContext, TikTokMcpSurface } from "./tiktok-mcp.js";

export type AdvertiserAccount = {
  advertiserId: string;
  advertiserName: string;
  country: string;
  currency: string;
  status: string;
  timezone: string;
};

export async function listAuthorizedAdvertiserAccounts(
  surface: TikTokMcpSurface,
  authContext: TikTokMcpAuthContext
) {
  if (surface === "progressive") {
    const result = await listTikTokAdvertiserAccounts(surface, authContext);
    if (result.status === "needs_authorization") {
      throw new CampaignReviewError(
        "TIKTOK_AUTH_REQUIRED",
        "Connect a TikTok advertiser account before listing authorized accounts.",
        result.authorizationUrl
      );
    }
    if (result.status === "misconfigured") {
      throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", result.message);
    }
    return result.data.accounts.map((account) => ({
      advertiserId: account.advertiserId,
      advertiserName: account.advertiserName,
      country: account.country,
      currency: account.currency,
      status: account.status,
      timezone: account.timezone
    } satisfies AdvertiserAccount));
  }

  const authResult = await callTikTokMcpTool<AuthAdvertiserResponse>("flat", "auth_advertiser_get", {}, authContext);
  if (authResult.status === "needs_authorization") {
    throw new CampaignReviewError(
      "TIKTOK_AUTH_REQUIRED",
      "Connect a TikTok advertiser account before listing authorized accounts.",
      authResult.authorizationUrl
    );
  }
  if (authResult.status === "misconfigured") {
    throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", authResult.message);
  }

  const authorized = (authResult.data.list ?? []).filter((account) => Boolean(account.advertiser_id));
  if (authorized.length === 0) return [];
  const advertiserIds = authorized.map((account) => account.advertiser_id as string);
  const infoResult = await callTikTokMcpTool<AdvertiserInfoResponse>(
    "flat",
    "advertiser_info_get",
    {
      advertiser_ids: advertiserIds,
      fields: ["advertiser_id", "name", "country", "currency", "status", "timezone"]
    },
    authContext
  );
  if (infoResult.status === "needs_authorization") {
    throw new CampaignReviewError(
      "TIKTOK_AUTH_REQUIRED",
      "Reconnect the TikTok advertiser account before listing authorized accounts.",
      infoResult.authorizationUrl
    );
  }
  if (infoResult.status === "misconfigured") {
    throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", infoResult.message);
  }

  const infoById = new Map(
    (infoResult.data.list ?? [])
      .filter((account) => Boolean(account.advertiser_id))
      .map((account) => [account.advertiser_id as string, account])
  );
  return authorized.map((account) => {
    const advertiserId = account.advertiser_id as string;
    const info = infoById.get(advertiserId);
    return {
      advertiserId,
      advertiserName: info?.name || account.advertiser_name || `Advertiser ${advertiserId.slice(-6)}`,
      country: info?.country || "--",
      currency: info?.currency || "--",
      status: info?.status || "UNKNOWN",
      timezone: info?.timezone || "--"
    } satisfies AdvertiserAccount;
  });
}

export type NormalizedCampaignReview = {
  advertiserId: string;
  campaignName: string;
  objectiveType: CampaignObjective;
  budget?: number;
  budgetMode: CampaignBudgetMode;
  budgetOptimizeOn: boolean;
  salesDestination?: CampaignSalesDestination;
  catalogEnabled: boolean;
  catalogType?: CampaignCatalogType;
  specialIndustries: CampaignSpecialIndustry[];
  specialIndustriesConfirmed: boolean;
  appPromotionType?: CampaignAppPromotionType;
  appId?: string;
  campaignType: CampaignType;
  aiSuggestedFields: CampaignSourceField[];
};

type CampaignExecution = {
  status: "idle" | "creating" | "checking" | "created" | "failed" | "outcome_unknown";
  requestId: string;
  authorizationUrl?: string;
  campaignId?: string;
  createdAt?: string;
  verifiedAt?: string;
  operationStatus?: string;
  secondaryStatus?: string;
  errorCode?: string;
  errorMessage?: string;
  verifiedCampaign?: VerifiedCampaignReadback;
};

type CampaignProposalVersion = {
  campaign: NormalizedCampaignReview;
  createdAt: string;
};

type CampaignProposalRecord = {
  proposalId: string;
  supersedesProposalId?: string;
  currentVersion: number;
  retired: boolean;
  account: AdvertiserAccount;
  versions: Map<number, CampaignProposalVersion>;
  execution: CampaignExecution;
  simulationOutcome?: CampaignReviewDemoOutcome;
  simulationReadyAt?: number;
};

export type CampaignReviewMode = "live" | "demo";

export type CampaignReviewActionTools = {
  revise: string;
  status: string;
  submit: string;
};

export type CampaignReviewState = {
  mode: CampaignReviewMode;
  actionTools: CampaignReviewActionTools;
  proposalId: string;
  supersedesProposalId?: string;
  version: number;
  status: "proposed" | "outdated" | "creating" | "checking" | "created" | "error" | "outcome_unknown";
  readyToCreate: boolean;
  account: AdvertiserAccount & { maskedAdvertiserId: string };
  campaign: NormalizedCampaignReview & { operationStatus: "ENABLE" };
  validationErrors: string[];
  createdAt: string;
  isCurrentVersion: boolean;
  execution?: Omit<CampaignExecution, "requestId">;
};

const LIVE_ACTION_TOOLS: CampaignReviewActionTools = {
  revise: "revise_smartplus_campaign_review",
  status: "get_smartplus_campaign_review_status",
  submit: "create_smartplus_campaign_from_review"
};

const DEMO_ACTION_TOOLS: CampaignReviewActionTools = {
  revise: "revise_smartplus_campaign_review_demo",
  status: "get_smartplus_campaign_review_demo_status",
  submit: "submit_smartplus_campaign_review_demo"
};

type AuthAdvertiserResponse = {
  list?: Array<{ advertiser_id?: string; advertiser_name?: string }>;
};

type AdvertiserInfoResponse = {
  list?: Array<{
    advertiser_id?: string;
    name?: string;
    country?: string;
    currency?: string;
    status?: string;
    timezone?: string;
  }>;
};

type SmartPlusCampaignCreateResponse = {
  campaign_id?: string;
};

type SmartPlusCampaignGetResponse = {
  list?: Array<{
    campaign_id?: string;
    campaign_name?: string;
    objective_type?: string;
    operation_status?: string;
    secondary_status?: string;
    budget?: number | null;
    current_budget?: number | null;
    budget_mode?: string | null;
    budget_optimize_on?: boolean | null;
    catalog_enabled?: boolean | null;
    catalog_type?: string | null;
    sales_destination?: string | null;
    special_industries?: string[] | null;
    create_time?: string | null;
  }>;
};

type SmartPlusCampaignGetItem = NonNullable<SmartPlusCampaignGetResponse["list"]>[number];

export type VerifiedCampaignReadback = {
  campaignId: string;
  campaignName?: string;
  objectiveType?: string;
  operationStatus?: string;
  secondaryStatus?: string;
  budget?: number;
  currentBudget?: number;
  budgetMode?: string;
  budgetOptimizeOn?: boolean;
  catalogEnabled?: boolean;
  catalogType?: string;
  salesDestination?: string;
  specialIndustries?: string[];
  createTime?: string;
};

export class CampaignReviewError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly authorizationUrl?: string
  ) {
    super(message);
  }
}

export function classifyCampaignCreateError(error: unknown) {
  const confirmedFailure = error instanceof CampaignReviewError || error instanceof TikTokToolCallError;
  const reviewError = error instanceof CampaignReviewError
    ? error
    : error instanceof TikTokToolCallError
      ? new CampaignReviewError(`TIKTOK_API_${error.apiCode}`, error.message)
      : new CampaignReviewError(
          "TIKTOK_CAMPAIGN_CREATE_STATUS_UNKNOWN",
          error instanceof Error ? error.message : "Campaign creation status is unknown."
        );
  return { confirmedFailure, reviewError };
}

function numericRequestId() {
  return (BigInt(Date.now()) * 1_000_000n + BigInt(randomInt(0, 1_000_000))).toString();
}

function maskAdvertiserId(advertiserId: string) {
  if (advertiserId.length <= 8) return advertiserId;
  return `${advertiserId.slice(0, 4)}…${advertiserId.slice(-4)}`;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

export function normalizeCampaignInput(input: CampaignReviewInput, advertiserId: string): NormalizedCampaignReview {
  const budgetOptimizeOn = input.budgetOptimizeOn ?? true;
  const budgetMode =
    input.budgetMode ??
    (budgetOptimizeOn ? "BUDGET_MODE_DYNAMIC_DAILY_BUDGET" : "BUDGET_MODE_INFINITE");
  const aiSuggestedFields = new Set(input.aiSuggestedFields ?? []);

  // Defaults are proposed settings too; never present them as if the user supplied them.
  if (input.budgetMode === undefined) aiSuggestedFields.add("budgetMode");
  if (input.budgetOptimizeOn === undefined) aiSuggestedFields.add("budgetOptimizeOn");
  if (["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(input.objectiveType) && input.catalogEnabled === undefined) {
    aiSuggestedFields.add("catalogEnabled");
  }
  if (input.objectiveType === "APP_PROMOTION" && input.campaignType === undefined) {
    aiSuggestedFields.add("campaignType");
  }

  return {
    advertiserId,
    campaignName: input.campaignName.trim(),
    objectiveType: input.objectiveType,
    budget: input.budget,
    budgetMode,
    budgetOptimizeOn,
    salesDestination: input.salesDestination,
    catalogEnabled: input.catalogEnabled ?? false,
    catalogType: input.catalogType,
    specialIndustries: unique(input.specialIndustries ?? []),
    specialIndustriesConfirmed: input.specialIndustriesConfirmed ?? false,
    appPromotionType: input.appPromotionType,
    appId: input.appId?.trim() || undefined,
    campaignType: input.campaignType ?? "REGULAR_CAMPAIGN",
    aiSuggestedFields: [...aiSuggestedFields]
  };
}

export function validateCampaignReview(
  campaign: NormalizedCampaignReview,
  account?: Pick<AdvertiserAccount, "country" | "status">
) {
  const errors: string[] = [];
  const budgetRequired = [
    "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
    "BUDGET_MODE_TOTAL",
    "BUDGET_MODE_DAY"
  ].includes(campaign.budgetMode);

  if (!campaign.campaignName) errors.push("Campaign name is required.");
  if (budgetRequired && !campaign.budget) errors.push("A campaign budget is required for the selected budget type.");
  if (campaign.budgetMode === "BUDGET_MODE_INFINITE" && campaign.budget !== undefined) {
    errors.push("Campaign budget must be omitted when the budget type is Unlimited.");
  }
  if (campaign.budgetOptimizeOn && !["BUDGET_MODE_DYNAMIC_DAILY_BUDGET", "BUDGET_MODE_TOTAL"].includes(campaign.budgetMode)) {
    errors.push("Campaign Budget Optimization supports Dynamic daily or Total budget at Campaign level.");
  }
  if (!campaign.budgetOptimizeOn && !["BUDGET_MODE_INFINITE", "BUDGET_MODE_DAY", "BUDGET_MODE_TOTAL"].includes(campaign.budgetMode)) {
    errors.push("When Campaign Budget Optimization is off, use Unlimited, Daily, or Total budget.");
  }
  if (campaign.objectiveType === "WEB_CONVERSIONS" && !campaign.salesDestination) {
    errors.push("Sales destination is required for Website Conversions.");
  }
  if (campaign.objectiveType !== "WEB_CONVERSIONS" && campaign.salesDestination) {
    errors.push("Sales destination is available only for Website Conversions in this Campaign Review.");
  }
  if (campaign.objectiveType === "APP_PROMOTION" && !campaign.appPromotionType) {
    errors.push("App promotion type is required for App Promotion.");
  }
  if (campaign.objectiveType !== "APP_PROMOTION" && campaign.appPromotionType) {
    errors.push("App promotion type is available only for App Promotion.");
  }
  if (campaign.objectiveType !== "APP_PROMOTION" && campaign.appId) {
    errors.push("App ID is available only for App Promotion.");
  }
  if (campaign.objectiveType !== "APP_PROMOTION" && campaign.campaignType === "IOS14_CAMPAIGN") {
    errors.push("An iOS 14 Dedicated Campaign is available only for App Promotion.");
  }
  if (campaign.campaignType === "IOS14_CAMPAIGN" && !campaign.appId) {
    errors.push("App ID is required for an iOS 14 Dedicated Campaign.");
  }
  if (campaign.catalogEnabled && !["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(campaign.objectiveType)) {
    errors.push("Catalog is supported only for Website Conversions or Lead Generation.");
  }
  if (campaign.objectiveType === "WEB_CONVERSIONS" && campaign.catalogEnabled && !campaign.catalogType) {
    errors.push("Catalog type is required when Catalog is enabled for Website Conversions.");
  }
  if (!campaign.catalogEnabled && campaign.catalogType) {
    errors.push("Catalog type must be omitted when Catalog is not used.");
  }
  if (campaign.salesDestination === "APP" && (!campaign.catalogEnabled || !campaign.catalogType)) {
    errors.push("App sales destination requires Catalog and a supported Catalog type.");
  }
  if (!campaign.specialIndustriesConfirmed) {
    errors.push("Special ad category must be confirmed before campaign creation.");
  }
  if (campaign.specialIndustries.length > 0 && account && !["US", "CA"].includes(account.country)) {
    errors.push("Special ad categories are supported only for eligible US or Canada advertisers.");
  }
  return errors;
}

export function buildSmartPlusCampaignPayload(campaign: NormalizedCampaignReview, requestId: string) {
  const payload: Record<string, unknown> = {
    advertiser_id: campaign.advertiserId,
    request_id: requestId,
    campaign_name: campaign.campaignName,
    objective_type: campaign.objectiveType,
    operation_status: "ENABLE",
    budget_optimize_on: campaign.budgetOptimizeOn,
    budget_mode: campaign.budgetMode
  };

  if (campaign.budget !== undefined) payload.budget = campaign.budget;
  if (campaign.salesDestination) payload.sales_destination = campaign.salesDestination;
  if (["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(campaign.objectiveType)) {
    payload.catalog_enabled = campaign.catalogEnabled;
  }
  if (campaign.catalogEnabled && campaign.catalogType) payload.catalog_type = campaign.catalogType;
  if (campaign.specialIndustries.length > 0) payload.special_industries = campaign.specialIndustries;
  if (campaign.objectiveType === "APP_PROMOTION") {
    payload.campaign_type = campaign.campaignType;
    if (campaign.appPromotionType) payload.app_promotion_type = campaign.appPromotionType;
    if (campaign.appId) payload.app_id = campaign.appId;
  }

  return payload;
}

export function normalizeCampaignReadback(item: SmartPlusCampaignGetItem): VerifiedCampaignReadback {
  return {
    campaignId: item.campaign_id || "",
    ...(item.campaign_name !== undefined ? { campaignName: item.campaign_name } : {}),
    ...(item.objective_type !== undefined ? { objectiveType: item.objective_type } : {}),
    ...(item.operation_status !== undefined ? { operationStatus: item.operation_status } : {}),
    ...(item.secondary_status !== undefined ? { secondaryStatus: item.secondary_status } : {}),
    ...(item.budget != null ? { budget: item.budget } : {}),
    ...(item.current_budget != null ? { currentBudget: item.current_budget } : {}),
    ...(item.budget_mode != null ? { budgetMode: item.budget_mode } : {}),
    ...(item.budget_optimize_on != null ? { budgetOptimizeOn: item.budget_optimize_on } : {}),
    ...(item.catalog_enabled != null ? { catalogEnabled: item.catalog_enabled } : {}),
    ...(item.catalog_type != null ? { catalogType: item.catalog_type } : {}),
    ...(item.sales_destination != null ? { salesDestination: item.sales_destination } : {}),
    ...(item.special_industries != null ? { specialIndustries: [...item.special_industries] } : {}),
    ...(item.create_time != null ? { createTime: item.create_time } : {})
  };
}

export function validateCampaignReadback(campaign: NormalizedCampaignReview, item: SmartPlusCampaignGetItem) {
  const errors: string[] = [];
  if (!item.campaign_id) errors.push("TikTok read-back did not return a Campaign ID.");
  if (!item.campaign_name) errors.push("TikTok read-back did not return the Campaign name.");
  else if (item.campaign_name !== campaign.campaignName) errors.push("TikTok read-back returned a different Campaign name.");
  if (!item.objective_type) errors.push("TikTok read-back did not return the Campaign objective.");
  else if (item.objective_type !== campaign.objectiveType) errors.push("TikTok read-back returned a different Campaign objective.");
  if (!item.operation_status) errors.push("TikTok read-back did not return the Campaign operation status.");
  else if (item.operation_status !== "ENABLE") errors.push("TikTok read-back did not confirm Active operation status.");
  if (item.budget != null && campaign.budget !== undefined && Math.abs(item.budget - campaign.budget) > 0.01) {
    errors.push("TikTok read-back returned a different Campaign budget.");
  }
  if (item.budget_mode != null && item.budget_mode !== campaign.budgetMode) {
    errors.push("TikTok read-back returned a different budget type.");
  }
  if (item.budget_optimize_on != null && item.budget_optimize_on !== campaign.budgetOptimizeOn) {
    errors.push("TikTok read-back returned a different Campaign Budget Optimization setting.");
  }
  if (item.catalog_enabled != null && item.catalog_enabled !== campaign.catalogEnabled) {
    errors.push("TikTok read-back returned a different Catalog setting.");
  }
  if (item.catalog_type != null && item.catalog_type !== campaign.catalogType) {
    errors.push("TikTok read-back returned a different Catalog type.");
  }
  if (item.sales_destination != null && item.sales_destination !== campaign.salesDestination) {
    errors.push("TikTok read-back returned a different sales destination.");
  }
  if (item.special_industries != null) {
    const expected = [...campaign.specialIndustries].sort();
    const returned = [...item.special_industries].sort();
    if (JSON.stringify(returned) !== JSON.stringify(expected)) {
      errors.push("TikTok read-back returned different special ad categories.");
    }
  }
  return errors;
}

export function findExplicitAdvertiserSelection<T>(
  accounts: T[],
  input: Pick<CampaignReviewInput, "advertiserId" | "advertiserName">,
  getId: (account: T) => string | undefined,
  getName: (account: T) => string | undefined
) {
  const advertiserName = input.advertiserName?.trim().toLowerCase();
  const hasAdvertiserSelection = Boolean(input.advertiserId || advertiserName);
  const selected = input.advertiserId
    ? accounts.find((account) => getId(account) === input.advertiserId)
    : advertiserName
      ? accounts.find((account) => getName(account)?.trim().toLowerCase() === advertiserName)
      : undefined;

  return { hasAdvertiserSelection, selected };
}

async function resolveAdvertiserAccount(
  input: Pick<CampaignReviewInput, "advertiserId" | "advertiserName">,
  surface: TikTokMcpSurface,
  authContext: TikTokMcpAuthContext
) {
  if (surface === "progressive") {
    const accountResult = await listTikTokAdvertiserAccounts(surface, authContext);
    if (accountResult.status === "needs_authorization") {
      throw new CampaignReviewError(
        "TIKTOK_AUTH_REQUIRED",
        "Connect a TikTok advertiser account before reviewing this campaign.",
        accountResult.authorizationUrl
      );
    }
    if (accountResult.status === "misconfigured") {
      throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", accountResult.message);
    }

    const accounts = accountResult.data.accounts;
    const { hasAdvertiserSelection, selected } = findExplicitAdvertiserSelection(
      accounts,
      input,
      (account) => account.advertiserId,
      (account) => account.advertiserName
    );

    if (!selected) {
      throw new CampaignReviewError(
        !hasAdvertiserSelection ? "ADVERTISER_SELECTION_REQUIRED" : "ADVERTISER_NOT_AUTHORIZED",
        !hasAdvertiserSelection
          ? "Choose one authorized advertiser account before reviewing the campaign."
          : "The selected advertiser account is not authorized for this TikTok connection."
      );
    }

    return {
      advertiserId: selected.advertiserId,
      advertiserName: selected.advertiserName,
      country: selected.country,
      currency: selected.currency,
      status: selected.status,
      timezone: selected.timezone
    } satisfies AdvertiserAccount;
  }

  const authResult = await callTikTokMcpTool<AuthAdvertiserResponse>("flat", "auth_advertiser_get", {}, authContext);
  if (authResult.status === "needs_authorization") {
    throw new CampaignReviewError(
      "TIKTOK_AUTH_REQUIRED",
      "Connect a TikTok advertiser account before reviewing this campaign.",
      authResult.authorizationUrl
    );
  }
  if (authResult.status === "misconfigured") {
    throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", authResult.message);
  }

  const accounts = authResult.data.list ?? [];
  const { hasAdvertiserSelection, selected } = findExplicitAdvertiserSelection(
    accounts,
    input,
    (account) => account.advertiser_id,
    (account) => account.advertiser_name
  );

  if (!selected?.advertiser_id) {
    throw new CampaignReviewError(
      !hasAdvertiserSelection ? "ADVERTISER_SELECTION_REQUIRED" : "ADVERTISER_NOT_AUTHORIZED",
      !hasAdvertiserSelection
        ? "Choose one authorized advertiser account before reviewing the campaign."
        : "The selected advertiser account is not authorized for this TikTok connection."
    );
  }

  const infoResult = await callTikTokMcpTool<AdvertiserInfoResponse>(
    "flat",
    "advertiser_info_get",
    {
      advertiser_ids: [selected.advertiser_id],
      fields: ["advertiser_id", "name", "country", "currency", "status", "timezone"]
    },
    authContext
  );
  if (infoResult.status === "needs_authorization") {
    throw new CampaignReviewError(
      "TIKTOK_AUTH_REQUIRED",
      "Reconnect the TikTok advertiser account before reviewing this campaign.",
      infoResult.authorizationUrl
    );
  }
  if (infoResult.status === "misconfigured") {
    throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", infoResult.message);
  }

  const info = infoResult.data.list?.find((item) => item.advertiser_id === selected.advertiser_id);
  if (!info) {
    throw new CampaignReviewError("ADVERTISER_LOOKUP_FAILED", "TikTok did not return details for the selected advertiser account.");
  }

  return {
    advertiserId: selected.advertiser_id,
    advertiserName: info.name || selected.advertiser_name || "TikTok advertiser",
    country: info.country || "--",
    currency: info.currency || "USD",
    status: info.status || "UNKNOWN",
    timezone: info.timezone || "--"
  } satisfies AdvertiserAccount;
}

function assertWriteGuard() {
  if ((process.env.CAMPAIGN_REVIEW_WRITE_MODE || "off") !== "campaign_only") {
    throw new CampaignReviewError(
      "CAMPAIGN_WRITE_DISABLED",
      "Campaign creation is disabled on this server. The proposal remains available for review."
    );
  }
}

function stateFor(
  record: CampaignProposalRecord,
  requestedVersion = record.currentVersion,
  mode: CampaignReviewMode = "live"
): CampaignReviewState {
  const version = record.versions.get(requestedVersion) || record.versions.get(record.currentVersion);
  if (!version) throw new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found.");
  const isCurrentVersion = requestedVersion === record.currentVersion && !record.retired;
  const validationErrors = validateCampaignReview(version.campaign, record.account);
  let status: CampaignReviewState["status"] = isCurrentVersion ? "proposed" : "outdated";

  if (isCurrentVersion) {
    if (record.execution.status === "creating") status = "creating";
    if (record.execution.status === "checking") status = "checking";
    if (record.execution.status === "created") status = "created";
    if (record.execution.status === "failed") status = "error";
    if (record.execution.status === "outcome_unknown") status = "outcome_unknown";
  }

  const { requestId: _requestId, ...safeExecution } = record.execution;
  return {
    mode,
    actionTools: mode === "demo" ? DEMO_ACTION_TOOLS : LIVE_ACTION_TOOLS,
    proposalId: record.proposalId,
    ...(record.supersedesProposalId ? { supersedesProposalId: record.supersedesProposalId } : {}),
    version: requestedVersion,
    status,
    readyToCreate: isCurrentVersion && validationErrors.length === 0 && record.execution.status === "idle",
    account: {
      ...record.account,
      maskedAdvertiserId: maskAdvertiserId(record.account.advertiserId)
    },
    campaign: {
      ...version.campaign,
      operationStatus: "ENABLE"
    },
    validationErrors,
    createdAt: version.createdAt,
    isCurrentVersion,
    ...(record.execution.status === "idle" && isCurrentVersion ? {} : { execution: safeExecution })
  };
}

function createErrorState(
  error: unknown,
  mode: CampaignReviewMode = "live",
  input?: CampaignReviewInput | CampaignReviewDemoInput
): CampaignReviewState {
  const reviewError = error instanceof CampaignReviewError ? error : new CampaignReviewError("CAMPAIGN_REVIEW_ERROR", error instanceof Error ? error.message : "Campaign review failed.");
  const now = new Date().toISOString();
  const advertiserId = input?.advertiserId?.trim() || "";
  const campaign = input
    ? normalizeCampaignInput(input, advertiserId)
    : {
        advertiserId: "",
        campaignName: "Campaign review unavailable",
        objectiveType: "WEB_CONVERSIONS" as const,
        budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET" as const,
        budgetOptimizeOn: true,
        catalogEnabled: false,
        specialIndustries: [],
        specialIndustriesConfirmed: false,
        campaignType: "REGULAR_CAMPAIGN" as const,
        aiSuggestedFields: []
      };
  return {
    mode,
    actionTools: mode === "demo" ? DEMO_ACTION_TOOLS : LIVE_ACTION_TOOLS,
    proposalId: "",
    version: 1,
    status: "error",
    readyToCreate: false,
    account: {
      advertiserId,
      advertiserName: input?.advertiserName?.trim() || "Advertiser account required",
      maskedAdvertiserId: advertiserId ? maskAdvertiserId(advertiserId) : "--",
      country: "--",
      currency: "USD",
      status: "UNKNOWN",
      timezone: "--"
    },
    campaign: {
      ...campaign,
      operationStatus: "ENABLE"
    },
    validationErrors: [reviewError.message],
    createdAt: now,
    isCurrentVersion: true,
    execution: {
      status: "failed",
      authorizationUrl: reviewError.authorizationUrl,
      errorCode: reviewError.code,
      errorMessage: reviewError.message
    }
  };
}

export function createCampaignReviewStore(
  options: {
    authContext?: TikTokMcpAuthContext;
    mode?: CampaignReviewMode;
    surface?: TikTokMcpSurface;
  } = {}
) {
  const mode = options.mode ?? "live";
  const surface = options.surface ?? "flat";
  const authContext = options.authContext ?? {};
  const proposals = new Map<string, CampaignProposalRecord>();
  let activeProposalId: string | undefined;

  const demoAccount = (input: Pick<CampaignReviewInput, "advertiserId" | "advertiserName">): AdvertiserAccount => ({
    advertiserId: input.advertiserId || "7481826080479870993",
    advertiserName: input.advertiserName?.trim() || "Education Coaching0315",
    country: "US",
    currency: "USD",
    status: "STATUS_ENABLE",
    timezone: "America/Los_Angeles"
  });

  const prepare = async (input: CampaignReviewInput | CampaignReviewDemoInput) => {
    try {
      const account = mode === "demo" ? demoAccount(input) : await resolveAdvertiserAccount(input, surface, authContext);
      const campaign = normalizeCampaignInput(input, account.advertiserId);
      const activeProposal = activeProposalId ? proposals.get(activeProposalId) : undefined;
      const supersedesProposalId = activeProposal && ["idle", "failed"].includes(activeProposal.execution.status)
        ? activeProposal.proposalId
        : undefined;
      const record: CampaignProposalRecord = {
        proposalId: randomUUID(),
        ...(supersedesProposalId ? { supersedesProposalId } : {}),
        currentVersion: 1,
        retired: false,
        account,
        versions: new Map([[1, { campaign, createdAt: new Date().toISOString() }]]),
        execution: { status: "idle", requestId: numericRequestId() },
        ...(mode === "demo"
          ? { simulationOutcome: (input as CampaignReviewDemoInput).simulationOutcome ?? "SUCCESS" }
          : {})
      };
      if (activeProposal && ["idle", "failed"].includes(activeProposal.execution.status)) {
        activeProposal.retired = true;
      }
      proposals.set(record.proposalId, record);
      activeProposalId = record.proposalId;
      return stateFor(record, record.currentVersion, mode);
    } catch (error) {
      return createErrorState(error, mode, input);
    }
  };

  const revise = (proposalId: string, expectedVersion: number, input: Omit<CampaignReviewInput, "advertiserId" | "advertiserName">) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    if (record.retired) return stateFor(record, expectedVersion, mode);
    if (expectedVersion !== record.currentVersion) return stateFor(record, expectedVersion, mode);
    if (record.execution.status === "creating" || record.execution.status === "checking" || record.execution.status === "created") {
      return stateFor(record, record.currentVersion, mode);
    }

    const campaign = normalizeCampaignInput(
      {
        ...input,
        advertiserId: record.account.advertiserId
      },
      record.account.advertiserId
    );
    const nextVersion = record.currentVersion + 1;
    record.currentVersion = nextVersion;
    record.versions.set(nextVersion, { campaign, createdAt: new Date().toISOString() });
    record.execution = { status: "idle", requestId: numericRequestId() };
    return stateFor(record, record.currentVersion, mode);
  };

  const completeDemoSubmission = (record: CampaignProposalRecord) => {
    if (mode !== "demo" || !record.simulationReadyAt || Date.now() < record.simulationReadyAt) return;
    record.simulationReadyAt = undefined;
    if (record.simulationOutcome === "SUBMISSION_ERROR") {
      record.execution = {
        ...record.execution,
        status: "failed",
        errorCode: "DEMO_SUBMISSION_ERROR",
        errorMessage: "The simulated submission failed. No TikTok Campaign was created."
      };
      return;
    }
    if (record.simulationOutcome === "OUTCOME_UNKNOWN") {
      record.execution = {
        ...record.execution,
        status: "outcome_unknown",
        errorCode: "DEMO_OUTCOME_UNKNOWN",
        errorMessage: "The simulated result could not be confirmed. No TikTok write was attempted."
      };
      return;
    }
    record.execution = {
      ...record.execution,
      status: "created",
      campaignId: `demo-${record.proposalId.slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      operationStatus: "ENABLE",
      secondaryStatus: "DEMO_ONLY",
      errorCode: undefined,
      errorMessage: undefined
    };
  };

  const getStatus = async (
    proposalId: string,
    expectedVersion: number,
    requestAuthContext: TikTokMcpAuthContext = authContext
  ) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    completeDemoSubmission(record);
    if (mode === "demo") return stateFor(record, expectedVersion, mode);
    if (expectedVersion === record.currentVersion && record.execution.status === "outcome_unknown") {
      try {
        const created = await reconcile(record, record.execution.campaignId, requestAuthContext);
        const campaign = record.versions.get(record.currentVersion)?.campaign;
        if (created?.campaign_id && campaign) {
          const readbackErrors = validateCampaignReadback(campaign, created);
          const verifiedCampaign = normalizeCampaignReadback(created);
          record.execution = readbackErrors.length === 0
            ? {
                ...record.execution,
                status: "created",
                campaignId: created.campaign_id,
                createdAt: created.create_time || new Date().toISOString(),
                verifiedAt: new Date().toISOString(),
                operationStatus: created.operation_status,
                secondaryStatus: created.secondary_status,
                verifiedCampaign,
                errorCode: undefined,
                errorMessage: undefined
              }
            : {
                ...record.execution,
                status: "outcome_unknown",
                campaignId: created.campaign_id,
                operationStatus: created.operation_status,
                secondaryStatus: created.secondary_status,
                verifiedCampaign,
                errorCode: "CAMPAIGN_READBACK_MISMATCH",
                errorMessage: readbackErrors.join(" ")
              };
        }
      } catch {
        // Keep outcome_unknown until TikTok can be reconciled without risking a duplicate write.
      }
    }
    return stateFor(record, expectedVersion, mode);
  };

  const reconcile = async (
    record: CampaignProposalRecord,
    campaignId?: string,
    requestAuthContext: TikTokMcpAuthContext = authContext
  ) => {
    const campaign = record.versions.get(record.currentVersion)?.campaign;
    if (!campaign) throw new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found.");
    const getResult = await callTikTokMcpTool<SmartPlusCampaignGetResponse>(surface, "smart_plus_campaign_get", {
      advertiser_id: campaign.advertiserId,
      fields: [
        "campaign_id",
        "campaign_name",
        "objective_type",
        "operation_status",
        "secondary_status",
        "budget",
        "current_budget",
        "budget_mode",
        "budget_optimize_on",
        "catalog_enabled",
        "catalog_type",
        "sales_destination",
        "special_industries",
        "create_time"
      ],
      filtering: campaignId ? { campaign_ids: [campaignId] } : { campaign_name: campaign.campaignName },
      page: 1,
      page_size: 20
    }, requestAuthContext);
    if (getResult.status !== "connected") return undefined;
    return getResult.data.list?.find((item) => (campaignId ? item.campaign_id === campaignId : item.campaign_name === campaign.campaignName));
  };

  const create = async (
    proposalId: string,
    expectedVersion: number,
    requestAuthContext: TikTokMcpAuthContext = authContext
  ) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    if (record.retired) return stateFor(record, expectedVersion, mode);
    if (expectedVersion !== record.currentVersion) return stateFor(record, expectedVersion, mode);
    if (
      record.execution.status === "created" ||
      record.execution.status === "creating" ||
      record.execution.status === "checking" ||
      record.execution.status === "outcome_unknown"
    ) {
      return stateFor(record, record.currentVersion, mode);
    }

    const version = record.versions.get(record.currentVersion);
    if (!version) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    const errors = validateCampaignReview(version.campaign, record.account);
    if (errors.length > 0) {
      record.execution = {
        ...record.execution,
        status: "failed",
        errorCode: "CAMPAIGN_REVIEW_VALIDATION_FAILED",
        errorMessage: errors.join(" ")
      };
      return stateFor(record, record.currentVersion, mode);
    }

    if (mode === "demo") {
      record.execution = {
        ...record.execution,
        status: "creating",
        errorCode: undefined,
        errorMessage: undefined
      };
      record.simulationReadyAt = Date.now() + 900;
      return stateFor(record, record.currentVersion, mode);
    }

    try {
      assertWriteGuard();
      const authorizedAccount = await resolveAdvertiserAccount(
        { advertiserId: version.campaign.advertiserId },
        surface,
        requestAuthContext
      );
      if (authorizedAccount.advertiserId !== record.account.advertiserId) {
        throw new CampaignReviewError(
          "ADVERTISER_AUTHORIZATION_CHANGED",
          "The approved advertiser account no longer matches this TikTok authorization. Review the campaign again."
        );
      }
      record.execution = { ...record.execution, status: "creating", errorCode: undefined, errorMessage: undefined };
      const createResult = await callTikTokMcpTool<SmartPlusCampaignCreateResponse>(
        surface,
        "smart_plus_campaign_create",
        buildSmartPlusCampaignPayload(version.campaign, record.execution.requestId),
        requestAuthContext
      );
      if (createResult.status === "needs_authorization") {
        throw new CampaignReviewError("TIKTOK_AUTH_REQUIRED", "Reconnect the TikTok advertiser account before creating this campaign.", createResult.authorizationUrl);
      }
      if (createResult.status === "misconfigured") {
        throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", createResult.message);
      }

      const campaignId = createResult.data.campaign_id;
      record.execution = { ...record.execution, status: "checking", campaignId };
      const created = await reconcile(record, campaignId, requestAuthContext);
      if (!created?.campaign_id) {
        record.execution = {
          ...record.execution,
          status: "outcome_unknown",
          errorCode: "CAMPAIGN_RECONCILIATION_PENDING",
          errorMessage: "TikTok accepted the create request, but the campaign could not yet be verified. Check status before retrying."
        };
        return stateFor(record, record.currentVersion, mode);
      }
      const verifiedCampaign = normalizeCampaignReadback(created);
      const readbackErrors = validateCampaignReadback(version.campaign, created);
      if (readbackErrors.length > 0) {
        record.execution = {
          ...record.execution,
          status: "outcome_unknown",
          campaignId: created.campaign_id,
          operationStatus: created.operation_status,
          secondaryStatus: created.secondary_status,
          verifiedCampaign,
          errorCode: "CAMPAIGN_READBACK_MISMATCH",
          errorMessage: readbackErrors.join(" ")
        };
        return stateFor(record, record.currentVersion, mode);
      }

      record.execution = {
        ...record.execution,
        status: "created",
        campaignId: created.campaign_id,
        createdAt: created.create_time || new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        operationStatus: created.operation_status,
        secondaryStatus: created.secondary_status,
        verifiedCampaign,
        errorCode: undefined,
        errorMessage: undefined
      };
      return stateFor(record, record.currentVersion, mode);
    } catch (error) {
      const { confirmedFailure, reviewError } = classifyCampaignCreateError(error);
      record.execution = {
        ...record.execution,
        status: confirmedFailure ? "failed" : "outcome_unknown",
        authorizationUrl: reviewError.authorizationUrl,
        errorCode: reviewError.code,
        errorMessage:
          confirmedFailure
            ? reviewError.message
            : "The create request may have reached TikTok, but its result was not returned. The app will check status before allowing another write."
      };
      return stateFor(record, record.currentVersion, mode);
    }
  };

  const retire = (proposalId: string) => {
    const record = proposals.get(proposalId);
    if (!record || !["idle", "failed"].includes(record.execution.status)) return false;
    record.retired = true;
    if (activeProposalId === proposalId) activeProposalId = undefined;
    return true;
  };

  return { prepare, revise, getStatus, create, retire };
}

export type CampaignReviewStore = ReturnType<typeof createCampaignReviewStore>;

type SharedCampaignReviewStore = {
  lastAccessedAt: number;
  store: CampaignReviewStore;
};

const SHARED_STORE_TTL_MS = 6 * 60 * 60 * 1_000;
const SHARED_STORE_LIMIT = 500;
const sharedLiveStores = new Map<string, SharedCampaignReviewStore>();
const proposalOwners = new Map<string, SharedCampaignReviewStore>();
const activeProposalByAdvertiser = new Map<string, string>();
const proposalActionTokens = new Map<string, { token: string; expiresAt: number }>();

function pruneSharedLiveStores(now: number) {
  for (const [key, entry] of sharedLiveStores) {
    if (now - entry.lastAccessedAt > SHARED_STORE_TTL_MS) sharedLiveStores.delete(key);
  }

  if (sharedLiveStores.size <= SHARED_STORE_LIMIT) return;
  const oldest = [...sharedLiveStores.entries()]
    .sort(([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt)
    .slice(0, sharedLiveStores.size - SHARED_STORE_LIMIT);
  for (const [key] of oldest) sharedLiveStores.delete(key);
}

function sharedStoreKey(authContext: TikTokMcpAuthContext, surface: TikTokMcpSurface) {
  const bearerToken = authContext.authorization?.trim().replace(/^Bearer\s+/i, "");
  if (!bearerToken) return undefined;
  const tokenDigest = createHash("sha256").update(bearerToken).digest("base64url");
  return `${surface}:${tokenDigest}`;
}

/**
 * ChatGPT may initialize a new MCP server for a later app action. Keep proposal
 * state at service scope while isolating it by the delegated TikTok bearer.
 */
export function getSharedCampaignReviewStore(
  authContext: TikTokMcpAuthContext = {},
  surface: TikTokMcpSurface = "flat"
) {
  const key = sharedStoreKey(authContext, surface);
  if (!key) return createCampaignReviewStore({ authContext, surface });

  const now = Date.now();
  pruneSharedLiveStores(now);
  const existing = sharedLiveStores.get(key);
  if (existing) {
    existing.lastAccessedAt = now;
    return existing.store;
  }

  const store = createCampaignReviewStore({ authContext, surface });
  sharedLiveStores.set(key, { lastAccessedAt: now, store });
  return store;
}

function pruneProposalOwners(now: number) {
  for (const [proposalId, entry] of proposalOwners) {
    if (now - entry.lastAccessedAt <= SHARED_STORE_TTL_MS) continue;
    proposalOwners.delete(proposalId);
    proposalActionTokens.delete(proposalId);
    for (const [advertiserId, activeProposalId] of activeProposalByAdvertiser) {
      if (activeProposalId === proposalId) activeProposalByAdvertiser.delete(advertiserId);
    }
  }

  if (proposalOwners.size <= SHARED_STORE_LIMIT) return;
  const oldest = [...proposalOwners.entries()]
    .sort(([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt)
    .slice(0, proposalOwners.size - SHARED_STORE_LIMIT);
  for (const [proposalId] of oldest) {
    proposalOwners.delete(proposalId);
    proposalActionTokens.delete(proposalId);
  }
}

export function registerCampaignReviewProposal(
  store: CampaignReviewStore,
  state: CampaignReviewState
) {
  if (!state.proposalId || state.status === "error" || state.account.status === "UNKNOWN") return state;

  const now = Date.now();
  pruneProposalOwners(now);
  const advertiserId = state.account.advertiserId;
  const priorProposalId = activeProposalByAdvertiser.get(advertiserId);
  if (priorProposalId && priorProposalId !== state.proposalId) {
    proposalOwners.get(priorProposalId)?.store.retire(priorProposalId);
  }

  proposalOwners.set(state.proposalId, { lastAccessedAt: now, store });
  activeProposalByAdvertiser.set(advertiserId, state.proposalId);
  return priorProposalId && priorProposalId !== state.proposalId
    ? { ...state, supersedesProposalId: priorProposalId }
    : state;
}

export function getCampaignReviewStoreForProposal(
  proposalId: string,
  fallbackStore: CampaignReviewStore
) {
  const now = Date.now();
  pruneProposalOwners(now);
  const owner = proposalOwners.get(proposalId);
  if (!owner) return fallbackStore;
  owner.lastAccessedAt = now;
  return owner.store;
}

export function getCampaignReviewActionToken(proposalId: string) {
  const owner = proposalOwners.get(proposalId);
  if (!owner) throw new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found.");
  const now = Date.now();
  const existing = proposalActionTokens.get(proposalId);
  if (existing && existing.expiresAt > now) return existing.token;
  const token = `${randomUUID()}${randomUUID()}`.replaceAll("-", "");
  proposalActionTokens.set(proposalId, { token, expiresAt: now + SHARED_STORE_TTL_MS });
  return token;
}

function verifyCampaignReviewActionToken(proposalId: string, token: string) {
  const stored = proposalActionTokens.get(proposalId);
  if (!stored || stored.expiresAt <= Date.now()) return false;
  const providedBuffer = Buffer.from(token);
  const storedBuffer = Buffer.from(stored.token);
  return providedBuffer.length === storedBuffer.length && timingSafeEqual(providedBuffer, storedBuffer);
}

export async function executeCampaignReviewHttpAction(
  action: CampaignReviewHttpAction,
  token: string
) {
  if (!verifyCampaignReviewActionToken(action.proposalId, token)) {
    throw new CampaignReviewError("INVALID_ACTION_TOKEN", "This Campaign Review action has expired. Generate a new review card.");
  }
  const owner = proposalOwners.get(action.proposalId);
  if (!owner) throw new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found.");
  owner.lastAccessedAt = Date.now();

  if (action.action === "status") {
    return owner.store.getStatus(action.proposalId, action.expectedVersion);
  }
  if (action.action === "submit") {
    return owner.store.create(action.proposalId, action.expectedVersion);
  }
  const { action: _action, proposalId, expectedVersion, ...input } = action;
  return owner.store.revise(
    proposalId,
    expectedVersion,
    input as Omit<CampaignReviewInput, "advertiserId" | "advertiserName">
  );
}

export function resetSharedCampaignReviewStoresForTests() {
  sharedLiveStores.clear();
  proposalOwners.clear();
  activeProposalByAdvertiser.clear();
  proposalActionTokens.clear();
}
