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
  getAdAccountsInput,
  getAdAccountsOutput,
  getVideoStatusInput,
  getVideoStatusOutput,
  loadCreativeOptionsInput,
  loadCreativeOptionsOutput,
  planAccountSetupInput,
  planAccountSetupOutput,
  publishCampaignInput,
  publishCampaignOutput,
  overrideProductDetailsInput,
  overrideProductDetailsOutput,
  scrapeProductInput,
  scrapeProductOutput,
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
  renderPendingResult,
  reportingSetupResult,
  scrapeResult,
  storyboardResult
} from "./mock-data.js";
import type { ProductContext } from "./mock-data.js";
import { getTikTokAppConfig } from "./config.js";
import {
  createSmartPlusCampaignDraft,
  listTikTokAdvertiserAccounts,
  verifyTikTokAdvertiserIdentity
} from "./tiktok-mcp.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const widgetJs = readFileSync(join(currentDir, "../web/widget.js"), "utf8");
const widgetCss = readFileSync(join(currentDir, "../web/widget.css"), "utf8");
const RESOURCE_URI_META_KEY = "ui/resourceUri";
const RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
const WIDGET_URI = "ui://widget/tiktok-ads-workspace-v4.html";
const WIDGET_DOMAIN = "https://mcp.hoorayads.org";
const WIDGET_DESCRIPTION =
  "Interactive TikTok Ads workspace for account setup, product intake, creative review, campaign drafting, publish, and reporting.";
const TOOL_WIDGET_META = {
  ui: {
    resourceUri: WIDGET_URI,
    visibility: ["model", "app"]
  },
  "openai/outputTemplate": WIDGET_URI,
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Preparing TikTok Ads workspace...",
  "openai/toolInvocation/invoked": "TikTok Ads workspace ready."
} as const;

function withWidgetToolMeta<T extends object>(definition: T): T & { _meta: Record<string, unknown> } {
  return {
    ...definition,
    _meta: {
      ...TOOL_WIDGET_META,
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
  product: SessionProductState;
  error?: RenderError;
  status: RenderStatus;
  style: "ugc" | "product_demo" | "founder_story";
};

type LaunchState = {
  approvalSnapshots: Record<string, ApprovalSnapshot>;
  currentApprovalId: string | null;
  currentCampaignApprovalId: string | null;
  currentDraft: DraftSessionState;
  currentProduct: SessionProductState;
  currentVideoJob: VideoJobState;
};

const initialProductState: SessionProductState = {
  title: "Promoted product",
  price: "Pending merchant price",
  destination: "Pending user input",
  platform: "Direct product URL",
  imageCount: 0
};

const sharedLaunchState: LaunchState = {
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
  }
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
  const isRenderableProduct = (product: SessionProductState): boolean =>
    product.title !== initialProductState.title &&
    product.destination !== initialProductState.destination &&
    /^https?:\/\//.test(product.destination);
  const productContextError = (approvalId: string): RenderError => ({
    code: "PRODUCT_CONTEXT_MISSING",
    message: `Video rendering could not start because approval ${approvalId} is not linked to a complete product title and landing page. Review or override product details, then approve again.`,
    retryable: true
  });
  const makeRenderErrorState = (product: SessionProductState, error: RenderError) => ({
    ...renderPendingResult(product),
    headline: "Creative render needs attention",
    summary: error.message,
    primaryCta: error.retryable ? "Retry render" : "Review launch flow",
    secondaryCta: "Edit product details",
    blockers: [
      {
        severity: error.retryable ? "warning" : "critical",
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
  const startVideoRender = (
    approvalId: string,
    style: "ugc" | "product_demo" | "founder_story" = "ugc"
  ) => {
    const jobId = `video_job_${approvalId.replace(/^approval_/, "")}`;
    const approvedProduct = state.approvalSnapshots[approvalId]?.product || getCurrentProduct();
    const error = isRenderableProduct(approvedProduct) ? undefined : productContextError(approvalId);
    state.currentVideoJob = {
      approvalId,
      jobId,
      pollCount: 0,
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
        return {
          source: "tiktok-mcp-oauth",
          text: "Video render is done, but TikTok Ads authorization is still required before advertiser setup can continue.",
          widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
        } as const;
      }

      if (result.status === "misconfigured") {
        return {
          source: "config-error",
          text: result.message,
          widgetState: accountErrorResult(result.message, getCurrentProduct())
        } as const;
      }

      if (result.data.accounts.length === 0) {
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
          return {
            source: "tiktok-mcp-oauth",
            text: "Video render is done, but identity verification still needs TikTok Ads authorization to finish.",
            widgetState: accountAuthorizationResult(identityResult.authorizationUrl, identityResult.redirectUri)
          } as const;
        }

        if (identityResult.status === "misconfigured") {
          return {
            source: "config-error",
            text: identityResult.message,
            widgetState: accountErrorResult(identityResult.message, getCurrentProduct())
          } as const;
        }

        if (identityResult.data.identities.length > 0) {
          return {
            source: "tiktok-mcp",
            text: "Video render complete. Advertiser account and usable identity are ready. The next step is Smart+ draft inputs, not another setup detour.",
            widgetState: liveAccountResult({
              accounts: result.data.accounts,
              product: getCurrentProduct(),
              selectedAdvertiserId: selectedAccount.advertiserId,
              selectedIdentities: identityResult.data.identities,
              userDisplayName: result.data.userDisplayName
            })
          } as const;
        }

        if (tikTokConfig.advertiserAuthUrl && tikTokConfig.redirectUri) {
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
        "Guide the advertiser through account setup, promoted-product choice, creative selection or generation, Smart+ draft review, publish, and reporting setup. Keep responses visual, specific, and beginner-safe."
    }
  );

  server.registerResource(
    "tiktok-ads-workspace",
    WIDGET_URI,
    {
      title: "TikTok Ads workspace",
      mimeType: RESOURCE_MIME_TYPE
    },
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
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

  server.registerTool(
    "plan_account_setup",
    withWidgetToolMeta({
      title: "Plan account setup",
      description: "Guide the advertiser through TikTok authorization, advertiser selection, identity readiness, and billing handoff.",
      inputSchema: planAccountSetupInput,
      outputSchema: planAccountSetupOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async () => {
      try {
        const result = await listTikTokAdvertiserAccounts();

        if (result.status === "needs_authorization") {
          return {
            structuredContent: {
              stage: "needs_authorization",
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [{ type: "text", text: "Authorize TikTok Ads first, then continue account setup in the same workspace." }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          return {
            structuredContent: {
              stage: "needs_authorization",
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "config-error"
            }
          };
        }

        return {
          structuredContent: {
            stage: result.data.accounts.length > 0 ? "account_selection" : "setup_review",
            widgetState: onboardingWorkspaceResult({
              accounts: result.data.accounts,
              connected: true,
              userDisplayName: result.data.userDisplayName
            })
          },
          content: [{ type: "text", text: "Account setup workspace is ready. The user can now pick an advertiser and continue the launch flow." }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
      description: "Extract product details and reference images from a product URL, then prepare the first user review checkpoint.",
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
        content: [{ type: "text", text: "Scraped product details are ready for review." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
        content: [{ type: "text", text: "Reference images updated. Ask the user to confirm them before moving on." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
        content: [{ type: "text", text: "Product details corrected. The launch flow can continue without re-scraping the product." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
        content: [{ type: "text", text: "Product-path guidance is ready. Let the user choose the simplest viable launch lane before creative work starts." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
          source: "guided-experience",
          mappedCapabilities:
            capabilityMap.find((item) => item.productTool === "choose_promoted_product")?.currentTikTokAdsCapabilities ?? []
        }
      };
    }
  );

  server.registerTool(
    "generate_storyboard",
    withWidgetToolMeta({
      title: "Generate storyboard",
      description: "Draft a two-scene TikTok storyboard from the approved product inputs and return it for review.",
      inputSchema: generateStoryboardInput,
      outputSchema: generateStoryboardOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    }),
    async ({
      productTitle,
      productDescription,
      feedback,
      landingPageUrl
    }: {
      productTitle: string;
      productDescription: string;
      landingPageUrl: string;
      feedback?: string;
    }) => {
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
        content: [{ type: "text", text: "Storyboard ready. Keep the review in rich UI and wait for explicit approval." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async () => {
      const approvedProduct = getCurrentProduct();
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
          widgetState: renderError ? makeRenderErrorState(renderJob.product, renderError) : renderPendingResult(renderJob.product)
        },
        content: [
          {
            type: "text",
            text: renderError
              ? renderError.message
              : "Inputs approved and video rendering started automatically. This still has not submitted anything to TikTok Ads yet; campaign creation begins after render and advertiser setup."
          }
        ],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async ({
      approvalId,
      renderingStyle
    }: {
      approvalId: string;
      renderingStyle: "ugc" | "product_demo" | "founder_story";
    }) => {
      state.currentApprovalId = approvalId;
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
          widgetState: renderError ? makeRenderErrorState(renderJob.product, renderError) : renderPendingResult(renderJob.product)
        },
        content: [{ type: "text", text: renderError ? renderError.message : "Video generation started. Poll for completion instead of blocking." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async ({ jobId }: { jobId: string }) => {
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
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            widgetState: makeRenderErrorState(state.currentVideoJob.product, error)
          },
          content: [{ type: "text", text: error.message }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
        const nextWorkspace = await loadAdvertiserWorkspace();

        return {
          structuredContent: {
            status: "complete",
            widgetState: nextWorkspace.widgetState
          },
          content: [
            {
              type: "text",
              text: nextWorkspace.text
            }
          ],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: nextWorkspace.source
          }
        };
      }

      return {
        structuredContent: {
          status: "pending",
          widgetState: renderPendingResult(state.currentVideoJob.product)
        },
        content: [
          {
            type: "text",
            text: "Video render is still in progress. Stay in the same workspace and poll again."
          }
        ],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
        content: [{ type: "text", text: "Creative lanes are ready. The advertiser can choose between existing TikTok content, product-media reuse, or a net-new generated ad." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async () => {
      try {
        const result = await listTikTokAdvertiserAccounts();

        if (result.status === "needs_authorization") {
          return {
            structuredContent: {
              accountCount: 0,
              widgetState: accountAuthorizationResult(result.authorizationUrl, result.redirectUri)
            },
            content: [
              {
                type: "text",
                text: "TikTok Ads authorization is required before advertiser accounts can be loaded."
              }
            ],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          return {
            structuredContent: {
              accountCount: 0,
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "config-error"
            }
          };
        }

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
                  ? "Advertiser accounts loaded. Ask the user which account to use for the Smart+ draft."
                  : "Advertiser account loaded. The app can continue to identity verification."
            }
          ],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async ({ advertiserId }: { advertiserId: string }) => {
      try {
        const result = await verifyTikTokAdvertiserIdentity(advertiserId);

        if (result.status === "needs_authorization") {
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
                text: "Authorize TikTok Ads first, then continue identity verification for this advertiser."
              }
            ],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "tiktok-mcp-oauth"
            }
          };
        }

        if (result.status === "misconfigured") {
          return {
            structuredContent: {
              status: "needs_authorization",
              authorizationUrl: tikTokConfig.advertiserAuthUrl || "https://ads.tiktok.com/mcp",
              redirectUri: tikTokConfig.redirectUri,
              widgetState: accountErrorResult(result.message, getCurrentProduct())
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "config-error"
            }
          };
        }

        if (result.data.identities.length > 0) {
          return {
            structuredContent: {
              status: "connected",
              widgetState: liveAccountResult({
                accounts: [],
                selectedAdvertiserId: advertiserId,
                selectedIdentities: result.data.identities,
                product: getCurrentProduct()
              })
            },
            content: [{ type: "text", text: "TikTok identity is available for the selected advertiser." }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
              source: "tiktok-mcp"
            }
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error while verifying advertiser identity.";
        return {
          structuredContent: {
            status: "needs_authorization",
            authorizationUrl: tikTokConfig.advertiserAuthUrl,
            redirectUri: tikTokConfig.redirectUri,
            widgetState: accountErrorResult(message, getCurrentProduct())
          },
          content: [
            {
              type: "text",
              text: `Could not verify TikTok identity: ${message}`
            }
          ],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "tiktok-mcp-error"
          }
        };
      }

      if (tikTokConfig.advertiserAuthUrl && tikTokConfig.redirectUri) {
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
              text: "This advertiser needs a TikTok identity connection before the campaign draft can be created."
            }
          ],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "config-backed"
          }
        };
      }

      return {
          structuredContent: {
            status: "connected",
            widgetState: accountResult(getCurrentProduct())
          },
        content: [{ type: "text", text: "TikTok identity is available for the selected advertiser." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async () => {
      const accountsResult = await listTikTokAdvertiserAccounts();

      if (accountsResult.status === "needs_authorization") {
        return {
          structuredContent: {
            status: "needs_authorization",
            widgetState: accountAuthorizationResult(accountsResult.authorizationUrl, accountsResult.redirectUri)
          },
          content: [{ type: "text", text: "Authorize TikTok Ads first. Payment readiness cannot be checked before advertiser access is live." }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "tiktok-mcp-oauth"
          }
        };
      }

      if (accountsResult.status === "misconfigured") {
        return {
          structuredContent: {
            status: "missing",
            widgetState: accountErrorResult(accountsResult.message, getCurrentProduct())
          },
          content: [{ type: "text", text: accountsResult.message }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "config-error"
          }
        };
      }

      return {
        structuredContent: {
          status: "ready",
          widgetState: accountResult(getCurrentProduct())
        },
        content: [{ type: "text", text: "Payment path looks ready for draft review and publish." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            content: [{ type: "text", text: "TikTok Ads authorization is required before Smart+ draft creation can continue." }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
              widgetState: draftResult({
                createdAtStage: "needs_more_inputs",
                product: getCurrentProduct(),
                warnings: [result.message]
              })
            },
            content: [{ type: "text", text: result.message }],
            _meta: {
              [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            widgetState: draftResult({
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
          },
          content: [
            {
              type: "text",
              text:
                result.data.creationState === "draft_ready"
                  ? "Smart+ draft created in TikTok. Ask the user to review and approve campaign parameters before publish."
                  : result.data.creationState === "campaign_and_adgroup"
                    ? "TikTok campaign and ad group drafts are created. One more creative or identity step is still needed before final approval."
                    : result.data.creationState === "campaign_only"
                      ? "The top-level TikTok campaign draft is created, but ad group setup still needs attention."
                      : "The app needs a few more TikTok inputs before it can create the Smart+ draft."
            }
          ],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
            widgetState: draftResult({
              createdAtStage: "needs_more_inputs",
              product: getCurrentProduct(),
              warnings: [message]
            })
          },
          content: [{ type: "text", text: `Could not create the Smart+ draft: ${message}` }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
    async ({ campaignId }: { campaignId: string }) => {
      if (!state.currentDraft || !state.currentDraft.campaignId || state.currentDraft.campaignId !== campaignId) {
        return {
          structuredContent: {
            approvalId: "",
            status: "blocked",
            widgetState: draftResult({
              createdAtStage: "needs_more_inputs",
              product: getCurrentProduct(),
              warnings: ["Create a real Smart+ draft before approving campaign parameters."]
            })
          },
          content: [{ type: "text", text: "Campaign approval is blocked because this launch session does not yet have a matching Smart+ draft." }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "guided-experience"
          }
        };
      }

      state.currentCampaignApprovalId = `campaign_approval_${campaignId}`;

      return {
        structuredContent: {
          approvalId: state.currentCampaignApprovalId,
          status: "approved",
          widgetState: draftResult({
            adId: state.currentDraft.adId,
            adgroupId: state.currentDraft.adgroupId,
            campaignId: state.currentDraft.campaignId,
            createdAtStage: state.currentDraft.creationState,
            product: getCurrentProduct(),
            warnings: state.currentDraft.warnings
          })
        },
        content: [{ type: "text", text: "Campaign parameters approved. The app may now publish." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
      campaignId
    }: {
      approvalId: string;
      campaignId: string;
    }) => {
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
            widgetState: draftResult({
              createdAtStage: state.currentDraft?.creationState || "needs_more_inputs",
              product: getCurrentProduct(),
              warnings: [
                "Publish is blocked until a Smart+ draft exists and the same draft has been explicitly approved in this session."
              ]
            })
          },
          content: [{ type: "text", text: "Publish is blocked because this session does not have a matching approved Smart+ draft yet." }],
          _meta: {
            [RESOURCE_URI_META_KEY]: WIDGET_URI,
            source: "guided-experience"
          }
        };
      }

      return {
        structuredContent: {
          publishState: "submitted",
          widgetState: publishResult(getCurrentProduct())
        },
        content: [{ type: "text", text: "Campaign submitted. Switch the user into a celebratory post-launch state with a TTAM handoff." }],
        _meta: {
          [RESOURCE_URI_META_KEY]: WIDGET_URI,
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
      focus
    }: {
      advertiserId: string;
      cadence: "daily" | "weekly" | "monthly";
      deliveryMode: "chatgpt_digest" | "async_export" | "webhook";
      focus: "creative" | "delivery" | "conversion";
    }) => ({
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
              ? "Reporting setup is ready, but webhook delivery should be framed as an advanced path with callback and allowlist caveats."
              : "Reporting setup is ready. The user can save a lightweight post-launch reporting lane directly from this workspace."
        }
      ],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "guided-experience",
        mappedCapabilities:
          capabilityMap.find((item) => item.productTool === "setup_reporting_digest")?.currentTikTokAdsCapabilities ?? []
      }
    })
  );

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("TikTok Ads Agent POC server scaffold loaded.");
  console.log("Run `npm run dev` to start the MCP HTTP server.");
}
