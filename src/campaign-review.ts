import { randomInt, randomUUID } from "node:crypto";

import type {
  CampaignAppPromotionType,
  CampaignBudgetMode,
  CampaignCatalogType,
  CampaignObjective,
  CampaignReviewDemoInput,
  CampaignReviewDemoOutcome,
  CampaignReviewInput,
  CampaignSalesDestination,
  CampaignSourceField,
  CampaignSpecialIndustry,
  CampaignType
} from "./campaign-review-contract.js";
import { callTikTokMcpTool, listTikTokAdvertiserAccounts } from "./tiktok-mcp.js";
import type { TikTokMcpAuthContext, TikTokMcpSurface } from "./tiktok-mcp.js";

type AdvertiserAccount = {
  advertiserId: string;
  advertiserName: string;
  country: string;
  currency: string;
  status: string;
  timezone: string;
};

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
};

type CampaignProposalVersion = {
  campaign: NormalizedCampaignReview;
  createdAt: string;
};

type CampaignProposalRecord = {
  proposalId: string;
  currentVersion: number;
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
    budget?: number;
    current_budget?: number;
    budget_mode?: string;
    budget_optimize_on?: boolean;
    catalog_enabled?: boolean;
    catalog_type?: string;
    sales_destination?: string;
    special_industries?: string[];
    create_time?: string;
  }>;
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
    aiSuggestedFields: unique(input.aiSuggestedFields ?? [])
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
  if (campaign.campaignType === "IOS14_CAMPAIGN" && !campaign.appId) {
    errors.push("App ID is required for an iOS 14 Dedicated Campaign.");
  }
  if (campaign.catalogEnabled && !["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(campaign.objectiveType)) {
    errors.push("Catalog is supported only for Website Conversions or Lead Generation.");
  }
  if (campaign.objectiveType === "WEB_CONVERSIONS" && campaign.catalogEnabled && !campaign.catalogType) {
    errors.push("Catalog type is required when Catalog is enabled for Website Conversions.");
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
  if (account?.status && account.status !== "STATUS_ENABLE") {
    errors.push("The selected advertiser account is not enabled.");
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
    budget_mode: campaign.budgetMode,
    campaign_type: campaign.campaignType
  };

  if (campaign.budget !== undefined) payload.budget = campaign.budget;
  if (campaign.salesDestination) payload.sales_destination = campaign.salesDestination;
  if (["WEB_CONVERSIONS", "LEAD_GENERATION"].includes(campaign.objectiveType)) {
    payload.catalog_enabled = campaign.catalogEnabled;
  }
  if (campaign.catalogEnabled && campaign.catalogType) payload.catalog_type = campaign.catalogType;
  if (campaign.specialIndustries.length > 0) payload.special_industries = campaign.specialIndustries;
  if (campaign.appPromotionType) payload.app_promotion_type = campaign.appPromotionType;
  if (campaign.appId) payload.app_id = campaign.appId;

  return payload;
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
        "Connect TikTok Ads before reviewing a campaign.",
        accountResult.authorizationUrl
      );
    }
    if (accountResult.status === "misconfigured") {
      throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", accountResult.message);
    }

    const accounts = accountResult.data.accounts;
    const advertiserName = input.advertiserName?.trim().toLowerCase();
    const selected = input.advertiserId
      ? accounts.find((account) => account.advertiserId === input.advertiserId)
      : advertiserName
        ? accounts.find((account) => account.advertiserName.trim().toLowerCase() === advertiserName)
        : accounts.length === 1
          ? accounts[0]
          : undefined;

    if (!selected) {
      throw new CampaignReviewError(
        accounts.length > 1 ? "ADVERTISER_SELECTION_REQUIRED" : "ADVERTISER_NOT_AUTHORIZED",
        accounts.length > 1
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
      "Connect TikTok Ads before reviewing a campaign.",
      authResult.authorizationUrl
    );
  }
  if (authResult.status === "misconfigured") {
    throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", authResult.message);
  }

  const accounts = authResult.data.list ?? [];
  const advertiserName = input.advertiserName?.trim().toLowerCase();
  const selected = input.advertiserId
    ? accounts.find((account) => account.advertiser_id === input.advertiserId)
    : advertiserName
      ? accounts.find((account) => account.advertiser_name?.trim().toLowerCase() === advertiserName)
      : accounts.length === 1
        ? accounts[0]
        : undefined;

  if (!selected?.advertiser_id) {
    throw new CampaignReviewError(
      accounts.length > 1 ? "ADVERTISER_SELECTION_REQUIRED" : "ADVERTISER_NOT_AUTHORIZED",
      accounts.length > 1
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
      "Reconnect TikTok Ads before reviewing the campaign.",
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
  const isCurrentVersion = requestedVersion === record.currentVersion;
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

function createErrorState(error: unknown, mode: CampaignReviewMode = "live"): CampaignReviewState {
  const reviewError = error instanceof CampaignReviewError ? error : new CampaignReviewError("CAMPAIGN_REVIEW_ERROR", error instanceof Error ? error.message : "Campaign review failed.");
  const now = new Date().toISOString();
  return {
    mode,
    actionTools: mode === "demo" ? DEMO_ACTION_TOOLS : LIVE_ACTION_TOOLS,
    proposalId: "",
    version: 1,
    status: "error",
    readyToCreate: false,
    account: {
      advertiserId: "",
      advertiserName: "Advertiser account required",
      maskedAdvertiserId: "--",
      country: "--",
      currency: "USD",
      status: "UNKNOWN",
      timezone: "--"
    },
    campaign: {
      advertiserId: "",
      campaignName: "Campaign review unavailable",
      objectiveType: "WEB_CONVERSIONS",
      budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
      budgetOptimizeOn: true,
      catalogEnabled: false,
      specialIndustries: [],
      specialIndustriesConfirmed: false,
      campaignType: "REGULAR_CAMPAIGN",
      aiSuggestedFields: [],
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
      const record: CampaignProposalRecord = {
        proposalId: randomUUID(),
        currentVersion: 1,
        account,
        versions: new Map([[1, { campaign, createdAt: new Date().toISOString() }]]),
        execution: { status: "idle", requestId: numericRequestId() },
        ...(mode === "demo"
          ? { simulationOutcome: (input as CampaignReviewDemoInput).simulationOutcome ?? "SUCCESS" }
          : {})
      };
      proposals.set(record.proposalId, record);
      return stateFor(record, record.currentVersion, mode);
    } catch (error) {
      return createErrorState(error, mode);
    }
  };

  const revise = (proposalId: string, expectedVersion: number, input: Omit<CampaignReviewInput, "advertiserId" | "advertiserName">) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
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

  const getStatus = async (proposalId: string, expectedVersion: number) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    completeDemoSubmission(record);
    if (mode === "demo") return stateFor(record, expectedVersion, mode);
    if (expectedVersion === record.currentVersion && record.execution.status === "outcome_unknown") {
      try {
        const created = await reconcile(record, record.execution.campaignId);
        if (created?.campaign_id && created.operation_status === "ENABLE") {
          record.execution = {
            ...record.execution,
            status: "created",
            campaignId: created.campaign_id,
            createdAt: created.create_time || new Date().toISOString(),
            verifiedAt: new Date().toISOString(),
            operationStatus: created.operation_status,
            secondaryStatus: created.secondary_status,
            errorCode: undefined,
            errorMessage: undefined
          };
        }
      } catch {
        // Keep outcome_unknown until TikTok can be reconciled without risking a duplicate write.
      }
    }
    return stateFor(record, expectedVersion, mode);
  };

  const reconcile = async (record: CampaignProposalRecord, campaignId?: string) => {
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
    }, authContext);
    if (getResult.status !== "connected") return undefined;
    return getResult.data.list?.find((item) => (campaignId ? item.campaign_id === campaignId : item.campaign_name === campaign.campaignName));
  };

  const create = async (proposalId: string, expectedVersion: number) => {
    const record = proposals.get(proposalId);
    if (!record) return createErrorState(new CampaignReviewError("PROPOSAL_NOT_FOUND", "Campaign proposal could not be found."), mode);
    if (expectedVersion !== record.currentVersion) return stateFor(record, expectedVersion, mode);
    if (record.execution.status === "created" || record.execution.status === "creating" || record.execution.status === "checking") {
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
        authContext
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
        authContext
      );
      if (createResult.status === "needs_authorization") {
        throw new CampaignReviewError("TIKTOK_AUTH_REQUIRED", "Reconnect TikTok Ads before creating this campaign.", createResult.authorizationUrl);
      }
      if (createResult.status === "misconfigured") {
        throw new CampaignReviewError("TIKTOK_MCP_MISCONFIGURED", createResult.message);
      }

      const campaignId = createResult.data.campaign_id;
      record.execution = { ...record.execution, status: "checking", campaignId };
      const created = await reconcile(record, campaignId);
      if (!created?.campaign_id) {
        record.execution = {
          ...record.execution,
          status: "outcome_unknown",
          errorCode: "CAMPAIGN_RECONCILIATION_PENDING",
          errorMessage: "TikTok accepted the create request, but the campaign could not yet be verified. Check status before retrying."
        };
        return stateFor(record, record.currentVersion, mode);
      }
      if (created.operation_status !== "ENABLE") {
        record.execution = {
          ...record.execution,
          status: "outcome_unknown",
          campaignId: created.campaign_id,
          operationStatus: created.operation_status,
          secondaryStatus: created.secondary_status,
          errorCode: "CAMPAIGN_STATUS_MISMATCH",
          errorMessage: "The campaign was created, but TikTok did not return Active status. Review it before taking another action."
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
        errorCode: undefined,
        errorMessage: undefined
      };
      return stateFor(record, record.currentVersion, mode);
    } catch (error) {
      const reviewError = error instanceof CampaignReviewError ? error : new CampaignReviewError("TIKTOK_CAMPAIGN_CREATE_STATUS_UNKNOWN", error instanceof Error ? error.message : "Campaign creation status is unknown.");
      record.execution = {
        ...record.execution,
        status: error instanceof CampaignReviewError ? "failed" : "outcome_unknown",
        authorizationUrl: reviewError.authorizationUrl,
        errorCode: reviewError.code,
        errorMessage:
          error instanceof CampaignReviewError
            ? reviewError.message
            : "The create request may have reached TikTok, but its result was not returned. The app will check status before allowing another write."
      };
      return stateFor(record, record.currentVersion, mode);
    }
  };

  return { prepare, revise, getStatus, create };
}
