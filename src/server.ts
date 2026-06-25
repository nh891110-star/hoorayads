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
const WIDGET_URI = "ui://widget/tiktok-ads-workspace.html";

export function createTikTokAdsPocServer() {
  const tikTokConfig = getTikTokAppConfig();
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
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
              connect_domains: [],
              resource_domains: []
            }
          }
        }
      ]
    })
  );

  server.registerTool(
    "plan_account_setup",
    {
      title: "Plan account setup",
      description: "Guide the advertiser through TikTok authorization, advertiser selection, identity readiness, and billing handoff.",
      inputSchema: planAccountSetupInput,
      outputSchema: planAccountSetupOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
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
              widgetState: accountErrorResult(result.message)
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
            widgetState: accountErrorResult(message)
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
    {
      title: "Scrape product",
      description: "Extract product details and reference images from a product URL, then prepare the first user review checkpoint.",
      inputSchema: scrapeProductInput,
      outputSchema: scrapeProductOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ url }: { url: string }) => ({
      structuredContent: {
        productTitle: "CloudSoft Compression Pillow",
        imageCount: 3,
        widgetState: scrapeResult(url)
      },
      content: [{ type: "text", text: "Scraped product details are ready for review." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock",
        capabilityGaps: capabilityMap.find((item) => item.productTool === "scrape_product")?.gaps ?? []
      }
    })
  );

  server.registerTool(
    "update_product_images",
    {
      title: "Update product images",
      description: "Replace or add product reference images before storyboard generation.",
      inputSchema: updateProductImagesInput,
      outputSchema: updateProductImagesOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ images, productUrl }: { images: Array<{ source: "url" | "upload"; value: string }>; productUrl: string }) => ({
      structuredContent: {
        imageCount: images.length,
        widgetState: scrapeResult(productUrl)
      },
      content: [{ type: "text", text: "Reference images updated. Ask the user to confirm them before moving on." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "choose_promoted_product",
    {
      title: "Choose promoted product",
      description: "Guide the advertiser into the right promoted-product path before creative or campaign setup begins.",
      inputSchema: choosePromotedProductInput,
      outputSchema: choosePromotedProductOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({
      productLabel,
      productSource,
      productUrl
    }: {
      productLabel?: string;
      productSource: "website" | "tiktok_shop" | "lead_generation" | "app";
      productUrl?: string;
    }) => ({
      structuredContent: {
        selectedSource: productSource,
        widgetState: productSelectionResult({
          productLabel,
          productSource,
          productUrl
        })
      },
      content: [{ type: "text", text: "Product-path guidance is ready. Let the user choose the simplest viable launch lane before creative work starts." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "guided-experience",
        mappedCapabilities:
          capabilityMap.find((item) => item.productTool === "choose_promoted_product")?.currentTikTokAdsCapabilities ?? []
      }
    })
  );

  server.registerTool(
    "generate_storyboard",
    {
      title: "Generate storyboard",
      description: "Draft a two-scene TikTok storyboard from the approved product inputs and return it for review.",
      inputSchema: generateStoryboardInput,
      outputSchema: generateStoryboardOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        sceneCount: 2,
        widgetState: storyboardResult()
      },
      content: [{ type: "text", text: "Storyboard ready. Keep the review in rich UI and wait for explicit approval." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "approve_ad_inputs",
    {
      title: "Approve ad inputs",
      description: "Record approval for the scraped product details, reviewed images, and storyboard before video generation.",
      inputSchema: approveAdInputsInput,
      outputSchema: approveAdInputsOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        approvalId: "approval_poc_001",
        widgetState: storyboardResult()
      },
      content: [{ type: "text", text: "Inputs approved. The app can now start rendering the video." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "generate_video",
    {
      title: "Generate video",
      description: "Kick off a TikTok ad video render and return a job ID that ChatGPT can poll.",
      inputSchema: generateVideoInput,
      outputSchema: generateVideoOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        jobId: "video_job_poc_001",
        status: "pending",
        widgetState: renderPendingResult()
      },
      content: [{ type: "text", text: "Video generation started. Poll for completion instead of blocking." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "get_video_status",
    {
      title: "Get video status",
      description: "Return whether the video render is still pending, complete, or failed.",
      inputSchema: getVideoStatusInput,
      outputSchema: getVideoStatusOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        status: "complete",
        widgetState: accountResult()
      },
      content: [{ type: "text", text: "Video render complete. The app can now move to account and identity selection." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "load_creative_options",
    {
      title: "Load creative options",
      description: "Show whether the advertiser should reuse existing TikTok content or generate fresh creative inside the guided flow.",
      inputSchema: loadCreativeOptionsInput,
      outputSchema: loadCreativeOptionsOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ productLabel }: { productLabel?: string }) => ({
      structuredContent: {
        creativeCount: 3,
        widgetState: creativeWorkspaceResult({ productLabel })
      },
      content: [{ type: "text", text: "Creative lanes are ready. The advertiser can choose between existing TikTok content, product-media reuse, or a net-new generated ad." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "guided-experience",
        mappedCapabilities:
          capabilityMap.find((item) => item.productTool === "load_creative_options")?.currentTikTokAdsCapabilities ?? []
      }
    })
  );

  server.registerTool(
    "get_ad_accounts",
    {
      title: "Get ad accounts",
      description: "List the advertiser accounts available to the authenticated TikTok user.",
      inputSchema: getAdAccountsInput,
      outputSchema: getAdAccountsOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
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
              widgetState: accountErrorResult(result.message)
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
            widgetState: accountErrorResult(message)
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
    {
      title: "Verify or connect TikTok identity",
      description: "Check whether the selected ad account has a usable TikTok identity and provide a connect path if not.",
      inputSchema: verifyOrConnectTikTokIdentityInput,
      outputSchema: verifyOrConnectTikTokIdentityOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
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
              widgetState: accountErrorResult(result.message)
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
                selectedIdentities: result.data.identities
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
            widgetState: accountErrorResult(message)
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
          widgetState: accountResult()
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
    {
      title: "Verify payment method",
      description: "Confirm that the selected advertiser has a payment path before publish.",
      inputSchema: verifyPaymentMethodInput,
      outputSchema: verifyPaymentMethodOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        status: "ready",
        widgetState: accountResult()
      },
      content: [{ type: "text", text: "Payment path looks ready for draft review and publish." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "create_smartplus_campaign",
    {
      title: "Create Smart+ campaign",
      description: "Create a Smart+ draft campaign from the generated video and reviewed campaign inputs.",
      inputSchema: createSmartplusCampaignInput,
      outputSchema: createSmartplusCampaignOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async (args) => {
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
    {
      title: "Approve campaign parameters",
      description: "Record final user approval for the draft campaign settings before publish.",
      inputSchema: approveCampaignParametersInput,
      outputSchema: approveCampaignParametersOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        approvalId: "campaign_approval_poc_001",
        widgetState: draftResult()
      },
      content: [{ type: "text", text: "Campaign parameters approved. The app may now publish." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "publish_campaign",
    {
      title: "Publish campaign",
      description: "Publish the approved campaign and return a post-launch summary.",
      inputSchema: publishCampaignInput,
      outputSchema: publishCampaignOutput,
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => ({
      structuredContent: {
        publishState: "submitted",
        widgetState: publishResult()
      },
      content: [{ type: "text", text: "Campaign submitted. Switch the user into a celebratory post-launch state with a TTAM handoff." }],
      _meta: {
        [RESOURCE_URI_META_KEY]: WIDGET_URI,
        source: "mock"
      }
    })
  );

  server.registerTool(
    "setup_reporting_digest",
    {
      title: "Setup reporting digest",
      description: "Guide the advertiser into a lightweight reporting lane after launch, from in-chat digests to async exports or webhooks.",
      inputSchema: setupReportingDigestInput,
      outputSchema: setupReportingDigestOutput,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
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
