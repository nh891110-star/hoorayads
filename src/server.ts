import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  approveAdInputsInput,
  approveAdInputsOutput,
  approveCampaignParametersInput,
  approveCampaignParametersOutput,
  capabilityMap,
  choosePromotedProductInput,
  choosePromotedProductOutput,
  createSmartplusCampaignInput,
  createSmartplusCampaignOutput,
  generateStoryboardInput,
  generateStoryboardOutput,
  generateVideoInput,
  generateVideoOutput,
  getAdsReportInput,
  getAdsReportOutput,
  getAdAccountsInput,
  getAdAccountsOutput,
  getVideoStatusInput,
  getVideoStatusOutput,
  loadCreativeOptionsInput,
  loadCreativeOptionsOutput,
  openTikTokAdsWorkspaceInput,
  openTikTokAdsWorkspaceOutput,
  planAccountSetupInput,
  planAccountSetupOutput,
  publishCampaignInput,
  publishCampaignOutput,
  renderTikTokAdsWorkspaceInput,
  renderTikTokAdsWorkspaceOutput,
  overrideProductDetailsInput,
  overrideProductDetailsOutput,
  scrapeProductInput,
  scrapeProductOutput,
  scanStoreProductsInput,
  scanStoreProductsOutput,
  setupReportingDigestInput,
  setupReportingDigestOutput,
  updateProductImagesInput,
  updateProductImagesOutput,
  verifyOrConnectTikTokIdentityInput,
  verifyOrConnectTikTokIdentityOutput,
  verifyPaymentMethodInput,
  verifyPaymentMethodOutput
} from "./tool-contract.js";
import {
  accountAuthorizationResult,
  accountErrorResult,
  accountResult,
  creativeWorkspaceResult,
  draftResult,
  identityConnectResult,
  liveAccountResult,
  onboardingWorkspaceResult,
  previewState,
  productSelectionResult,
  publishResult,
  renderCompleteResult,
  renderPendingResult,
  reviewReadyResult,
  reportingSetupResult,
  scrapeResult,
  storeProductCandidatesResult,
  storeProductScanLoadingResult,
  storyboardResult,
  withSkippedAccountSetup
} from "./mock-data.js";
import type { AccountSetupReadiness, ProductContext, StoreProductCandidate, ToolViewModel, VideoPreview } from "./mock-data.js";
import { getTikTokAppConfig } from "./config.js";
import {
  createSmartPlusCampaignDraft,
  listTikTokAdvertiserAccounts,
  verifyTikTokAdvertiserIdentity
} from "./tiktok-mcp.js";
import type { TikTokAdvertiserAccount, TikTokIdentity } from "./tiktok-mcp.js";
import { getTikTokAdsReport } from "./reporting.js";
import type { GetAdsReportInput } from "./reporting.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const widgetJs = readFileSync(join(currentDir, "../web/widget.js"), "utf8");
const widgetCss = readFileSync(join(currentDir, "../web/widget.css"), "utf8");
const reportingWidgetJs = readFileSync(join(currentDir, "../web/reporting-widget.js"), "utf8");
const reportingWidgetCss = readFileSync(join(currentDir, "../web/reporting-widget.css"), "utf8");
const RESOURCE_URI_META_KEY = "ui/resourceUri";
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const WIDGET_URI = "ui://widget/tiktok-ads-workspace-v10.html";
const REPORT_WIDGET_URI = "ui://widget/tiktok-ads-report-v1.html";
const LEGACY_WIDGET_URIS = [
  "ui://widget/tiktok-ads-workspace-v9.html",
  "ui://widget/tiktok-ads-workspace-v8.html",
  "ui://widget/tiktok-ads-workspace-v7.html",
  "ui://widget/tiktok-ads-workspace-v6.html",
  "ui://widget/tiktok-ads-workspace-v5.html"
];
const WIDGET_DOMAIN = "https://tiktok-ads-agent-poc.onrender.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.HOORAY_PUBLIC_BASE_URL || WIDGET_DOMAIN).replace(
  /\/$/,
  ""
);
const WIDGET_DESCRIPTION =
  "Display-only TikTok Ads workspace for product intake, creative review, campaign drafting, publish, and reporting. The user controls each step through chat.";
const REPORT_WIDGET_DESCRIPTION =
  "Interactive TikTok Ads performance report with a compact cross-host summary and fullscreen filters, trend, insights, breakdown table, refresh, and CSV export.";
const TOOL_DATA_META = {
  ui: {
    visibility: ["model", "app"]
  },
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Updating TikTok Ads workspace...",
  "openai/toolInvocation/invoked": "TikTok Ads workspace updated."
} as const;
const TOOL_RENDER_META = {
  ui: {
    resourceUri: WIDGET_URI,
    visibility: ["model", "app"]
  },
  "openai/outputTemplate": WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Preparing TikTok Ads workspace...",
  "openai/toolInvocation/invoked": "TikTok Ads workspace ready."
} as const;
const RESULT_WIDGET_META = {
  ui: {
    visibility: ["model", "app"]
  }
} as const;
const RESULT_RENDER_META = {
  [RESOURCE_URI_META_KEY]: WIDGET_URI,
  ui: {
    resourceUri: WIDGET_URI
  },
  "openai/outputTemplate": WIDGET_URI
} as const;
const TOOL_REPORT_META = {
  ui: {
    resourceUri: REPORT_WIDGET_URI,
    visibility: ["model", "app"]
  },
  "openai/outputTemplate": REPORT_WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Generating TikTok Ads report...",
  "openai/toolInvocation/invoked": "TikTok Ads report ready."
} as const;
const RESULT_REPORT_META = {
  [RESOURCE_URI_META_KEY]: REPORT_WIDGET_URI,
  ui: {
    resourceUri: REPORT_WIDGET_URI
  },
  "openai/outputTemplate": REPORT_WIDGET_URI
} as const;

function withWidgetToolMeta<T extends object>(definition: T): T & { _meta: Record<string, unknown> } {
  return {
    ...definition,
    _meta: {
      ...TOOL_DATA_META,
      ...("_meta" in definition && definition._meta && typeof definition._meta === "object"
        ? (definition._meta as Record<string, unknown>)
        : {})
    }
  };
}

function withRenderToolMeta<T extends object>(definition: T): T & { _meta: Record<string, unknown> } {
  return {
    ...definition,
    _meta: {
      ...TOOL_RENDER_META,
      ...("_meta" in definition && definition._meta && typeof definition._meta === "object"
        ? (definition._meta as Record<string, unknown>)
        : {})
    }
  };
}

function withReportingToolMeta<T extends object>(definition: T): T & { _meta: Record<string, unknown> } {
  return {
    ...definition,
    _meta: {
      ...TOOL_REPORT_META,
      ...("_meta" in definition && definition._meta && typeof definition._meta === "object"
        ? (definition._meta as Record<string, unknown>)
        : {})
    }
  };
}

type SessionProductState = ProductContext & {
  imageCount: number;
  notes?: string;
};

type RenderStatus = "idle" | "pending" | "complete" | "failed";

type DraftSessionState = {
  adId: string;
  adgroupId: string;
  campaignId: string;
  creationState: "needs_more_inputs" | "campaign_only" | "campaign_and_adgroup" | "draft_ready";
  warnings: string[];
} | null;

type RenderError = {
  code: string;
  message: string;
  retryable: boolean;
};

type ApprovalSnapshot = {
  approvalId: string;
  product: SessionProductState;
  approvedAt: string;
};

type VideoJobState = {
  approvalId: string | null;
  jobId: string | null;
  pollCount: number;
  preview?: VideoPreview;
  product: SessionProductState;
  error?: RenderError;
  status: RenderStatus;
  style: "ugc" | "product_demo" | "founder_story";
};

type LaunchState = {
  accountSetup: AccountSetupReadiness | null;
  approvalSnapshots: Record<string, ApprovalSnapshot>;
  currentApprovalId: string | null;
  currentCampaignApprovalId: string | null;
  currentDraft: DraftSessionState;
  currentProduct: SessionProductState;
  currentVideoJob: VideoJobState;
  uiActionToken: string;
};

const initialProductState: SessionProductState = {
  title: "Promoted product",
  price: "Pending merchant price",
  destination: "Pending user input",
  platform: "Direct product URL",
  imageCount: 0
};

const sharedLaunchState: LaunchState = {
  accountSetup: null,
  approvalSnapshots: {},
  currentApprovalId: null,
  currentCampaignApprovalId: null,
  currentDraft: null,
  currentProduct: { ...initialProductState },
  currentVideoJob: {
    approvalId: null,
    jobId: null,
    pollCount: 0,
    product: { ...initialProductState },
    status: "idle",
    style: "ugc"
  },
  uiActionToken: randomUUID()
};

type InteractionControl = {
  expectedStep?: string;
  interactionToken?: string;
  userAction?: "ui_click" | "chat_confirmed";
};

type ImageReferenceInput = string | { source?: "url" | "upload"; value: string };

type UpdateProductImagesArgs = {
  imageUrls?: string[];
  images?: ImageReferenceInput[];
  productUrl: string;
  uploadedImageRefs?: string[];
};

function normalizeImageReferences(args: UpdateProductImagesArgs): Array<{ source: "url" | "upload"; value: string }> {
  const normalized: Array<{ source: "url" | "upload"; value: string }> = [];
  const addReference = (source: "url" | "upload", value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) {
      normalized.push({ source, value: trimmed });
    }
  };

  for (const image of args.images ?? []) {
    if (typeof image === "string") {
      addReference(image.startsWith("http") ? "url" : "upload", image);
      continue;
    }

    addReference(image.source ?? (image.value.startsWith("http") ? "url" : "upload"), image.value);
  }

  for (const url of args.imageUrls ?? []) {
    addReference("url", url);
  }

  for (const ref of args.uploadedImageRefs ?? []) {
    addReference("upload", ref);
  }

  return normalized;
}

function titleCaseProductToken(token: string): string {
  const lower = token.toLowerCase();
  const replacements: Record<string, string> = {
    air: "Air",
    black: "Black",
    grey: "Grey",
    kid: "Kid",
    kids: "Kids",
    ltd: "LTD",
    max: "Max",
    men: "Men",
    mens: "Men's",
    nike: "Nike",
    shoe: "Shoe",
    shoes: "Shoes",
    sneaker: "Sneaker",
    unisex: "Unisex",
    women: "Women",
    womens: "Women's"
  };

  if (replacements[lower]) {
    return replacements[lower];
  }

  if (/^\d+$/.test(token)) {
    return token;
  }

  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function humanizeProductSlug(segment?: string): string {
  if (!segment) {
    return "";
  }

  const cleaned = decodeURIComponent(segment).replace(/\.(html|htm|php)$/i, "");
  const tokens = cleaned
    .split(/[-_]+/)
    .filter(Boolean)
    .filter((token) => !/^\d{5,}$/.test(token));

  if (tokens.length === 0) {
    return "";
  }

  return tokens.map((token) => titleCaseProductToken(token)).join(" ").trim();
}

function inferProductFromUrl(url: string): SessionProductState {
  const parsed = new URL(url);
  const meaningfulSegments = parsed.pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => !["product", "products", "item", "items", "p", "dp"].includes(segment.toLowerCase()));

  const primary = humanizeProductSlug(meaningfulSegments[0]);
  const variant = humanizeProductSlug(meaningfulSegments[1]);
  const title =
    primary && variant && variant.split(" ").length <= 3 && !primary.includes(variant)
      ? `${primary} - ${variant}`
      : primary || parsed.hostname.replace(/^www\./, "") || initialProductState.title;

  return {
    title,
    price: "Pending merchant price",
    destination: url,
    platform: "Direct product URL",
    imageCount: 3
  };
}

function absoluteStoreProductUrl(storeUrl: string, slug: string): string {
  const parsed = new URL(storeUrl);
  return `${parsed.origin.replace(/\/$/, "")}/products/${slug}`;
}

function inferStoreProductCandidates(storeUrl: string): StoreProductCandidate[] {
  return [
    {
      angle: "Hands-free cooling for hot commutes.",
      confidence: "Strong match",
      id: "portable-neck-fan",
      productUrl: absoluteStoreProductUrl(storeUrl, "portable-neck-fan"),
      recommendation: "Top pick",
      reasons: [
        "Clear seasonal use case and easy visual demo.",
        "Benefit is understandable in the first 2 seconds.",
        "Product page can support a simple shop-now CTA."
      ],
      selected: true,
      title: "Portable Neck Fan"
    },
    {
      angle: "30-second couch cleanup before/after.",
      confidence: "Good potential",
      id: "pet-hair-remover-brush",
      productUrl: absoluteStoreProductUrl(storeUrl, "pet-hair-remover-brush"),
      recommendation: "Candidate",
      reasons: [
        "Before/after cleanup is easy to show in short video.",
        "Audience is specific: pet owners with sofas, rugs, or cars.",
        "Strong demonstration potential if product footage is available."
      ],
      title: "Pet Hair Remover Brush"
    }
  ];
}

function platformForProductSource(source: "website" | "tiktok_shop" | "lead_generation" | "app"): string {
  if (source === "website") {
    return "Direct product URL";
  }

  if (source === "tiktok_shop") {
    return "TikTok Shop / GMV Max";
  }

  if (source === "lead_generation") {
    return "Lead collection flow";
  }

  return "App install flow";
}

function deriveCreativeBrief(productDescription: string, feedback?: string): Partial<SessionProductState> {
  const text = `${productDescription} ${feedback || ""}`.toLowerCase();
  const asksForLifestyle =
    text.includes("fashion") ||
    text.includes("lifestyle") ||
    text.includes("style") ||
    text.includes("outfit") ||
    text.includes("do not pain") ||
    text.includes("not pain");

  if (asksForLifestyle) {
    return {
      creativeBriefFormat: "Lifestyle product showcase",
      creativeBriefHook: "Open on the bag styled with a clean everyday outfit, then show the texture, silhouette, and easy carry moment.",
      creativeBriefObjective: "Landing page views",
      creativeBriefSummary:
        "Lead with styling and desirability rather than a problem/solution frame. Keep the CTA polished and product-forward.",
      creativeBriefTitle: "Fashion lifestyle showcase"
    };
  }

  if (text.includes("proof") || text.includes("social") || text.includes("review")) {
    return {
      creativeBriefFormat: "Social proof cut",
      creativeBriefHook: "Open with a believable proof cue, then show why the product is worth clicking now.",
      creativeBriefObjective: "Web Conversions",
      creativeBriefSummary: "Use social proof and product detail together so the ad feels credible before the CTA.",
      creativeBriefTitle: "Proof-first social clip"
    };
  }

  return {
    creativeBriefFormat: "2-scene UGC",
    creativeBriefHook: "Start with the problem, then pivot hard into the product payoff with one spoken line and one tactile reveal.",
    creativeBriefObjective: "Web Conversions",
    creativeBriefSummary: "Use the default direct-response UGC lane when the user has not specified a stronger creative direction.",
    creativeBriefTitle: "Pain-to-comfort UGC"
  };
}

export function createTikTokAdsPocServer() {
  const tikTokConfig = getTikTokAppConfig();
  const state = sharedLaunchState;

  const getCurrentProduct = (): SessionProductState => ({ ...state.currentProduct });
  const updateCurrentProduct = (updates: Partial<SessionProductState>): SessionProductState => {
    state.currentProduct = {
      ...state.currentProduct,
      ...updates
    };

    return getCurrentProduct();
  };
  const isAccountSetupReady = (account?: TikTokAdvertiserAccount, identities?: TikTokIdentity[]): boolean =>
    Boolean(
      account &&
        (account.bcId || account.bcName) &&
        account.advertiserId &&
        (identities?.length || account.identityCount > 0)
    );
  const markAccountSetupReady = (options: {
    account?: TikTokAdvertiserAccount;
    advertiserId?: string;
    identities?: TikTokIdentity[];
  }): AccountSetupReadiness => {
    const selectedIdentity = options.identities?.[0];
    const selectedAdvertiserId = options.account?.advertiserId || options.advertiserId;
    const readiness: AccountSetupReadiness = {
      optional: true,
      ready: true,
      skipped: true,
      skipReason:
        "TikTok for Business, Business Center, Advertiser Account, and TikTok Account are already connected.",
      selectedAdvertiserId,
      selectedIdentityId: selectedIdentity?.identityId,
      requirements: [
        { id: "tt4b", label: "TikTok for Business", status: "ready" },
        { id: "business_center", label: "Business Center", status: "ready" },
        { id: "advertiser_account", label: "Advertiser Account", status: "ready" },
        { id: "tiktok_account", label: "TikTok Account", status: "ready" }
      ]
    };

    state.accountSetup = readiness;
    return readiness;
  };
  const clearAccountSetupReadiness = () => {
    state.accountSetup = null;
  };
  const attachCurrentVideoContext = (widgetState: ToolViewModel): ToolViewModel =>
    state.currentVideoJob.jobId
      ? {
          ...widgetState,
          renderJob: {
            jobId: state.currentVideoJob.jobId,
            status: state.currentVideoJob.status === "idle" ? "pending" : state.currentVideoJob.status,
            ...(state.currentVideoJob.approvalId ? { approvalId: state.currentVideoJob.approvalId } : {})
          },
          ...(state.currentVideoJob.preview ? { videoPreview: state.currentVideoJob.preview } : {})
        }
      : widgetState;
  const preserveAccountSetupSkip = (widgetState: ToolViewModel): ToolViewModel =>
    attachCurrentVideoContext(
      state.accountSetup?.ready
        ? withSkippedAccountSetup(widgetState, {
            selectedAdvertiserId: state.accountSetup.selectedAdvertiserId,
            selectedIdentityId: state.accountSetup.selectedIdentityId,
            skipReason: state.accountSetup.skipReason
          })
        : widgetState
    );
  const isRenderableProduct = (product: SessionProductState): boolean =>
    product.title !== initialProductState.title &&
    product.destination !== initialProductState.destination &&
    /^https?:\/\//.test(product.destination);
  const productContextError = (approvalId: string): RenderError => ({
    code: "PRODUCT_CONTEXT_MISSING",
    message: `Video rendering could not start because approval ${approvalId} is not linked to a complete product title and landing page. Review or override product details, then approve again.`,
    retryable: true
  });
  const makeRenderErrorState = (product: SessionProductState, error: RenderError): ToolViewModel => ({
    ...renderPendingResult(product),
    headline: "Creative render needs attention",
    summary: error.message,
    primaryCta: error.retryable ? "Retry render" : "Review launch flow",
    secondaryCta: "Edit product details",
    blockers: [
      {
        id: error.code.toLowerCase().replaceAll("_", "-"),
        severity: error.retryable ? "medium" : "high",
        title: error.code,
        detail: error.message
      }
    ],
    readiness: {
      accountConnection: "Not checked yet",
      identity: "Not checked yet",
      payment: "Not checked yet",
      video: "Render failed",
      recommendedObjective: "Fix creative inputs first"
    }
  });
  const makeVideoPreview = (
    jobId: string,
    product: SessionProductState,
    style: "ugc" | "product_demo" | "founder_story"
  ): VideoPreview => {
    const encodedJobId = encodeURIComponent(jobId);
    const encodedProduct = encodeURIComponent(product.title);
    const styleLabel = style.replaceAll("_", "-");

    return {
      canCreateCampaign: true,
      creativeAssetId: `creative_asset_${jobId}`,
      durationSeconds: 8,
      height: 960,
      jobId,
      previewUrl: `${PUBLIC_BASE_URL}/assets/mock-render-preview.mp4?jobId=${encodedJobId}&style=${styleLabel}&product=${encodedProduct}`,
      status: "preview_ready",
      thumbnailUrl: `${PUBLIC_BASE_URL}/assets/mock-render-poster.svg?jobId=${encodedJobId}&product=${encodedProduct}`,
      videoId: `preview_video_${jobId}`,
      width: 540
    };
  };
  const videoPreviewFields = (preview: VideoPreview) => ({
    canCreateCampaign: preview.canCreateCampaign,
    creativeAssetId: preview.creativeAssetId,
    durationSeconds: preview.durationSeconds,
    height: preview.height,
    previewUrl: preview.previewUrl,
    thumbnailUrl: preview.thumbnailUrl,
    tiktokVideoId: preview.tiktokVideoId,
    videoId: preview.videoId,
    width: preview.width
  });
  const previewResourceLink = (preview: VideoPreview) =>
    ({
      type: "resource_link" as const,
      uri: preview.previewUrl,
      name: "Rendered TikTok preview MP4",
      title: "Rendered TikTok preview",
      description: "Playable preview asset generated for review before campaign setup.",
      mimeType: "video/mp4"
    });
  const withRenderJobState = (widgetState: ToolViewModel, renderJob: VideoJobState): ToolViewModel => ({
    ...widgetState,
    renderJob: {
      jobId: renderJob.jobId || "missing_job",
      status: renderJob.status === "idle" ? "pending" : renderJob.status,
      ...(renderJob.approvalId ? { approvalId: renderJob.approvalId } : {})
    }
  });
  const startVideoRender = (
    approvalId: string,
    style: "ugc" | "product_demo" | "founder_story" = "ugc"
  ) => {
    const jobId = `video_job_${approvalId.replace(/^approval_/, "")}`;
    const approvedProduct = state.approvalSnapshots[approvalId]?.product || getCurrentProduct();
    const error = isRenderableProduct(approvedProduct) ? undefined : productContextError(approvalId);
    const preview = error ? undefined : makeVideoPreview(jobId, approvedProduct, style);
    state.currentVideoJob = {
      approvalId,
      jobId,
      pollCount: 0,
      ...(preview ? { preview } : {}),
      product: { ...approvedProduct },
      ...(error ? { error } : {}),
      status: error ? "failed" : "pending",
      style
    };

    return { ...state.currentVideoJob };
  };
  const loadAdvertiserWorkspace = async () => {
    try {
      const result = await listTikTokAdvertiserAccounts();

      if (result.status === "needs_authorization") {
        clearAccountSetupReadiness();
        return {
          source: "tiktok-mcp-oauth",
          text: "Video render is done, but TikTok Ads authorization is still required before advertiser setup can continue.",
          widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
        } as const;
      }

      if (result.status === "misconfigured") {
        clearAccountSetupReadiness();
        return {
          source: "config-error",
          text: result.message,
          widgetState: accountErrorResult(result.message, getCurrentProduct())
        } as const;
      }

      if (result.data.accounts.length === 0) {
        clearAccountSetupReadiness();
        return {
          source: "tiktok-mcp",
          text: "Video render is done, but no advertiser accounts are available on this TikTok Ads connection yet.",
          widgetState: onboardingWorkspaceResult({
            accounts: [],
            connected: true,
            userDisplayName: result.data.userDisplayName
          })
        } as const;
      }

      if (result.data.accounts.length === 1) {
        const selectedAccount = result.data.accounts[0];
        const identityResult = await verifyTikTokAdvertiserIdentity(selectedAccount.advertiserId);

        if (identityResult.status === "needs_authorization") {
          clearAccountSetupReadiness();
          return {
            source: "tiktok-mcp-oauth",
            text: "Video render is done, but identity verification still needs TikTok Ads authorization to finish.",
            widgetState: accountAuthorizationResult(identityResult.authorizationUrl, identityResult.redirectUri)
          } as const;
        }

        if (identityResult.status === "misconfigured") {
          clearAccountSetupReadiness();
          return {
            source: "config-error",
            text: identityResult.message,
            widgetState: accountErrorResult(identityResult.message, getCurrentProduct())
          } as const;
        }

        if (isAccountSetupReady(selectedAccount, identityResult.data.identities)) {
          const accountSetup = markAccountSetupReady({
            account: selectedAccount,
            identities: identityResult.data.identities
          });

          return {
            source: "tiktok-mcp",
            text:
              "Video render complete. Account setup is already ready, so skip Account setup and move directly to Review.",
            widgetState: attachCurrentVideoContext(reviewReadyResult({
              product: getCurrentProduct(),
              selectedAdvertiserId: accountSetup.selectedAdvertiserId,
              selectedIdentityId: accountSetup.selectedIdentityId
            }))
          } as const;
        }

        if (tikTokConfig.advertiserAuthUrl && tikTokConfig.redirectUri) {
          clearAccountSetupReadiness();
          return {
            source: "tiktok-mcp",
            text: "Video render complete. The advertiser account is ready, but a TikTok identity still needs to be connected before Smart+ draft creation.",
            widgetState: identityConnectResult(tikTokConfig.advertiserAuthUrl, tikTokConfig.redirectUri)
          } as const;
        }
      }

      return {
        source: "tiktok-mcp",
        text:
          result.data.accounts.length > 1
            ? "Video render complete. Advertiser accounts are loaded, so the user can choose the correct account and continue toward draft creation."
            : "Video render complete. The advertiser account is loaded and ready for the next setup step.",
        widgetState: liveAccountResult({
          accounts: result.data.accounts,
          product: getCurrentProduct(),
          userDisplayName: result.data.userDisplayName
        })
      } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while loading advertiser workspace.";

      return {
        source: "tiktok-mcp-error",
        text: `Video render completed, but advertiser setup could not be loaded: ${message}`,
        widgetState: accountErrorResult(message, getCurrentProduct())
      } as const;
    }
  };

  const server = new McpServer(
    { name: "tiktok-ads-agent-poc", version: "0.3.0" },
    {
      instructions:
        "Guide the advertiser through Product, Storyboard, Preview, optional Account setup, and Review as a chat-driven workflow. The rendered Hooray TikTok Ads workspace is display-only: do not ask the user to click buttons or edit fields inside the card. If the user provides a product URL, call open_tiktok_ads_workspace with productUrl so the first visible card is Confirm this product; do not show a Start card. If the user provides a store URL, call open_tiktok_ads_workspace with storeUrl so the first visible card is Pick a product; treat Pick product as a substep inside Product, not a separate main launch step. When showing a card, write exactly one short sentence before the card that explains what the card shows and what the user can reply in chat to do next, such as 'reply continue', 'use option A', 'pick product 2', 'change the title to...', or 'approve preview'. Then render the card. After rendering, stop; do not write post-card execution summaries such as 'done', 'called tool', 'returned status', implementation details, or progress recaps below the card. Wait for explicit chat confirmation for the exact current step before moving forward. Do not chain Product -> Storyboard -> Preview -> Account setup automatically. When the user confirms in chat, call the next MCP tool with userAction:'chat_confirmed'. Do not call approve_ad_inputs after generate_storyboard unless the user explicitly chooses a storyboard. Do not call get_video_status unless the user asks to check render status. Do not call get_ad_accounts, create_smartplus_campaign, approve_campaign_parameters, publish_campaign, or setup_reporting_digest without explicit user approval for that exact step. After a model-initiated business tool returns widgetState, call render_tiktok_ads_workspace with that widgetState, then stop. Account setup is optional: if TT4B, Business Center, Advertiser Account, and TikTok Account are already ready, skip it and continue to Review only after the user approves the preview. When the user asks to show, generate, refresh, compare, or export a TikTok Ads performance report, call get_ads_report directly. Default to live data, the last 7 complete days, campaign level, and previous-period comparison unless the user specifies otherwise. Do not call render_tiktok_ads_workspace after get_ads_report because the reporting tool renders its own MCP App resource."
    }
  );

  const registerWidgetResource = (name: string, uri: string) => {
    server.registerResource(
      name,
      uri,
      {
        title: "TikTok Ads workspace",
        mimeType: RESOURCE_MIME_TYPE
      },
      async () => ({
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: `
<div id="app-root"></div>
<style>${widgetCss}</style>
<script>
window.__POC_PREVIEW_STATE__ = ${JSON.stringify(previewState)};
</script>
<script type="module">${widgetJs}</script>
          `.trim(),
          _meta: {
            ui: {
              prefersBorder: true,
              domain: WIDGET_DOMAIN,
              csp: {
                connectDomains: [WIDGET_DOMAIN],
                resourceDomains: [WIDGET_DOMAIN]
              }
            },
            "openai/widgetDescription": WIDGET_DESCRIPTION,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": WIDGET_DOMAIN,
            "openai/widgetCSP": {
              connect_domains: [WIDGET_DOMAIN],
              resource_domains: [WIDGET_DOMAIN],
              redirect_domains: ["https://ads.tiktok.com", "https://business-api.tiktok.com"]
            }
          }
        }
      ]
    })
    );
  };

  registerWidgetResource("tiktok-ads-workspace", WIDGET_URI);
  LEGACY_WIDGET_URIS.forEach((uri, index) => {
    registerWidgetResource(`tiktok-ads-workspace-legacy-${index + 1}`, uri);
  });

  server.registerResource(
    "tiktok-ads-report",
    REPORT_WIDGET_URI,
    {
      title: "TikTok Ads performance report",
      mimeType: RESOURCE_MIME_TYPE
    },
    async () => ({
      contents: [
        {
          uri: REPORT_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: `
<div id="report-root"></div>
<style>${reportingWidgetCss}</style>
<script type="module">${reportingWidgetJs}</script>
          `.trim(),
          _meta: {
            ui: {
              prefersBorder: true,
              domain: PUBLIC_BASE_URL,
              csp: {
                connectDomains: [PUBLIC_BASE_URL],
                resourceDomains: [PUBLIC_BASE_URL]
              }
            },
            "openai/widgetDescription": REPORT_WIDGET_DESCRIPTION,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": PUBLIC_BASE_URL,
            "openai/widgetCSP": {
              connect_domains: [PUBLIC_BASE_URL],
              resource_domains: [PUBLIC_BASE_URL],
              redirect_domains: ["https://ads.tiktok.com", "https://business-api.tiktok.com"]
            }
          }
        }
      ]
    })
  );

  server.registerTool(
    "get_ads_report",
    withReportingToolMeta({
      title: "Get TikTok Ads report",
      description:
        "Generate an interactive TikTok Ads performance report. Uses the Flat MCP reporting API in live mode and a clearly labeled deterministic sample in demo mode. advertiserId is required by TikTok for a BASIC report, but this app can auto-select it when the authorized user has exactly one account. If multiple accounts are available, the result asks the user to choose one. Defaults to the last 7 complete days, campaign level, and previous-period comparison.",
      inputSchema: getAdsReportInput,
      outputSchema: getAdsReportOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: true,
        destructiveHint: false
      }
    }),
    async (input: GetAdsReportInput) => {
      const reportState = await getTikTokAdsReport(input);
      const textByStatus = {
        ready: "Show the interactive TikTok Ads performance report.",
        needs_authorization: "Show the TikTok Ads connection step inside the report card.",
        needs_account: "Show the advertiser account choices inside the report card.",
        empty: "Show the empty report state and selected date range.",
        error: "Show the report error state with retry and demo options."
      } as const;

      return {
        structuredContent: {
          reportState
        },
        content: [
          {
            type: "text",
            text: textByStatus[reportState.status]
          }
        ],
        _meta: {
          ...RESULT_REPORT_META,
          source: reportState.source,
          reportApi: "report_integrated_get",
          reportMcpSurface: "flat"
        }
      };
    }
  );

  const currentWorkspaceState = (): Record<string, unknown> => {
    if (state.currentVideoJob.status === "complete" && state.currentVideoJob.preview) {
      return withRenderJobState(
        renderCompleteResult(state.currentVideoJob.product, state.currentVideoJob.preview),
        state.currentVideoJob
      ) as unknown as Record<string, unknown>;
    }

    if (state.currentVideoJob.status === "pending") {
      return withRenderJobState(renderPendingResult(state.currentVideoJob.product), state.currentVideoJob) as unknown as Record<string, unknown>;
    }

    if (state.currentDraft) {
      return preserveAccountSetupSkip(
        draftResult({
          adId: state.currentDraft.adId,
          adgroupId: state.currentDraft.adgroupId,
          campaignId: state.currentDraft.campaignId,
          createdAtStage: state.currentDraft.creationState,
          product: getCurrentProduct(),
          warnings: state.currentDraft.warnings
        })
      ) as unknown as Record<string, unknown>;
    }

    if (getCurrentProduct().destination !== initialProductState.destination) {
      return scrapeResult(getCurrentProduct().destination, getCurrentProduct()) as unknown as Record<string, unknown>;
    }

    return previewState as unknown as Record<string, unknown>;
  };
  const cardGuidanceText = (widgetState: Record<string, unknown>): string => {
    const screen = String(widgetState.screen || "product");
    const headline = String(widgetState.headline || "");

    if ((widgetState.storeDiscovery as { status?: string } | undefined)?.status === "loading") {
      return "I’m scanning the store for products that look ready to promote on TikTok.";
    }
    if (widgetState.storeDiscovery) {
      return "I found product candidates from the store; reply with the product number or name you want to promote.";
    }
    if (screen === "product") {
      return "I found the product details; reply 'continue' to make storyboard options, or tell me what to correct.";
    }
    if (screen === "creative") {
      return "Here are two storyboard directions; reply 'use option A' or 'use option B', or tell me how to revise them.";
    }
    if (screen === "render" && !widgetState.videoPreview) {
      return "The video preview is rendering; reply 'check preview' when you want me to check the render status.";
    }
    if (screen === "render") {
      return "Here is the video preview; reply 'approve preview' to continue, or ask for another version.";
    }
    if (screen === "onboarding" || screen === "accounts") {
      return "Review the TikTok account setup; reply with the advertiser name or ID to continue.";
    }
    if (screen === "draft") {
      return "Review the launch settings; reply with budget or market changes, or say 'approve launch'.";
    }
    if (screen === "publish" || screen === "reporting") {
      return "Review the post-launch setup; reply when you want to save the reporting plan.";
    }
    return "Review this step, then reply in chat with what you want to do next.";
  };
  const isUserDrivenAction = (args?: InteractionControl) =>
    args?.interactionToken === state.uiActionToken || args?.userAction === "chat_confirmed";
  const waitForUserActionState = (detail: string): ToolViewModel => ({
    ...(currentWorkspaceState() as ToolViewModel),
    blockers: [
      {
        id: "waiting-for-user-action",
        title: "Waiting for your action",
        detail,
        severity: "low"
      }
    ]
  });
  const workspaceEntryState = (args: {
    productUrl?: string;
    reset?: boolean;
    storeUrl?: string;
  }): Record<string, unknown> => {
    const productUrl = args.productUrl || "";
    const storeUrl = args.storeUrl || "";

    if (productUrl) {
      const nextProduct = updateCurrentProduct(inferProductFromUrl(productUrl));
      return scrapeResult(productUrl, nextProduct) as unknown as Record<string, unknown>;
    }

    if (storeUrl) {
      const candidates = inferStoreProductCandidates(storeUrl);
      const selectedCandidate = candidates.find((candidate) => candidate.selected) || candidates[0];
      if (selectedCandidate) {
        updateCurrentProduct({
          destination: selectedCandidate.productUrl,
          imageCount: 3,
          platform: "Store URL discovery",
          price: "Needs confirmation",
          title: selectedCandidate.title
        });
      }
      return storeProductCandidatesResult(storeUrl, candidates) as unknown as Record<string, unknown>;
    }

    if (args.reset) {
      return previewState as unknown as Record<string, unknown>;
    }

    return currentWorkspaceState();
  };

  server.registerTool(
    "open_tiktok_ads_workspace",
    withRenderToolMeta({
      title: "Open Hooray TikTok Ads workspace",
      description:
        "Primary entrypoint for Hooray TikTok Ads. Use this whenever the user wants to create, continue, review, or report on TikTok ads. If productUrl is provided, open directly on Product confirmation. If storeUrl is provided, open directly on Store product picking. The workspace is display-only; user decisions happen in chat.",
      inputSchema: openTikTokAdsWorkspaceInput,
      outputSchema: openTikTokAdsWorkspaceOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      productUrl,
      reset,
      storeUrl
    }: {
      entryReason?: string;
      productUrl?: string;
      reset?: boolean;
      storeUrl?: string;
    }) => {
      const nextWidgetState = workspaceEntryState({ productUrl, reset, storeUrl });

      return {
        structuredContent: {
          widgetState: nextWidgetState
        },
        content: [{ type: "text", text: cardGuidanceText(nextWidgetState) }],
        _meta: {
          ...RESULT_RENDER_META,
          source: "workspace-entry",
          uiActionToken: state.uiActionToken
        }
      };
    }
  );

  server.registerTool(
    "render_tiktok_ads_workspace",
    withRenderToolMeta({
      title: "Render TikTok Ads workspace",
      description:
        "Use this after any Hooray TikTok Ads tool returns widgetState. It renders the display-only ChatGPT App workspace from the supplied widgetState; user decisions continue through chat.",
      inputSchema: renderTikTokAdsWorkspaceInput,
      outputSchema: renderTikTokAdsWorkspaceOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({ widgetState }: { reason?: string; widgetState?: Record<string, unknown> }) => {
      const nextWidgetState = widgetState || currentWorkspaceState();

      return {
        structuredContent: {
          widgetState: nextWidgetState
        },
        content: [{ type: "text", text: cardGuidanceText(nextWidgetState) }],
        _meta: {
          ...RESULT_RENDER_META,
          source: "render-tool",
          uiActionToken: state.uiActionToken
        }
      };
    }
  );

  server.registerTool(
    "plan_account_setup",
    withWidgetToolMeta({
      title: "Plan account setup",
      description: "Guide the advertiser through TikTok authorization, Business Center, advertiser account, and TikTok Account readiness.",
      inputSchema: planAccountSetupInput,
      outputSchema: planAccountSetupOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (
      args: InteractionControl & {
        approvedStoryboardHook?: string;
        approvedStoryboardObjective?: string;
        approvedStoryboardTitle?: string;
      }
    ) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            accountCount: 0,
            widgetState: waitForUserActionState("Approve the preview in the workspace before account setup starts.")
          },
          content: [{ type: "text", text: "Wait for the user to reply 'approve preview' before account setup starts." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      try {
        const result = await listTikTokAdvertiserAccounts();

        if (result.status === "needs_authorization") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              stage: "needs_authorization",
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [{ type: "text", text: "Ask the user to open the TikTok Ads authorization link, then return to this chat." }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              stage: "needs_authorization",
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "config-error"
            }
          };
        }

        if (result.data.accounts.length === 1) {
          const selectedAccount = result.data.accounts[0];
          const identityResult = await verifyTikTokAdvertiserIdentity(selectedAccount.advertiserId);

          if (identityResult.status === "connected" && isAccountSetupReady(selectedAccount, identityResult.data.identities)) {
            const accountSetup = markAccountSetupReady({
              account: selectedAccount,
              identities: identityResult.data.identities
            });

            return {
              structuredContent: {
                stage: "setup_review",
                widgetState: attachCurrentVideoContext(reviewReadyResult({
                  product: getCurrentProduct(),
                  selectedAdvertiserId: accountSetup.selectedAdvertiserId,
                  selectedIdentityId: accountSetup.selectedIdentityId
                }))
              },
              content: [
                {
                  type: "text",
                  text:
                    "Account setup is already complete for this advertiser, so skip the setup step and continue to Review."
                }
              ],
              _meta: {
                ...RESULT_WIDGET_META,
                source: "tiktok-mcp",
                mappedCapabilities:
                  capabilityMap.find((item) => item.productTool === "plan_account_setup")?.currentTikTokAdsCapabilities ?? []
              }
            };
          }
        }

        clearAccountSetupReadiness();
        return {
          structuredContent: {
            stage: result.data.accounts.length > 0 ? "account_selection" : "setup_review",
            widgetState: onboardingWorkspaceResult({
              accounts: result.data.accounts,
              connected: true,
              userDisplayName: result.data.userDisplayName
            })
          },
          content: [{ type: "text", text: "Ask the user to reply with the advertiser account that should own this launch." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp",
            mappedCapabilities:
              capabilityMap.find((item) => item.productTool === "plan_account_setup")?.currentTikTokAdsCapabilities ?? []
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while planning account setup.";
        return {
          structuredContent: {
            stage: "needs_authorization",
            widgetState: accountErrorResult(message, getCurrentProduct())
          },
          content: [{ type: "text", text: `Could not load the account setup workspace: ${message}` }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp-error"
          }
        };
      }
    }
  );

  server.registerTool(
    "scrape_product",
    withWidgetToolMeta({
      title: "Scrape product",
      description:
        "Extract product details and reference images from a product URL, then prepare the first user review checkpoint. After this returns, call render_tiktok_ads_workspace with the returned widgetState.",
      inputSchema: scrapeProductInput,
      outputSchema: scrapeProductOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({ url }: { url: string }) => {
      const nextProduct = updateCurrentProduct(inferProductFromUrl(url));

      return {
        structuredContent: {
          productTitle: nextProduct.title,
          imageCount: nextProduct.imageCount,
          widgetState: scrapeResult(url, nextProduct)
        },
        content: [{ type: "text", text: "Show the detected product details and ask the user to reply 'continue' or provide corrections in chat." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "heuristic-scrape",
          capabilityGaps: capabilityMap.find((item) => item.productTool === "scrape_product")?.gaps ?? []
        }
      };
    }
  );

  server.registerTool(
    "update_product_images",
    withWidgetToolMeta({
      title: "Update product images",
      description: "Replace or add product reference images before storyboard generation.",
      inputSchema: updateProductImagesInput,
      outputSchema: updateProductImagesOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: UpdateProductImagesArgs) => {
      const images = normalizeImageReferences(args);
      if (images.length === 0) {
        return {
          structuredContent: {
            imageCount: 0,
            widgetState: accountErrorResult(
              "No valid image references were received. Add at least one image URL or uploaded image reference before storyboarding.",
              getCurrentProduct()
            )
          },
          content: [
            {
              type: "text",
              text: "No valid image references were received. Send imageUrls, uploadedImageRefs, or images before continuing."
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      const nextProduct = updateCurrentProduct({
        destination: args.productUrl,
        imageCount: images.length
      });

      return {
        structuredContent: {
          imageCount: images.length,
          widgetState: scrapeResult(args.productUrl, nextProduct)
        },
        content: [{ type: "text", text: "Show the updated image count and ask the user to reply 'continue' when ready." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "override_product_details",
    withWidgetToolMeta({
      title: "Override product details",
      description: "Correct scraped product metadata without restarting the current launch flow.",
      inputSchema: overrideProductDetailsInput,
      outputSchema: overrideProductDetailsOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      title,
      productUrl,
      price,
      platform,
      notes
    }: {
      title: string;
      productUrl: string;
      price?: string;
      platform?: string;
      notes?: string;
    }) => {
      const nextProduct = updateCurrentProduct({
        title,
        destination: productUrl,
        price: price || getCurrentProduct().price,
        platform: platform || "Direct product URL",
        notes
      });

      return {
        structuredContent: {
          productTitle: nextProduct.title,
          widgetState: scrapeResult(productUrl, nextProduct)
        },
        content: [{ type: "text", text: "Show the corrected product details and ask the user to reply 'continue' when ready." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "choose_promoted_product",
    withWidgetToolMeta({
      title: "Choose promoted product",
      description: "Guide the advertiser into the right promoted-product path before creative or campaign setup begins.",
      inputSchema: choosePromotedProductInput,
      outputSchema: choosePromotedProductOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      productLabel,
      productSource,
      productUrl
    }: {
      productLabel?: string;
      productSource: "website" | "tiktok_shop" | "lead_generation" | "app";
      productUrl?: string;
    }) => {
      const nextProduct = updateCurrentProduct({
        title: productLabel || getCurrentProduct().title,
        destination: productUrl || getCurrentProduct().destination,
        platform: platformForProductSource(productSource),
        price: productSource === "lead_generation" ? "N/A" : getCurrentProduct().price
      });

      return {
        structuredContent: {
          selectedSource: productSource,
          widgetState: productSelectionResult({
            productLabel: nextProduct.title,
            productSource,
            productUrl: productUrl || nextProduct.destination
          })
        },
        content: [{ type: "text", text: "Show the selected product path and ask the user to continue in chat." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience",
          mappedCapabilities:
            capabilityMap.find((item) => item.productTool === "choose_promoted_product")?.currentTikTokAdsCapabilities ?? []
        }
      };
    }
  );

  server.registerTool(
    "scan_store_products",
    withWidgetToolMeta({
      title: "Scan store products",
      description:
        "Use this when the advertiser provides a store URL and wants help choosing a product. It stays inside the Product step: first render a lightweight loading state, then return only product candidates ready to promote.",
      inputSchema: scanStoreProductsInput,
      outputSchema: scanStoreProductsOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      resultMode,
      storeUrl
    }: {
      resultMode?: "loading" | "results";
      storeUrl: string;
    }) => {
      const mode = resultMode || "results";

      if (mode === "loading") {
        return {
          structuredContent: {
            candidateCount: 0,
            status: "loading",
            storeUrl,
            widgetState: storeProductScanLoadingResult(storeUrl)
          },
          content: [
            {
              type: "text",
              text: "Tell the user Hooray is scanning the store for products that look ready to promote."
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      const candidates = inferStoreProductCandidates(storeUrl);
      const selectedCandidate = candidates.find((candidate) => candidate.selected) || candidates[0];

      updateCurrentProduct({
        destination: selectedCandidate.productUrl,
        imageCount: 3,
        platform: "Store URL discovery",
        price: "Needs confirmation",
        title: selectedCandidate.title
      });

      return {
        structuredContent: {
          candidateCount: candidates.length,
          candidates: candidates.map(({ angle, confidence, id, productUrl, reasons, title }) => ({
            angle,
            confidence,
            id,
            productUrl,
            reasons,
            title
          })),
          status: "ready",
          storeUrl,
          widgetState: storeProductCandidatesResult(storeUrl, candidates)
        },
        content: [
          {
            type: "text",
            text:
              "Show the recommended store products and ask the user to reply with the product number or name."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience",
          capabilityGaps: capabilityMap.find((item) => item.productTool === "scan_store_products")?.gaps ?? []
        }
      };
    }
  );

  server.registerTool(
    "generate_storyboard",
    withWidgetToolMeta({
      title: "Generate storyboard",
      description:
        "Draft a two-scene TikTok storyboard from the approved product inputs and return it for review. After this returns, call render_tiktok_ads_workspace with the returned widgetState.",
      inputSchema: generateStoryboardInput,
      outputSchema: generateStoryboardOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: {
      productTitle: string;
      productDescription: string;
      landingPageUrl: string;
      feedback?: string;
    } & InteractionControl) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            sceneCount: 0,
            widgetState: waitForUserActionState("Confirm the product in the workspace before generating storyboard options.")
          },
          content: [{ type: "text", text: "Wait for the user to reply 'continue' before storyboard generation." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      const { productTitle, productDescription, feedback, landingPageUrl } = args;
      const nextProduct = updateCurrentProduct({
        ...deriveCreativeBrief(productDescription, feedback),
        title: productTitle,
        destination: landingPageUrl
      });

      return {
        structuredContent: {
          sceneCount: 2,
          widgetState: storyboardResult(nextProduct)
        },
        content: [{ type: "text", text: "Show the storyboard options and ask the user to reply 'use option A' or 'use option B'." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "approve_ad_inputs",
    withWidgetToolMeta({
      title: "Approve ad inputs",
      description: "Record approval for the scraped product details, reviewed images, and storyboard before video generation.",
      inputSchema: approveAdInputsInput,
      outputSchema: approveAdInputsOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (
      args: InteractionControl & {
        approvedStoryboardHook?: string;
        approvedStoryboardObjective?: string;
        approvedStoryboardTitle?: string;
      }
    ) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            approvalId: "",
            status: "pending",
            widgetState: waitForUserActionState("Choose a storyboard in the workspace before approving ad inputs.")
          },
          content: [{ type: "text", text: "Wait for the user to choose a storyboard in chat before video rendering." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      const approvedProduct = updateCurrentProduct({
        ...(args.approvedStoryboardTitle ? { creativeBriefTitle: args.approvedStoryboardTitle } : {}),
        ...(args.approvedStoryboardHook ? { creativeBriefHook: args.approvedStoryboardHook } : {}),
        ...(args.approvedStoryboardObjective ? { creativeBriefObjective: args.approvedStoryboardObjective } : {})
      });
      state.currentApprovalId = `approval_${Date.now().toString(36)}`;
      state.approvalSnapshots[state.currentApprovalId] = {
        approvalId: state.currentApprovalId,
        product: approvedProduct,
        approvedAt: new Date().toISOString()
      };
      const renderJob = startVideoRender(state.currentApprovalId, "ugc");
      const renderError = renderJob.error;

      return {
        structuredContent: {
          approvalId: state.currentApprovalId,
          jobId: renderJob.jobId || undefined,
          status: renderJob.status === "idle" ? "pending" : renderJob.status,
          ...(renderError
            ? {
                errorCode: renderError.code,
                errorMessage: renderError.message,
                retryable: renderError.retryable
              }
            : {}),
          widgetState: renderError
            ? withRenderJobState(makeRenderErrorState(renderJob.product, renderError), renderJob)
            : withRenderJobState(renderPendingResult(renderJob.product), renderJob)
        },
        content: [
          {
            type: "text",
            text: renderError
              ? renderError.message
              : "Tell the user the video preview is rendering and ask them to reply 'check preview' when ready."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "generate_video",
    withWidgetToolMeta({
      title: "Generate video",
      description: "Kick off a TikTok ad video render and return a job ID that ChatGPT can poll.",
      inputSchema: generateVideoInput,
      outputSchema: generateVideoOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: {
      approvalId: string;
      creativeBriefHook?: string;
      creativeBriefObjective?: string;
      creativeBriefTitle?: string;
      renderingStyle: "ugc" | "product_demo" | "founder_story";
    } & InteractionControl) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            jobId: "missing_job",
            status: "pending",
            widgetState: waitForUserActionState("Wait for the user to ask for another video version in chat.")
          },
          content: [{ type: "text", text: "Wait for the user to ask for another video version in chat." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      const { approvalId, renderingStyle } = args;
      state.currentApprovalId = approvalId;
      if (state.approvalSnapshots[approvalId]) {
        state.approvalSnapshots[approvalId] = {
          ...state.approvalSnapshots[approvalId],
          product: {
            ...state.approvalSnapshots[approvalId].product,
            ...(args.creativeBriefTitle ? { creativeBriefTitle: args.creativeBriefTitle } : {}),
            ...(args.creativeBriefHook ? { creativeBriefHook: args.creativeBriefHook } : {}),
            ...(args.creativeBriefObjective ? { creativeBriefObjective: args.creativeBriefObjective } : {})
          }
        };
      }
      const renderJob =
        state.currentVideoJob.jobId && state.currentVideoJob.approvalId === approvalId && state.currentVideoJob.status === "pending"
          ? { ...state.currentVideoJob }
          : startVideoRender(approvalId, renderingStyle);
      const renderError = renderJob.error;

      return {
        structuredContent: {
          jobId: renderJob.jobId || "video_job_poc_001",
          status: renderJob.status === "idle" ? "pending" : renderJob.status,
          ...(renderError
            ? {
                errorCode: renderError.code,
                errorMessage: renderError.message,
                retryable: renderError.retryable
              }
            : {}),
          widgetState: renderError
            ? withRenderJobState(makeRenderErrorState(renderJob.product, renderError), renderJob)
            : withRenderJobState(renderPendingResult(renderJob.product), renderJob)
        },
        content: [{ type: "text", text: renderError ? renderError.message : "Tell the user the new video version is rendering and ask them to reply 'check preview' when ready." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "get_video_status",
    withWidgetToolMeta({
      title: "Get video status",
      description: "Return whether the video render is still pending, complete, or failed.",
      inputSchema: getVideoStatusInput,
      outputSchema: getVideoStatusOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: { jobId: string } & InteractionControl) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            status: "pending",
            widgetState: waitForUserActionState("Wait for the user to ask to check the render status.")
          },
          content: [{ type: "text", text: "Wait for the user to ask to check the render status." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      const { jobId } = args;
      if (state.currentVideoJob.jobId !== jobId) {
        const error: RenderError = {
          code: "RENDER_JOB_NOT_FOUND",
          message: `Render job ${jobId} was not found in this launch session. Start a new render from the approved creative state.`,
          retryable: true
        };

        return {
          structuredContent: {
            status: "failed",
            errorCode: error.code,
            errorMessage: error.message,
            retryable: error.retryable,
            widgetState: makeRenderErrorState(getCurrentProduct(), error)
          },
          content: [{ type: "text", text: error.message }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      if (state.currentVideoJob.status === "failed") {
        const error =
          state.currentVideoJob.error ||
          ({
            code: "RENDER_FAILED",
            message: "Video rendering failed, but the renderer did not return a detailed error reason.",
            retryable: true
          } satisfies RenderError);

        return {
          structuredContent: {
            status: "failed",
            errorCode: error.code,
            errorMessage: error.message,
            retryable: error.retryable,
            widgetState: withRenderJobState(makeRenderErrorState(state.currentVideoJob.product, error), state.currentVideoJob)
          },
          content: [{ type: "text", text: error.message }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      state.currentVideoJob.pollCount += 1;

      if (state.currentVideoJob.status === "pending" && state.currentVideoJob.pollCount >= 1) {
        state.currentVideoJob.status = "complete";
      }

      if (state.currentVideoJob.status === "complete") {
        updateCurrentProduct(state.currentVideoJob.product);
        const preview =
          state.currentVideoJob.preview ||
          makeVideoPreview(jobId, state.currentVideoJob.product, state.currentVideoJob.style);
        state.currentVideoJob.preview = preview;

        return {
          structuredContent: {
            status: "complete",
            ...videoPreviewFields(preview),
            widgetState: withRenderJobState(renderCompleteResult(state.currentVideoJob.product, preview), state.currentVideoJob)
          },
          content: [
            {
              type: "text",
              text:
                "Show the video preview and ask the user to reply 'approve preview' or request another version."
            },
            previewResourceLink(preview)
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience",
            videoPreview: preview
          }
        };
      }

      return {
        structuredContent: {
          status: "pending",
          widgetState: withRenderJobState(renderPendingResult(state.currentVideoJob.product), state.currentVideoJob)
        },
        content: [
          {
            type: "text",
            text: "Tell the user the preview is still rendering and they can ask to check again."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "load_creative_options",
    withWidgetToolMeta({
      title: "Load creative options",
      description: "Show whether the advertiser should reuse existing TikTok content or generate fresh creative inside the guided flow.",
      inputSchema: loadCreativeOptionsInput,
      outputSchema: loadCreativeOptionsOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({ productLabel }: { productLabel?: string }) => {
      const nextProduct = productLabel
        ? updateCurrentProduct({
            title: productLabel
          })
        : getCurrentProduct();

      return {
        structuredContent: {
          creativeCount: 3,
          widgetState: creativeWorkspaceResult({ productLabel: nextProduct.title, product: nextProduct })
        },
        content: [{ type: "text", text: "Show the creative options and ask the user to choose in chat." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience",
          mappedCapabilities:
            capabilityMap.find((item) => item.productTool === "load_creative_options")?.currentTikTokAdsCapabilities ?? []
        }
      };
    }
  );

  server.registerTool(
    "get_ad_accounts",
    withWidgetToolMeta({
      title: "Get ad accounts",
      description: "List the advertiser accounts available to the authenticated TikTok user.",
      inputSchema: getAdAccountsInput,
      outputSchema: getAdAccountsOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: InteractionControl = {}) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            accountCount: 0,
            widgetState: waitForUserActionState("Approve the video preview in the workspace before account setup starts.")
          },
          content: [{ type: "text", text: "Wait for the user to reply 'approve preview' before account setup starts." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      try {
        const result = await listTikTokAdvertiserAccounts();

        if (result.status === "needs_authorization") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              accountCount: 0,
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [
              {
                type: "text",
                text: "Ask the user to open the TikTok Ads authorization link before choosing an advertiser."
              }
            ],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              accountCount: 0,
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "config-error"
            }
          };
        }

        if (result.data.accounts.length === 1) {
          const selectedAccount = result.data.accounts[0];
          const identityResult = await verifyTikTokAdvertiserIdentity(selectedAccount.advertiserId);

          if (identityResult.status === "connected" && isAccountSetupReady(selectedAccount, identityResult.data.identities)) {
            const accountSetup = markAccountSetupReady({
              account: selectedAccount,
              identities: identityResult.data.identities
            });

            return {
              structuredContent: {
                accountCount: result.data.accounts.length,
                widgetState: attachCurrentVideoContext(reviewReadyResult({
                  product: getCurrentProduct(),
                  selectedAdvertiserId: accountSetup.selectedAdvertiserId,
                  selectedIdentityId: accountSetup.selectedIdentityId
                }))
              },
              content: [
                {
                  type: "text",
                  text:
                    "Advertiser account and TikTok Account are already ready. Skip Account setup and continue directly to Review."
                }
              ],
              _meta: {
                ...RESULT_WIDGET_META,
                source: "tiktok-mcp",
                mappedCapabilities:
                  capabilityMap.find((item) => item.productTool === "get_ad_accounts")?.currentTikTokAdsCapabilities ?? []
              }
            };
          }
        }

        clearAccountSetupReadiness();
        return {
          structuredContent: {
            accountCount: result.data.accounts.length,
            widgetState: liveAccountResult({
              accounts: result.data.accounts,
              product: getCurrentProduct(),
              userDisplayName: result.data.userDisplayName
            })
          },
          content: [
            {
              type: "text",
              text:
                result.data.accounts.length > 1
                  ? "Ask the user to reply with which advertiser should own the Smart+ draft."
                  : "Ask the user to confirm the advertiser and TikTok Account in chat."
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp",
            mappedCapabilities:
              capabilityMap.find((item) => item.productTool === "get_ad_accounts")?.currentTikTokAdsCapabilities ?? []
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while loading advertiser accounts.";
        return {
          structuredContent: {
            accountCount: 0,
            widgetState: accountErrorResult(message, getCurrentProduct())
          },
          content: [{ type: "text", text: `Could not load advertiser accounts: ${message}` }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp-error"
          }
        };
      }
    }
  );

  server.registerTool(
    "verify_or_connect_tiktok_identity",
    withWidgetToolMeta({
      title: "Verify or connect TikTok identity",
      description: "Check whether the selected ad account has a usable TikTok identity and provide a connect path if not.",
      inputSchema: verifyOrConnectTikTokIdentityInput,
      outputSchema: verifyOrConnectTikTokIdentityOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({ advertiserId, ...control }: { advertiserId: string } & InteractionControl) => {
      if (!isUserDrivenAction(control)) {
        return {
          structuredContent: {
            status: "needs_authorization",
            widgetState: waitForUserActionState("Choose an advertiser account in the workspace before identity verification.")
          },
          content: [{ type: "text", text: "Wait for the user to choose an advertiser in chat before identity verification." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      try {
        const result = await verifyTikTokAdvertiserIdentity(advertiserId);

        if (result.status === "needs_authorization") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              status: "needs_authorization",
              authorizationUrl: result.authorizationUrl,
              redirectUri: result.redirectUri,
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [
              {
                type: "text",
                text: "Ask the user to open the TikTok Ads authorization link before identity verification."
              }
            ],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          clearAccountSetupReadiness();
          return {
            structuredContent: {
              status: "needs_authorization",
              ...(tikTokConfig.advertiserAuthUrl
                ? { authorizationUrl: tikTokConfig.advertiserAuthUrl }
                : {}),
              ...(tikTokConfig.redirectUri ? { redirectUri: tikTokConfig.redirectUri } : {}),
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "config-error"
            }
          };
        }

        if (result.data.identities.length > 0) {
          const accountSetup = markAccountSetupReady({
            advertiserId,
            identities: result.data.identities
          });

          return {
            structuredContent: {
              status: "connected",
              widgetState: attachCurrentVideoContext(reviewReadyResult({
                product: getCurrentProduct(),
                selectedAdvertiserId: accountSetup.selectedAdvertiserId,
                selectedIdentityId: accountSetup.selectedIdentityId
              }))
            },
            content: [
              {
                type: "text",
                text:
                  "Show launch settings now that the TikTok Account is ready, then wait for chat approval."
              }
            ],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "tiktok-mcp"
            }
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while verifying advertiser identity.";
        clearAccountSetupReadiness();
        return {
          structuredContent: {
            status: "needs_authorization",
            ...(tikTokConfig.advertiserAuthUrl
              ? { authorizationUrl: tikTokConfig.advertiserAuthUrl }
              : {}),
            ...(tikTokConfig.redirectUri ? { redirectUri: tikTokConfig.redirectUri } : {}),
            widgetState: accountErrorResult(message, getCurrentProduct())
          },
          content: [
            {
              type: "text",
              text: `Could not verify TikTok identity: ${message}`
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp-error"
          }
        };
      }

      if (tikTokConfig.advertiserAuthUrl && tikTokConfig.redirectUri) {
        clearAccountSetupReadiness();
        return {
          structuredContent: {
            status: "needs_authorization",
            authorizationUrl: tikTokConfig.advertiserAuthUrl,
            redirectUri: tikTokConfig.redirectUri,
            widgetState: identityConnectResult(tikTokConfig.advertiserAuthUrl, tikTokConfig.redirectUri)
          },
          content: [
            {
              type: "text",
              text: "Ask the user to connect a TikTok Account for delivery."
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "config-backed"
          }
        };
      }

      const accountSetup = markAccountSetupReady({ advertiserId });
      return {
        structuredContent: {
          status: "connected",
          widgetState: attachCurrentVideoContext(reviewReadyResult({
            product: getCurrentProduct(),
            selectedAdvertiserId: accountSetup.selectedAdvertiserId
          }))
        },
        content: [
          {
            type: "text",
            text:
              "Show launch settings now that account setup is complete, then wait for chat approval."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "mock"
        }
      };
    }
  );

  server.registerTool(
    "verify_payment_method",
    withWidgetToolMeta({
      title: "Verify payment method",
      description: "Confirm that the selected advertiser has a payment path before publish.",
      inputSchema: verifyPaymentMethodInput,
      outputSchema: verifyPaymentMethodOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args: { advertiserId?: string } & InteractionControl = {}) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            status: "needs_authorization",
            widgetState: waitForUserActionState("Run payment readiness only after the user asks or publish is blocked.")
          },
          content: [{ type: "text", text: "Wait for the user to ask for payment readiness or reach a publish blocker." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      const accountsResult = await listTikTokAdvertiserAccounts();

      if (accountsResult.status === "needs_authorization") {
        clearAccountSetupReadiness();
        return {
          structuredContent: {
            status: "needs_authorization",
            widgetState: accountAuthorizationResult(accountsResult.authorizationUrl, accountsResult.redirectUri)
          },
          content: [{ type: "text", text: "Ask the user to open the TikTok Ads authorization link before payment readiness checks." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp-oauth"
          }
        };
      }

      if (accountsResult.status === "misconfigured") {
        clearAccountSetupReadiness();
        return {
          structuredContent: {
            status: "missing",
            widgetState: accountErrorResult(accountsResult.message, getCurrentProduct())
          },
          content: [{ type: "text", text: accountsResult.message }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "config-error"
          }
        };
      }

      return {
        structuredContent: {
          status: "ready",
          widgetState: state.accountSetup?.ready
            ? attachCurrentVideoContext(reviewReadyResult({
                product: getCurrentProduct(),
                selectedAdvertiserId: state.accountSetup.selectedAdvertiserId,
                selectedIdentityId: state.accountSetup.selectedIdentityId
              }))
            : accountResult(getCurrentProduct())
        },
        content: [
          {
            type: "text",
            text: state.accountSetup?.ready
              ? "Show the review state after payment readiness is checked."
              : "Show the account setup state after payment readiness is checked."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "create_smartplus_campaign",
    withWidgetToolMeta({
      title: "Create Smart+ campaign",
      description: "Create a Smart+ draft campaign from the generated video and reviewed campaign inputs.",
      inputSchema: createSmartplusCampaignInput,
      outputSchema: createSmartplusCampaignOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async (args) => {
      if (!isUserDrivenAction(args)) {
        return {
          structuredContent: {
            campaignId: "",
            adgroupId: "",
            adId: "",
            creationState: "needs_more_inputs",
            warnings: ["Wait for chat approval before creating a Smart+ draft."],
            widgetState: waitForUserActionState("Wait for chat approval before creating a Smart+ draft.")
          },
          content: [{ type: "text", text: "Wait for the user to approve launch settings in chat before creating a Smart+ draft." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      state.currentDraft = null;
      state.currentCampaignApprovalId = null;
      updateCurrentProduct({
        destination: args.productUrl
      });

      try {
        const result = await createSmartPlusCampaignDraft(args);

        if (result.status === "needs_authorization") {
          return {
            structuredContent: {
              campaignId: "",
              adgroupId: "",
              adId: "",
              creationState: "needs_more_inputs",
              warnings: ["Authorize TikTok Ads first, then retry Smart+ draft creation."],
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [{ type: "text", text: "Ask the user to open the TikTok Ads authorization link before creating the Smart+ draft." }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          return {
            structuredContent: {
              campaignId: "",
              adgroupId: "",
              adId: "",
              creationState: "needs_more_inputs",
              warnings: [result.message],
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              ...RESULT_WIDGET_META,
              source: "config-error"
            }
          };
        }

        const optimizationGoalLabel =
          args.optimizationGoal === "landing_page_views" ? "Landing page views" : "Clicks";
        const biddingStrategyLabel =
          args.biddingStrategy === "maximum_delivery" ? "Maximum delivery" : "Cost cap";

        state.currentDraft = {
          adId: result.data.adId,
          adgroupId: result.data.adgroupId,
          campaignId: result.data.campaignId,
          creationState: result.data.creationState,
          warnings: result.data.warnings
        };

        return {
          structuredContent: {
            campaignId: result.data.campaignId,
            adgroupId: result.data.adgroupId,
            adId: result.data.adId,
            creationState: result.data.creationState,
            warnings: result.data.warnings,
            widgetState: preserveAccountSetupSkip(
              draftResult({
                adId: result.data.adId,
                adgroupId: result.data.adgroupId,
                campaignId: result.data.campaignId,
                campaignName: args.campaignName,
                createdAtStage: result.data.creationState,
                adgroupDailyBudget: args.adgroupDailyBudget,
                product: getCurrentProduct(),
                targetCountryCode: args.targetCountryCode,
                optimizationGoalLabel,
                biddingStrategyLabel,
                warnings: result.data.warnings
              })
            )
          },
          content: [
            {
              type: "text",
              text:
                result.data.creationState === "draft_ready"
                  ? "Show the Smart+ draft and ask the user to approve launch settings in chat before publish."
                  : result.data.creationState === "campaign_and_adgroup"
                    ? "Show the campaign and ad group draft, then wait for final approval in chat."
                    : result.data.creationState === "campaign_only"
                      ? "Show the missing ad group details and ask the user how to fill them."
                      : "Show which TikTok inputs are still needed before draft creation."
            }
          ],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp",
            mappedCapabilities:
              capabilityMap.find((item) => item.productTool === "create_smartplus_campaign")?.currentTikTokAdsCapabilities ?? []
          }
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while creating the Smart+ draft.";
        return {
          structuredContent: {
            campaignId: "",
            adgroupId: "",
            adId: "",
            creationState: "needs_more_inputs",
            warnings: [message],
            widgetState: preserveAccountSetupSkip(
              draftResult({
                createdAtStage: "needs_more_inputs",
                product: getCurrentProduct(),
                warnings: [message]
              })
            )
          },
          content: [{ type: "text", text: "Show the missing draft inputs and ask the user to provide corrections in chat." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "tiktok-mcp-error"
          }
        };
      }
    }
  );

  server.registerTool(
    "approve_campaign_parameters",
    withWidgetToolMeta({
      title: "Approve campaign parameters",
      description: "Record final user approval for the draft campaign settings before publish.",
      inputSchema: approveCampaignParametersInput,
      outputSchema: approveCampaignParametersOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      adgroupDailyBudget,
      biddingStrategy,
      campaignId,
      campaignName,
      optimizationGoal,
      targetCountryCode,
      ...control
    }: {
      adgroupDailyBudget?: number;
      biddingStrategy?: string;
      campaignId: string;
      campaignName?: string;
      optimizationGoal?: string;
      targetCountryCode?: string;
    } & InteractionControl) => {
      if (!isUserDrivenAction(control)) {
        return {
          structuredContent: {
            approvalId: "",
            status: "blocked",
            widgetState: waitForUserActionState("Wait for chat approval of launch settings before publish.")
          },
          content: [{ type: "text", text: "Wait for the user to approve launch settings in chat before publish." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      if (!state.currentDraft || !state.currentDraft.campaignId || state.currentDraft.campaignId !== campaignId) {
        return {
          structuredContent: {
            approvalId: "",
            status: "blocked",
            widgetState: preserveAccountSetupSkip(
              draftResult({
                createdAtStage: "needs_more_inputs",
                product: getCurrentProduct(),
                warnings: ["Create a real Smart+ draft before approving campaign parameters."]
              })
            )
          },
          content: [{ type: "text", text: "Show that a matching Smart+ draft is required before launch approval." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      state.currentCampaignApprovalId = `campaign_approval_${campaignId}`;
      const approvedDraftState = preserveAccountSetupSkip(
        draftResult({
          adId: state.currentDraft.adId,
          adgroupId: state.currentDraft.adgroupId,
          campaignId: state.currentDraft.campaignId,
          campaignName,
          createdAtStage: state.currentDraft.creationState,
          adgroupDailyBudget,
          targetCountryCode,
          optimizationGoalLabel: optimizationGoal,
          biddingStrategyLabel: biddingStrategy,
          product: getCurrentProduct(),
          warnings: state.currentDraft.warnings
        })
      );
      approvedDraftState.primaryCta = "Publish campaign";
      approvedDraftState.secondaryCta = "Edit campaign details";
      approvedDraftState.publish = {
        state: "approved",
        campaignId,
        approvalId: state.currentCampaignApprovalId,
        nextCheckIn: "Publish only after confirming the advertiser is ready to start spend."
      };

      return {
        structuredContent: {
          approvalId: state.currentCampaignApprovalId,
          status: "approved",
          widgetState: approvedDraftState
        },
        content: [{ type: "text", text: "Show the approved launch state and wait for the user to say publish." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "publish_campaign",
    withWidgetToolMeta({
      title: "Publish campaign",
      description: "Publish the approved campaign and return a post-launch summary.",
      inputSchema: publishCampaignInput,
      outputSchema: publishCampaignOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      approvalId,
      campaignId,
      ...control
    }: {
      approvalId: string;
      campaignId: string;
    } & InteractionControl) => {
      if (!isUserDrivenAction(control)) {
        return {
          structuredContent: {
            publishState: "needs_review",
            widgetState: waitForUserActionState("Wait for final chat confirmation before publish.")
          },
          content: [{ type: "text", text: "Wait for final chat confirmation before publish." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      if (
        !state.currentDraft ||
        !state.currentDraft.campaignId ||
        state.currentDraft.campaignId !== campaignId ||
        !state.currentCampaignApprovalId ||
        state.currentCampaignApprovalId !== approvalId
      ) {
        return {
          structuredContent: {
            publishState: "needs_review",
            widgetState: preserveAccountSetupSkip(
              draftResult({
                createdAtStage: state.currentDraft?.creationState || "needs_more_inputs",
                product: getCurrentProduct(),
                warnings: [
                  "Publish is blocked until a Smart+ draft exists and the same draft has been explicitly approved in this session."
                ]
              })
            )
          },
          content: [{ type: "text", text: "Show that the matching Smart+ draft must be approved before publishing." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "guided-experience"
          }
        };
      }

      return {
        structuredContent: {
          publishState: "submitted",
          widgetState: preserveAccountSetupSkip(publishResult(getCurrentProduct()))
        },
        content: [{ type: "text", text: "Show launch submission and ask whether to set up the reporting digest." }],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience"
        }
      };
    }
  );

  server.registerTool(
    "setup_reporting_digest",
    withWidgetToolMeta({
      title: "Setup reporting digest",
      description: "Guide the advertiser into a lightweight reporting lane after launch, from in-chat digests to async exports or webhooks.",
      inputSchema: setupReportingDigestInput,
      outputSchema: setupReportingDigestOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      advertiserId,
      cadence,
      deliveryMode,
      focus,
      ...control
    }: {
      advertiserId: string;
      cadence: "daily" | "weekly" | "monthly";
      deliveryMode: "chatgpt_digest" | "async_export" | "webhook";
      focus: "creative" | "delivery" | "conversion";
    } & InteractionControl) => {
      if (!isUserDrivenAction(control)) {
        return {
          structuredContent: {
            planStatus: "needs_access",
            widgetState: waitForUserActionState("Wait for the user to ask to save reporting after publish.")
          },
          content: [{ type: "text", text: "Wait for the user to ask to save reporting after publish." }],
          _meta: {
            ...RESULT_WIDGET_META,
            source: "state-machine-gate"
          }
        };
      }

      return {
        structuredContent: {
          planStatus: deliveryMode === "webhook" ? "allowlist_limited" : "ready",
          widgetState: reportingSetupResult({
            advertiserId,
            cadence,
            deliveryMode,
            focus
          })
        },
        content: [
          {
            type: "text",
            text:
              deliveryMode === "webhook"
                ? "Show the webhook caveats before saving reporting."
                : "Show the post-launch digest plan."
          }
        ],
        _meta: {
          ...RESULT_WIDGET_META,
          source: "guided-experience",
          mappedCapabilities:
            capabilityMap.find((item) => item.productTool === "setup_reporting_digest")?.currentTikTokAdsCapabilities ?? []
        }
      };
    }
  );

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("TikTok Ads Agent POC server scaffold loaded.");
  console.log("Run `npm run dev` to start the MCP HTTP server.");
}
