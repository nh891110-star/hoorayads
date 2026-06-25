import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { UnauthorizedError, type OAuthClientProvider, type OAuthDiscoveryState } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";

import { getTikTokAppConfig } from "./config.js";

const TIKTOK_MCP_URL = "https://ads.tiktok.com/mcp";

type StoredClientInformation = {
  client_id: string;
  client_secret?: string;
  token_endpoint_auth_method?: "client_secret_basic" | "client_secret_post" | "none";
};

type StoredTokens = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

type StoredAuthState = {
  authorizationUrl?: string;
  clientInformation?: StoredClientInformation;
  codeVerifier?: string;
  discoveryState?: OAuthDiscoveryState;
  expectedState?: string;
  pendingAuthorizationCode?: string;
  tokens?: StoredTokens;
};

export type TikTokAdvertiserAccount = {
  advertiserId: string;
  advertiserName: string;
  advertiserRole: string;
  bcId: string;
  bcName: string;
  accountType: string;
  country: string;
  currency: string;
  identityCount: number;
  status: string;
  timezone: string;
};

export type TikTokIdentity = {
  availableStatus: string;
  displayName: string;
  identityAuthorizedBcId: string;
  identityId: string;
  identityType: string;
  username: string;
};

type TikTokAuthStatus =
  | {
      authorizationUrl: string;
      redirectUri: string;
      status: "needs_authorization";
    }
  | {
      message: string;
      status: "misconfigured";
    };

type ConnectedTikTokClient = {
  client: Client;
  close: () => Promise<void>;
  status: "connected";
};

type TikTokClientState = ConnectedTikTokClient | TikTokAuthStatus;

type TikTokToolPayload = {
  code?: number;
  data?: Record<string, unknown>;
  message?: string;
  request_id?: string;
};

type TikTokToolResponse<T> =
  | {
      data: T;
      status: "connected";
    }
  | TikTokAuthStatus;

export type CreateSmartPlusCampaignInput = {
  advertiserId: string;
  productUrl: string;
  generatedVideoJobId: string;
  campaignName: string;
  targetCountryCode: string;
  adgroupDailyBudget: number;
  optimizationGoal: "landing_page_views" | "clicks";
  biddingStrategy: "maximum_delivery" | "cost_cap";
  bidPrice?: number;
  locationIds?: string[];
  pixelId?: string;
  videoId?: string;
  identityId?: string;
  identityType?: "TT_USER" | "BC_AUTH_TT";
  identityAuthorizedBcId?: string;
  adText?: string;
  callToAction?: string;
  scheduleStartTime?: string;
};

type SmartPlusDraftResult = {
  adId: string;
  adgroupId: string;
  campaignId: string;
  creationState: "needs_more_inputs" | "campaign_only" | "campaign_and_adgroup" | "draft_ready";
  warnings: string[];
};

type RawBusinessCenter = {
  bc_info?: {
    bc_id?: string;
    name?: string;
  };
};

type RawBusinessCenterAsset = {
  advertiser_role?: string;
  advertiser_account_type?: string;
  asset_id?: string;
  asset_name?: string;
  owner_bc_name?: string;
};

type RawAdvertiserInfo = {
  advertiser_id?: string;
  country?: string;
  currency?: string;
  name?: string;
  role?: string;
  status?: string;
  timezone?: string;
};

type RawIdentity = {
  available_status?: string;
  display_name?: string;
  identity_authorized_bc_id?: string | null;
  identity_id?: string;
  identity_type?: string;
  username?: string;
};

type SmartPlusCampaignCreateResponse = {
  campaign_id?: string;
};

type SmartPlusAdgroupCreateResponse = {
  adgroup_id?: string;
};

type SmartPlusAdCreateResponse = {
  ad_id?: string;
  smart_plus_ad_id?: string;
};

const currentDir = dirname(fileURLToPath(import.meta.url));
const authStateDir = join(currentDir, "../.local");
const authStateFile = join(authStateDir, "tiktok-mcp-auth.json");

function ensureAuthStateDir() {
  if (!existsSync(authStateDir)) {
    mkdirSync(authStateDir, { recursive: true });
  }
}

function loadAuthState(): StoredAuthState {
  if (!existsSync(authStateFile)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(authStateFile, "utf8")) as StoredAuthState;
  } catch {
    return {};
  }
}

function saveAuthState(state: StoredAuthState) {
  ensureAuthStateDir();
  writeFileSync(authStateFile, JSON.stringify(state, null, 2));
}

function createAuthProvider(): OAuthClientProvider {
  const config = getTikTokAppConfig();

  return {
    get redirectUrl() {
      return config.redirectUri || undefined;
    },
    get clientMetadata() {
      return {
        client_name: "Hooray TikTok Ads MCP Bridge",
        grant_types: ["authorization_code", "refresh_token"],
        redirect_uris: config.redirectUri ? [config.redirectUri] : [],
        response_types: ["code"],
        scope: "mcp:access",
        token_endpoint_auth_method: "client_secret_post"
      };
    },
    state() {
      const nextState = randomUUID();
      const authState = loadAuthState();
      authState.expectedState = nextState;
      saveAuthState(authState);
      return nextState;
    },
    clientInformation() {
      const authState = loadAuthState();
      return (
        authState.clientInformation || {
          client_id: config.appId,
          client_secret: config.appSecret,
          token_endpoint_auth_method: "client_secret_post"
        }
      );
    },
    saveClientInformation(clientInformation) {
      const authState = loadAuthState();
      const authMethod =
        "token_endpoint_auth_method" in clientInformation &&
        clientInformation.token_endpoint_auth_method &&
        (clientInformation.token_endpoint_auth_method === "client_secret_basic" ||
          clientInformation.token_endpoint_auth_method === "client_secret_post" ||
          clientInformation.token_endpoint_auth_method === "none")
          ? clientInformation.token_endpoint_auth_method
          : "client_secret_post";
      authState.clientInformation = {
        client_id: clientInformation.client_id,
        client_secret: "client_secret" in clientInformation ? clientInformation.client_secret : config.appSecret,
        token_endpoint_auth_method: authMethod
      };
      saveAuthState(authState);
    },
    tokens() {
      return loadAuthState().tokens;
    },
    saveTokens(tokens) {
      const authState = loadAuthState();
      authState.tokens = {
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type
      };
      authState.pendingAuthorizationCode = undefined;
      authState.authorizationUrl = undefined;
      authState.expectedState = undefined;
      saveAuthState(authState);
    },
    redirectToAuthorization(authorizationUrl) {
      const authState = loadAuthState();
      authState.authorizationUrl = authorizationUrl.toString();
      saveAuthState(authState);
    },
    saveCodeVerifier(codeVerifier) {
      const authState = loadAuthState();
      authState.codeVerifier = codeVerifier;
      saveAuthState(authState);
    },
    codeVerifier() {
      const authState = loadAuthState();
      if (!authState.codeVerifier) {
        throw new Error("TikTok MCP OAuth code verifier is missing.");
      }

      return authState.codeVerifier;
    },
    saveDiscoveryState(discoveryState) {
      const authState = loadAuthState();
      authState.discoveryState = discoveryState;
      saveAuthState(authState);
    },
    discoveryState() {
      return loadAuthState().discoveryState;
    },
    invalidateCredentials(scope) {
      const authState = loadAuthState();

      if (scope === "all" || scope === "client") {
        authState.clientInformation = undefined;
      }

      if (scope === "all" || scope === "tokens") {
        authState.tokens = undefined;
      }

      if (scope === "all" || scope === "verifier") {
        authState.codeVerifier = undefined;
        authState.pendingAuthorizationCode = undefined;
        authState.expectedState = undefined;
      }

      if (scope === "all" || scope === "discovery") {
        authState.discoveryState = undefined;
      }

      saveAuthState(authState);
    }
  };
}

async function connectTikTokClient(): Promise<TikTokClientState> {
  const config = getTikTokAppConfig();
  if (!config.appId || !config.appSecret || !config.redirectUri) {
    return {
      message: "TikTok MCP bridge is not configured. Set app ID, app secret, and redirect URI first.",
      status: "misconfigured"
    };
  }

  const provider = createAuthProvider();
  const transport = new StreamableHTTPClientTransport(new URL(TIKTOK_MCP_URL), {
    authProvider: provider
  });
  const client = new Client(
    {
      name: "hooray-tiktok-ads-bridge",
      version: "0.3.0"
    },
    { capabilities: {} }
  );

  const authState = loadAuthState();
  if (authState.pendingAuthorizationCode) {
    try {
      await transport.finishAuth(authState.pendingAuthorizationCode);
      const nextState = loadAuthState();
      nextState.pendingAuthorizationCode = undefined;
      saveAuthState(nextState);
    } catch {
      const nextState = loadAuthState();
      nextState.pendingAuthorizationCode = undefined;
      nextState.tokens = undefined;
      saveAuthState(nextState);
    }
  }

  try {
    await client.connect(transport);
    return {
      client,
      close: async () => {
        await transport.close();
      },
      status: "connected"
    };
  } catch (error) {
    await transport.close().catch(() => undefined);

    if (error instanceof UnauthorizedError) {
      const nextState = loadAuthState();
      return {
        authorizationUrl: nextState.authorizationUrl || config.advertiserAuthUrl,
        redirectUri: config.redirectUri,
        status: "needs_authorization"
      };
    }

    throw error;
  }
}

async function callTikTokTool<T>(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<T> {
  const result = await client.request(
    {
      method: "tools/call",
      params: {
        arguments: args,
        name
      }
    },
    CallToolResultSchema
  );

  const textPayload = result.content.find((item) => item.type === "text")?.text;
  if (!textPayload) {
    throw new Error(`TikTok MCP tool ${name} returned no text payload.`);
  }

  const payload = JSON.parse(textPayload) as TikTokToolPayload;
  if (payload.code && payload.code !== 0) {
    throw new Error(payload.message || `TikTok MCP tool ${name} failed.`);
  }

  return (payload.data ?? {}) as T;
}

function dedupeIdentities(identityList: RawIdentity[]) {
  const seen = new Set<string>();
  const nextList: TikTokIdentity[] = [];

  for (const identity of identityList) {
    const identityId = identity.identity_id || "";
    const dedupeKey = `${identityId}:${identity.identity_type || ""}`;
    if (!identityId || seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    nextList.push({
      availableStatus: identity.available_status || "UNKNOWN",
      displayName: identity.display_name || identity.username || "Unnamed identity",
      identityAuthorizedBcId: identity.identity_authorized_bc_id || "",
      identityId,
      identityType: identity.identity_type || "UNKNOWN",
      username: identity.username || ""
    });
  }

  return nextList;
}

function pickBestIdentity(identityList: TikTokIdentity[]) {
  return identityList.find((identity) => identity.availableStatus !== "UNAVAILABLE") || identityList[0];
}

function formatUtcTimestamp(date: Date) {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const hours = `${date.getUTCHours()}`.padStart(2, "0");
  const minutes = `${date.getUTCMinutes()}`.padStart(2, "0");
  const seconds = `${date.getUTCSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function defaultScheduleStartTime() {
  return formatUtcTimestamp(new Date(Date.now() + 10 * 60 * 1000));
}

function readStringValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }

  return "";
}

async function withTikTokClient<T>(run: (client: Client) => Promise<T>): Promise<TikTokToolResponse<T>> {
  const state = await connectTikTokClient();
  if (state.status !== "connected") {
    return state;
  }

  try {
    const data = await run(state.client);
    return {
      data,
      status: "connected"
    };
  } finally {
    await state.close();
  }
}

export async function listTikTokAdvertiserAccounts(): Promise<
  TikTokToolResponse<{
    accounts: TikTokAdvertiserAccount[];
    userDisplayName: string;
  }>
> {
  return withTikTokClient(async (client) => {
    const userInfo = await callTikTokTool<{ display_name?: string }>(client, "user_info_get");
    const bcResponse = await callTikTokTool<{ list?: RawBusinessCenter[] }>(client, "bc_get", {
      page: 1,
      page_size: 50
    });

    const businessCenters = bcResponse.list ?? [];
    const assetRows: Array<RawBusinessCenterAsset & { bcId: string; bcName: string }> = [];

    for (const businessCenter of businessCenters) {
      const bcId = businessCenter.bc_info?.bc_id;
      if (!bcId) {
        continue;
      }

      const bcName = businessCenter.bc_info?.name || "Unnamed Business Center";
      const assetResponse = await callTikTokTool<{ list?: RawBusinessCenterAsset[] }>(client, "bc_asset_get", {
        asset_type: "ADVERTISER",
        bc_id: bcId,
        page: 1,
        page_size: 50
      });

      for (const asset of assetResponse.list ?? []) {
        assetRows.push({
          ...asset,
          bcId,
          bcName
        });
      }
    }

    const advertiserIds = assetRows
      .map((asset) => asset.asset_id || "")
      .filter((advertiserId): advertiserId is string => Boolean(advertiserId));

    const advertiserInfoMap = new Map<string, RawAdvertiserInfo>();
    if (advertiserIds.length > 0) {
      const advertiserInfoResponse = await callTikTokTool<{ list?: RawAdvertiserInfo[] }>(
        client,
        "advertiser_info_get",
        {
          advertiser_ids: advertiserIds,
          fields: ["advertiser_id", "country", "currency", "name", "role", "status", "timezone"]
        }
      );

      for (const advertiserInfo of advertiserInfoResponse.list ?? []) {
        if (advertiserInfo.advertiser_id) {
          advertiserInfoMap.set(advertiserInfo.advertiser_id, advertiserInfo);
        }
      }
    }

    const accounts: TikTokAdvertiserAccount[] = [];
    for (const asset of assetRows) {
      const advertiserId = asset.asset_id;
      if (!advertiserId) {
        continue;
      }

      const advertiserInfo = advertiserInfoMap.get(advertiserId);
      const identityResponse = await callTikTokTool<{ identity_list?: RawIdentity[] }>(client, "identity_get", {
        advertiser_id: advertiserId,
        page: 1,
        page_size: 50
      });

      const identities = dedupeIdentities(identityResponse.identity_list ?? []);
      accounts.push({
        accountType: asset.advertiser_account_type || "AUCTION",
        advertiserId,
        advertiserName:
          advertiserInfo?.name || asset.asset_name || `Advertiser ${advertiserId.slice(-6)}`,
        advertiserRole: advertiserInfo?.role || asset.advertiser_role || "UNKNOWN",
        bcId: asset.bcId,
        bcName: asset.bcName || asset.owner_bc_name || "Unnamed Business Center",
        country: advertiserInfo?.country || "--",
        currency: advertiserInfo?.currency || "--",
        identityCount: identities.length,
        status: advertiserInfo?.status || "UNKNOWN",
        timezone: advertiserInfo?.timezone || "--"
      });
    }

    return {
      accounts,
      userDisplayName: userInfo.display_name || "TikTok Ads user"
    };
  });
}

export async function verifyTikTokAdvertiserIdentity(
  advertiserId: string
): Promise<
  TikTokToolResponse<{
    identities: TikTokIdentity[];
  }>
> {
  return withTikTokClient(async (client) => {
    const identityResponse = await callTikTokTool<{ identity_list?: RawIdentity[] }>(client, "identity_get", {
      advertiser_id: advertiserId,
      page: 1,
      page_size: 50
    });

    return {
      identities: dedupeIdentities(identityResponse.identity_list ?? [])
    };
  });
}

export async function createSmartPlusCampaignDraft(
  input: CreateSmartPlusCampaignInput
): Promise<TikTokToolResponse<SmartPlusDraftResult>> {
  return withTikTokClient(async (client) => {
    const warnings: string[] = [];
    const locationIds = input.locationIds?.filter(Boolean) ?? [];

    if (locationIds.length === 0) {
      return {
        adId: "",
        adgroupId: "",
        campaignId: "",
        creationState: "needs_more_inputs",
        warnings: [
          "TikTok Smart+ ad group creation still needs at least one real location ID. `targetCountryCode` alone is not enough for the current MCP write call."
        ]
      };
    }

    if (input.biddingStrategy === "cost_cap" && !input.bidPrice) {
      return {
        adId: "",
        adgroupId: "",
        campaignId: "",
        creationState: "needs_more_inputs",
        warnings: [
          "Cost cap bidding needs `bidPrice` before the Smart+ ad group can be created."
        ]
      };
    }

    let selectedIdentityId = input.identityId || "";
    let selectedIdentityType = input.identityType || undefined;
    let selectedIdentityAuthorizedBcId = input.identityAuthorizedBcId || "";

    if (!selectedIdentityId) {
      const identityResponse = await callTikTokTool<{ identity_list?: RawIdentity[] }>(client, "identity_get", {
        advertiser_id: input.advertiserId,
        page: 1,
        page_size: 50
      });
      const selectedIdentity = pickBestIdentity(dedupeIdentities(identityResponse.identity_list ?? []));
      if (selectedIdentity) {
        selectedIdentityId = selectedIdentity.identityId;
        selectedIdentityType =
          selectedIdentity.identityType === "BC_AUTH_TT" ? "BC_AUTH_TT" : "TT_USER";
        selectedIdentityAuthorizedBcId = selectedIdentity.identityAuthorizedBcId;
      }
    }

    if (!selectedIdentityId) {
      warnings.push("No usable TikTok identity was found yet, so the app will stop after campaign and ad group draft creation.");
    }

    if (!input.videoId) {
      warnings.push("No TikTok `videoId` was provided yet, so the app will stop before Smart+ ad creative creation.");
    }

    const campaignResponse = await callTikTokTool<SmartPlusCampaignCreateResponse>(client, "smart_plus_campaign_create", {
      advertiser_id: input.advertiserId,
      campaign_name: input.campaignName,
      objective_type: "WEB_CONVERSIONS",
      operation_status: "DISABLE",
      request_id: randomUUID(),
      sales_destination: "WEBSITE"
    });

    const campaignId = readStringValue(campaignResponse as Record<string, unknown>, ["campaign_id"]);
    if (!campaignId) {
      throw new Error("TikTok MCP did not return a campaign_id for smart_plus_campaign_create.");
    }

    const optimizationGoal = input.optimizationGoal === "landing_page_views" ? "TRAFFIC_LANDING_PAGE_VIEW" : "CLICK";
    const billingEvent = input.optimizationGoal === "landing_page_views" ? "OCPM" : "CPC";
    const bidType = input.biddingStrategy === "cost_cap" ? "BID_TYPE_CUSTOM" : "BID_TYPE_NO_BID";

    const adgroupPayload: Record<string, unknown> = {
      adgroup_name: `${input.campaignName} | Smart+`,
      advertiser_id: input.advertiserId,
      bid_type: bidType,
      billing_event: billingEvent,
      budget: input.adgroupDailyBudget,
      budget_mode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
      campaign_id: campaignId,
      operation_status: "DISABLE",
      optimization_goal: optimizationGoal,
      promotion_target_type: "EXTERNAL_WEBSITE",
      promotion_type: "WEBSITE",
      request_id: randomUUID(),
      schedule_start_time: input.scheduleStartTime || defaultScheduleStartTime(),
      schedule_type: "SCHEDULE_FROM_NOW",
      targeting_optimization_mode: "AUTOMATIC",
      targeting_spec: {
        location_ids: locationIds
      }
    };

    if (input.pixelId) {
      adgroupPayload.pixel_id = input.pixelId;
    }

    if (input.biddingStrategy === "cost_cap" && input.bidPrice) {
      adgroupPayload.bid_price = input.bidPrice;
    }

    const adgroupResponse = await callTikTokTool<SmartPlusAdgroupCreateResponse>(client, "smart_plus_adgroup_create", adgroupPayload);
    const adgroupId = readStringValue(adgroupResponse as Record<string, unknown>, ["adgroup_id"]);
    if (!adgroupId) {
      return {
        adId: "",
        adgroupId: "",
        campaignId,
        creationState: "campaign_only",
        warnings: warnings.concat("TikTok created the campaign draft, but the ad group response did not include an adgroup_id.")
      };
    }

    if (!selectedIdentityId || !input.videoId) {
      return {
        adId: "",
        adgroupId,
        campaignId,
        creationState: "campaign_and_adgroup",
        warnings
      };
    }

    const adPayload: Record<string, unknown> = {
      ad_name: `${input.campaignName} | Creative`,
      ad_text_list: [{ ad_text: input.adText || `Shop ${input.campaignName}` }],
      adgroup_id: adgroupId,
      advertiser_id: input.advertiserId,
      call_to_action_list: [{ call_to_action: input.callToAction || "SHOP_NOW" }],
      creative_list: [
        {
          creative_info: {
            video_id: input.videoId
          }
        }
      ],
      landing_page_url_list: [{ landing_page_url: input.productUrl }],
      operation_status: "DISABLE"
    };

    adPayload.ad_configuration = {
      identity_authorized_bc_id: selectedIdentityAuthorizedBcId || undefined,
      identity_id: selectedIdentityId,
      identity_type: selectedIdentityType || "TT_USER",
      tracking_info: input.pixelId
        ? {
            tracking_pixel_id: input.pixelId
          }
        : undefined
    };

    try {
      const adResponse = await callTikTokTool<SmartPlusAdCreateResponse>(client, "smart_plus_ad_create", adPayload);
      const adId = readStringValue(adResponse as Record<string, unknown>, ["smart_plus_ad_id", "ad_id"]);
      if (!adId) {
        return {
          adId: "",
          adgroupId,
          campaignId,
          creationState: "campaign_and_adgroup",
          warnings: warnings.concat("TikTok created the campaign and ad group drafts, but the ad response did not include an ad_id.")
        };
      }

      return {
        adId,
        adgroupId,
        campaignId,
        creationState: "draft_ready",
        warnings
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Smart+ ad creation error.";
      return {
        adId: "",
        adgroupId,
        campaignId,
        creationState: "campaign_and_adgroup",
        warnings: warnings.concat(`TikTok campaign and ad group drafts were created, but ad creation still failed: ${message}`)
      };
    }
  });
}

export function saveTikTokMcpAuthorizationCode(code: string, state?: string) {
  const authState = loadAuthState();

  if (authState.expectedState && state && authState.expectedState !== state) {
    throw new Error("TikTok MCP OAuth state did not match.");
  }

  authState.pendingAuthorizationCode = code;
  saveAuthState(authState);
}

export function getTikTokMcpAuthSummary() {
  const authState = loadAuthState();

  return {
    authorizationPending: Boolean(authState.authorizationUrl),
    callbackPending: Boolean(authState.pendingAuthorizationCode),
    hasTokens: Boolean(authState.tokens?.access_token)
  };
}
