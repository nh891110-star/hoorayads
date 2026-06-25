import { z } from "zod";

export const scrapeProductInput = {
  url: z.string().url()
};

export const scrapeProductOutput = {
  productTitle: z.string(),
  imageCount: z.number(),
  widgetState: z.record(z.any())
};

export const updateProductImagesInput = {
  productUrl: z.string().url(),
  images: z
    .array(
      z.union([
        z.string(),
        z.object({
          source: z.enum(["url", "upload"]).optional(),
          value: z.string()
        })
      ])
    )
    .optional(),
  imageUrls: z.array(z.string()).optional(),
  uploadedImageRefs: z.array(z.string()).optional()
};

export const updateProductImagesOutput = {
  imageCount: z.number(),
  widgetState: z.record(z.any())
};

export const overrideProductDetailsInput = {
  title: z.string(),
  productUrl: z.string().url(),
  price: z.string().optional(),
  platform: z.string().optional(),
  notes: z.string().optional()
};

export const overrideProductDetailsOutput = {
  productTitle: z.string(),
  widgetState: z.record(z.any())
};

export const generateStoryboardInput = {
  productTitle: z.string(),
  productDescription: z.string(),
  landingPageUrl: z.string().url(),
  feedback: z.string().optional()
};

export const generateStoryboardOutput = {
  sceneCount: z.number(),
  widgetState: z.record(z.any())
};

export const approveAdInputsInput = {
  approvalNotes: z.string().optional(),
  approvedStoryboardVersion: z.string(),
  approvedImageCount: z.number().min(1).max(3)
};

export const approveAdInputsOutput = {
  approvalId: z.string(),
  jobId: z.string().optional(),
  status: z.enum(["pending", "complete", "failed"]).optional(),
  widgetState: z.record(z.any())
};

export const generateVideoInput = {
  approvalId: z.string(),
  renderingStyle: z.enum(["ugc", "product_demo", "founder_story"]).default("ugc")
};

export const generateVideoOutput = {
  jobId: z.string(),
  status: z.enum(["pending", "complete", "failed"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  retryable: z.boolean().optional(),
  widgetState: z.record(z.any())
};

export const getVideoStatusInput = {
  jobId: z.string()
};

export const getVideoStatusOutput = {
  status: z.enum(["pending", "complete", "failed"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  retryable: z.boolean().optional(),
  widgetState: z.record(z.any())
};

export const getAdAccountsInput = {};

export const getAdAccountsOutput = {
  accountCount: z.number(),
  widgetState: z.record(z.any())
};

export const planAccountSetupInput = {};

export const planAccountSetupOutput = {
  stage: z.enum(["needs_authorization", "account_selection", "setup_review"]),
  widgetState: z.record(z.any())
};

export const verifyOrConnectTikTokIdentityInput = {
  advertiserId: z.string()
};

export const verifyOrConnectTikTokIdentityOutput = {
  status: z.enum(["connected", "needs_authorization"]),
  authorizationUrl: z.string().url().optional(),
  redirectUri: z.string().url().optional(),
  widgetState: z.record(z.any())
};

export const verifyPaymentMethodInput = {
  advertiserId: z.string()
};

export const verifyPaymentMethodOutput = {
  status: z.enum(["ready", "missing", "needs_authorization"]),
  widgetState: z.record(z.any())
};

export const choosePromotedProductInput = {
  productLabel: z.string().optional(),
  productSource: z.enum(["website", "tiktok_shop", "lead_generation", "app"]).default("website"),
  productUrl: z.string().url().optional()
};

export const choosePromotedProductOutput = {
  selectedSource: z.string(),
  widgetState: z.record(z.any())
};

export const loadCreativeOptionsInput = {
  advertiserId: z.string().optional(),
  identityAuthorizedBcId: z.string().optional(),
  identityId: z.string().optional(),
  identityType: z.enum(["TT_USER", "BC_AUTH_TT"]).optional(),
  productLabel: z.string().optional()
};

export const loadCreativeOptionsOutput = {
  creativeCount: z.number(),
  widgetState: z.record(z.any())
};

export const createSmartplusCampaignInput = {
  advertiserId: z.string(),
  productUrl: z.string().url(),
  generatedVideoJobId: z.string(),
  campaignName: z.string(),
  targetCountryCode: z.string().length(2),
  adgroupDailyBudget: z.number().positive(),
  optimizationGoal: z.enum(["landing_page_views", "clicks"]).default("clicks"),
  biddingStrategy: z.enum(["maximum_delivery", "cost_cap"]).default("maximum_delivery"),
  bidPrice: z.number().positive().optional(),
  locationIds: z.array(z.string()).min(1).optional(),
  pixelId: z.string().optional(),
  videoId: z.string().optional(),
  identityId: z.string().optional(),
  identityType: z.enum(["TT_USER", "BC_AUTH_TT"]).optional(),
  identityAuthorizedBcId: z.string().optional(),
  adText: z.string().optional(),
  callToAction: z.string().optional(),
  scheduleStartTime: z.string().optional()
};

export const createSmartplusCampaignOutput = {
  campaignId: z.string(),
  adgroupId: z.string(),
  adId: z.string(),
  creationState: z.enum(["needs_more_inputs", "campaign_only", "campaign_and_adgroup", "draft_ready"]),
  warnings: z.array(z.string()),
  widgetState: z.record(z.any())
};

export const approveCampaignParametersInput = {
  campaignId: z.string()
};

export const approveCampaignParametersOutput = {
  approvalId: z.string(),
  status: z.enum(["approved", "blocked"]),
  widgetState: z.record(z.any())
};

export const publishCampaignInput = {
  approvalId: z.string(),
  campaignId: z.string()
};

export const publishCampaignOutput = {
  publishState: z.enum(["submitted", "published", "needs_review"]),
  widgetState: z.record(z.any())
};

export const setupReportingDigestInput = {
  advertiserId: z.string(),
  cadence: z.enum(["daily", "weekly", "monthly"]).default("weekly"),
  deliveryMode: z.enum(["chatgpt_digest", "async_export", "webhook"]).default("chatgpt_digest"),
  focus: z.enum(["creative", "delivery", "conversion"]).default("conversion")
};

export const setupReportingDigestOutput = {
  planStatus: z.enum(["ready", "needs_access", "allowlist_limited"]),
  widgetState: z.record(z.any())
};

export type CapabilityMapping = {
  productTool: string;
  purpose: string;
  currentTikTokAdsCapabilities: string[];
  gaps: string[];
};

export const capabilityMap: CapabilityMapping[] = [
  {
    productTool: "plan_account_setup",
    purpose: "Guide the advertiser through authorization, account selection, identity readiness, pixel readiness, and billing handoff.",
    currentTikTokAdsCapabilities: [
      "user_info_get",
      "bc_get",
      "bc_asset_get",
      "advertiser_info_get",
      "identity_get",
      "pixel_list_get"
    ],
    gaps: [
      "There is still no direct payment-method readiness API in the current MCP surface.",
      "Billing setup still needs a TTAM or Business Center handoff."
    ]
  },
  {
    productTool: "scrape_product",
    purpose: "Extract product title, description, price, and reference images from a submitted URL.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Scraping is not part of the current TikTok Ads MCP surface.",
      "We need a scraper or product-intake service that normalizes arbitrary product pages."
    ]
  },
  {
    productTool: "update_product_images",
    purpose: "Let the user replace or add reference images before storyboard and video generation.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Image validation and storage are outside the current TikTok Ads MCP.",
      "ChatGPT file handling should feed this tool in a production build."
    ]
  },
  {
    productTool: "override_product_details",
    purpose: "Let the advertiser correct scraped product metadata without restarting the launch flow.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Product metadata correction sits in the ChatGPT app orchestration layer rather than TikTok Ads MCP."
    ]
  },
  {
    productTool: "choose_promoted_product",
    purpose: "Guide the advertiser into the right promoted-product path before creative or campaign setup begins.",
    currentTikTokAdsCapabilities: [
      "catalog_location_currency_get",
      "campaign_gmv_max_create"
    ],
    gaps: [
      "Arbitrary product scraping is still external to TikTok Ads MCP.",
      "GMV Max and TikTok Shop product paths have extra eligibility and allowlist constraints."
    ]
  },
  {
    productTool: "generate_storyboard",
    purpose: "Turn scraped product data into a two-scene TikTok ad storyboard for user review.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Storyboard generation should use OpenAI reasoning plus image generation, not the TikTok Ads MCP alone."
    ]
  },
  {
    productTool: "approve_ad_inputs",
    purpose: "Freeze product details, images, and storyboard before video generation.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Needs a session store and approval artifact layer."
    ]
  },
  {
    productTool: "generate_video",
    purpose: "Kick off the ad video render and hand back a job ID for polling.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Video rendering is external to the current TikTok Ads MCP.",
      "Needs a rendering provider plus watermarking/post-processing orchestration."
    ]
  },
  {
    productTool: "get_video_status",
    purpose: "Return rendering state and final video preview links.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Needs render-job persistence and file hosting."
    ]
  },
  {
    productTool: "load_creative_options",
    purpose: "Show the advertiser whether to reuse an existing TikTok post, select an existing asset, or generate a fresh ad concept.",
    currentTikTokAdsCapabilities: [
      "identity_video_get",
      "file_video_suggestcover_get",
      "creative_report_get"
    ],
    gaps: [
      "Net-new storyboard and video generation still needs an OpenAI and rendering pipeline outside TikTok Ads MCP."
    ]
  },
  {
    productTool: "get_ad_accounts",
    purpose: "List the TikTok advertiser accounts available to the authenticated user.",
    currentTikTokAdsCapabilities: [
      "user_info_get",
      "bc_get",
      "advertiser_info_get"
    ],
    gaps: [
      "The current MCP does not expose a single ready-made get_ad_accounts tool, so we should synthesize one from available account discovery endpoints."
    ]
  },
  {
    productTool: "verify_or_connect_tiktok_identity",
    purpose: "Check if the selected ad account has a usable TikTok identity and, if not, return a connect path.",
    currentTikTokAdsCapabilities: [
      "identity_get"
    ],
    gaps: [
      "Identity connect-link generation and callback handling need a TikTok auth adapter outside the current MCP."
    ]
  },
  {
    productTool: "verify_payment_method",
    purpose: "Confirm the selected ad account has a usable payment path before publish.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Payment method inspection is not currently represented in the observed MCP surface.",
      "We need either a payment-specific API bridge or a TTAM handoff."
    ]
  },
  {
    productTool: "create_smartplus_campaign",
    purpose: "Create a draft Smart+ campaign using the generated video and reviewed defaults.",
    currentTikTokAdsCapabilities: [
      "smart_plus_campaign_create",
      "smart_plus_adgroup_get",
      "smart_plus_adgroup_update",
      "smart_plus_ad_create",
      "adgroup_quota_get",
      "adgroup_review_info_get"
    ],
    gaps: [
      "We still need a safe draft orchestration layer that uploads the video and composes campaign, ad group, and ad writes in sequence."
    ]
  },
  {
    productTool: "approve_campaign_parameters",
    purpose: "Record the user's final approval of budget, targeting, destination, and selected account.",
    currentTikTokAdsCapabilities: [],
    gaps: [
      "Needs approval persistence and a clean review card state."
    ]
  },
  {
    productTool: "publish_campaign",
    purpose: "Submit the approved campaign and return a post-launch summary.",
    currentTikTokAdsCapabilities: [
      "ad_status_update",
      "smart_plus_adgroup_status_update",
      "report_integrated_get"
    ],
    gaps: [
      "Final publish should normalize review, payment, and policy outcomes into user-facing states."
    ]
  },
  {
    productTool: "setup_reporting_digest",
    purpose: "Set up a recurring reporting lane with either synchronous views, async exports, or webhook-based digests.",
    currentTikTokAdsCapabilities: [
      "report_integrated_get",
      "report_task_create",
      "report_task_check",
      "subscription_subscribe_create",
      "creative_report_get",
      "creative_fatigue_get"
    ],
    gaps: [
      "Webhook-based report subscriptions can be allowlist-limited and need a durable callback + notification layer.",
      "A polished recurring ChatGPT digest still needs thread-side scheduling and summarization orchestration."
    ]
  }
];
