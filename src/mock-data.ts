export type TimelineStep = {
  id: string;
  label: string;
  substeps?: Array<{
    label: string;
    status: "done" | "current" | "todo";
  }>;
  status: "done" | "current" | "todo" | "skipped";
  owner: "user" | "chatgpt" | "tiktok";
};

export type Blocker = {
  id: string;
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};

export type CreativeAngle = {
  id: string;
  title: string;
  hook: string;
  format: string;
  targetObjective: string;
};

export type CampaignField = {
  label: string;
  value: string;
  editable: boolean;
};

export type AdvertiserSummary = {
  advertiserId: string;
  advertiserName: string;
  advertiserRole: string;
  bcName: string;
  country: string;
  currency: string;
  identityCount: number;
  status: string;
  timezone: string;
};

export type IdentitySummary = {
  availableStatus: string;
  displayName: string;
  identityId: string;
  identityType: string;
  username: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  status: "done" | "current" | "todo" | "blocked";
};

export type HighlightStat = {
  label: string;
  value: string;
  tone?: "default" | "good" | "accent" | "warn";
};

export type OptionCard = {
  id: string;
  title: string;
  kicker: string;
  description: string;
  status: "recommended" | "ready" | "connected" | "draft" | "blocked";
  meta: string[];
};

export type OptionGroup = {
  title: string;
  description?: string;
  options: OptionCard[];
};

export type CapabilityNote = {
  id: string;
  title: string;
  detail: string;
  status: "live" | "mixed" | "gap";
};

export type CreativeAssetCard = {
  id: string;
  title: string;
  source: string;
  description: string;
  status: "recommended" | "available" | "needs_input";
  meta: string[];
};

export type ReportPlan = {
  cadence: string;
  delivery: string;
  nextRun: string;
  focus: string;
  metrics: string[];
  notes: string[];
};

export type VideoPreview = {
  canCreateCampaign: boolean;
  creativeAssetId: string;
  durationSeconds: number;
  height: number;
  jobId: string;
  previewUrl: string;
  status: "preview_ready" | "uploaded_to_tiktok";
  thumbnailUrl: string;
  tiktokVideoId?: string;
  videoId: string;
  width: number;
};

export type AccountSetupReadiness = {
  optional: boolean;
  ready: boolean;
  skipped: boolean;
  skipReason?: string;
  selectedAdvertiserId?: string;
  selectedIdentityId?: string;
  requirements: Array<{
    id: "tt4b" | "business_center" | "advertiser_account" | "tiktok_account";
    label: string;
    status: "ready" | "missing";
  }>;
};

export type StoreProductCandidate = {
  angle: string;
  confidence: "Strong match" | "Good potential";
  id: string;
  imageUrl?: string;
  productUrl: string;
  recommendation: "Top pick" | "Candidate";
  reasons: string[];
  selected?: boolean;
  title: string;
};

export type StoreDiscoveryState = {
  candidates?: StoreProductCandidate[];
  note: string;
  rankingBasis: string[];
  selectedCandidateId?: string;
  status: "loading" | "ready";
  storeUrl: string;
};

export type ToolViewModel = {
  screen: "onboarding" | "product" | "creative" | "render" | "accounts" | "draft" | "publish" | "reporting";
  phaseLabel?: string;
  headline: string;
  summary: string;
  primaryCta: string;
  secondaryCta?: string;
  timeline: TimelineStep[];
  blockers?: Blocker[];
  checklist?: ChecklistItem[];
  highlights?: HighlightStat[];
  optionGroups?: OptionGroup[];
  capabilityNotes?: CapabilityNote[];
  creativeAssets?: CreativeAssetCard[];
  product?: {
    title: string;
    price: string;
    destination: string;
    platform: string;
    imageCount?: number;
    creativeBriefTitle?: string;
    creativeBriefHook?: string;
    creativeBriefFormat?: string;
    creativeBriefObjective?: string;
  };
  readiness?: {
    accountConnection: string;
    identity: string;
    payment: string;
    video: string;
    recommendedObjective: string;
  };
  accounts?: AdvertiserSummary[];
  identities?: IdentitySummary[];
  angles?: CreativeAngle[];
  draft?: {
    name: string;
    objective: string;
    fields: CampaignField[];
    warnings: string[];
  };
  publish?: {
    state: string;
    campaignId: string;
    nextCheckIn: string;
  };
  videoPreview?: VideoPreview;
  reportPlan?: ReportPlan;
  accountSetup?: AccountSetupReadiness;
  storeDiscovery?: StoreDiscoveryState;
  auth?: {
    status: "connected" | "needs_authorization";
    authorizationUrl?: string;
    redirectUri?: string;
  };
};

export type ProductContext = {
  creativeBriefFormat?: string;
  creativeBriefHook?: string;
  creativeBriefObjective?: string;
  creativeBriefSummary?: string;
  creativeBriefTitle?: string;
  destination: string;
  imageCount?: number;
  platform: string;
  price: string;
  title: string;
};

const defaultProduct: ProductContext = {
  title: "Promoted product",
  price: "Pending merchant price",
  destination: "Pending user input",
  platform: "Direct product URL"
};

function toProductContext(product?: Partial<ProductContext>): ProductContext {
  return {
    ...defaultProduct,
    ...product
  };
}

function makeTimeline(current: ToolViewModel["screen"]): TimelineStep[] {
  const map: Record<string, TimelineStep["status"]> =
    current === "onboarding"
      ? {
          product: "todo",
          creative: "todo",
          render: "todo",
          accounts: "current",
          publish: "todo"
        }
      : {
          product: current === "product" ? "current" : ["creative", "render", "accounts", "draft", "publish", "reporting"].includes(current) ? "done" : "todo",
          creative: current === "creative" ? "current" : ["render", "accounts", "draft", "publish", "reporting"].includes(current) ? "done" : "todo",
          render: current === "render" ? "current" : ["accounts", "draft", "publish", "reporting"].includes(current) ? "done" : "todo",
          accounts: current === "accounts" ? "current" : ["draft", "publish", "reporting"].includes(current) ? "done" : "todo",
          publish: ["draft", "publish"].includes(current) ? "current" : current === "reporting" ? "done" : "todo"
        };

  return [
    { id: "product", label: "Product", status: map.product, owner: "user" },
    { id: "creative", label: "Storyboard", status: map.creative, owner: "chatgpt" },
    { id: "render", label: "Preview", status: map.render, owner: "chatgpt" },
    { id: "accounts", label: "Account setup", status: map.accounts, owner: "tiktok" },
    { id: "publish", label: "Review", status: map.publish, owner: "user" }
  ];
}

function withProductSubsteps(
  timeline: TimelineStep[],
  currentSubstep: "pick" | "confirm"
): TimelineStep[] {
  return timeline.map((step) =>
    step.id === "product"
      ? {
          ...step,
          substeps: [
            { label: "Pick product", status: currentSubstep === "pick" ? "current" : "done" },
            { label: "Confirm product", status: currentSubstep === "confirm" ? "current" : "todo" }
          ]
        }
      : step
  );
}

const readyAccountSetupRequirements: AccountSetupReadiness["requirements"] = [
  { id: "tt4b", label: "TikTok for Business", status: "ready" },
  { id: "business_center", label: "Business Center", status: "ready" },
  { id: "advertiser_account", label: "Advertiser Account", status: "ready" },
  { id: "tiktok_account", label: "TikTok Account", status: "ready" }
];

export function withSkippedAccountSetup(
  state: ToolViewModel,
  options?: {
    selectedAdvertiserId?: string;
    selectedIdentityId?: string;
    skipReason?: string;
  }
): ToolViewModel {
  return {
    ...state,
    timeline: state.timeline.map((step) =>
      step.id === "accounts"
        ? {
            ...step,
            label: "Account setup",
            status: "skipped"
          }
        : step
    ),
    accountSetup: {
      optional: true,
      ready: true,
      skipped: true,
      skipReason:
        options?.skipReason ||
        "TikTok for Business, Business Center, Advertiser Account, and TikTok Account are already connected.",
      selectedAdvertiserId: options?.selectedAdvertiserId,
      selectedIdentityId: options?.selectedIdentityId,
      requirements: readyAccountSetupRequirements
    }
  };
}

function baseReadiness(overrides?: Partial<ToolViewModel["readiness"]>): ToolViewModel["readiness"] {
  return {
    accountConnection: "Needs TikTok Ads authorization",
    identity: "Will verify after account selection",
    payment: "Confirm in Ads Manager before publish",
    video: "Choose or generate after product selection",
    recommendedObjective: "Smart+ Web Conversions",
    ...overrides
  };
}

function defaultCapabilityNotes(): CapabilityNote[] {
  return [
    {
      id: "account-execution",
      title: "Account, identity, and Smart+ writes can run on TikTok MCP",
      detail: "The current bridge can already authorize, discover advertiser accounts, verify identities, and write Smart+ campaign objects.",
      status: "live"
    },
    {
      id: "creative-gap",
      title: "Scraping and net-new creative generation still need an external media layer",
      detail: "Product scraping, storyboard generation, video rendering, and asset hosting are outside the observed TikTok Ads MCP surface.",
      status: "mixed"
    },
    {
      id: "billing-gap",
      title: "Payment readiness is checked before publish",
      detail: "If billing needs attention, the app should guide the advertiser before anything goes live.",
      status: "gap"
    }
  ];
}

export const previewState: ToolViewModel = {
  screen: "product",
  phaseLabel: "Product",
  headline: "What do you want to promote?",
  summary: "",
  primaryCta: "Confirm",
  timeline: makeTimeline("product")
};

export function onboardingWorkspaceResult(options?: {
  accounts?: AdvertiserSummary[];
  connected?: boolean;
  userDisplayName?: string;
}): ToolViewModel {
  const hasAccounts = (options?.accounts?.length ?? 0) > 0;

  return {
    screen: "onboarding",
    phaseLabel: "Account setup",
    headline: hasAccounts ? "Choose the advertiser account." : "Account setup.",
    summary: hasAccounts
      ? `${options?.userDisplayName || "This TikTok Ads user"} is connected. Choose the advertiser account that should own this launch.`
      : "Connect TikTok Ads so Hooray can find the right Business Center, advertiser account, and TikTok Account.",
    primaryCta: hasAccounts ? "Continue with selected advertiser" : "Authorize TikTok Ads",
    secondaryCta: hasAccounts ? "Review account details" : "Why this is needed",
    timeline: makeTimeline("onboarding"),
    checklist: [
      { id: "auth", label: "Authorize TikTok Ads", detail: "Use the MCP OAuth bridge so account discovery and reporting can stay inside the same app session.", status: hasAccounts ? "done" : "current" },
      { id: "account", label: "Select an advertiser", detail: "Show one clear account card at a time, with business center, currency, and account status.", status: hasAccounts ? "current" : "todo" },
      { id: "identity", label: "Confirm delivery identity", detail: "Before draft creation, verify at least one usable TikTok identity under the chosen advertiser.", status: "todo" },
      { id: "tiktok_account", label: "Confirm TikTok Account", detail: "Choose the TikTok profile that will appear as the ad identity.", status: "todo" }
    ],
    highlights: [
      { label: "Connected advertiser accounts", value: String(options?.accounts?.length ?? 0), tone: hasAccounts ? "good" : "warn" },
      { label: "Identity path", value: "Check immediately after account selection" },
      { label: "TikTok Account", value: "Check after advertiser selection" }
    ],
    optionGroups: [
      {
        title: "What this step should optimize for",
        options: [
          {
            id: "clarity",
            title: "Reduce setup anxiety",
            kicker: "Content design",
            description: "Use plain-language labels like 'Which ad account should own this launch?' instead of TikTok API terminology.",
            status: "recommended",
            meta: ["Best for SMBs", "One decision per card"]
          },
          {
            id: "trust",
            title: "Surface ownership early",
            kicker: "Advertiser need",
            description: "The user should see account name, currency, timezone, and identity count before any campaign write happens.",
            status: "ready",
            meta: ["Prevents wrong-account drafts", "Builds trust before publish"]
          }
        ]
      }
    ],
    readiness: baseReadiness({
      accountConnection: hasAccounts ? `${options?.accounts?.length ?? 0} advertiser account(s) available` : "Not authorized yet"
    }),
    accounts: options?.accounts,
    capabilityNotes: defaultCapabilityNotes()
  };
}

export function productSelectionResult(options?: {
  productLabel?: string;
  productSource?: "website" | "tiktok_shop" | "lead_generation" | "app";
  productUrl?: string;
}): ToolViewModel {
  const source = options?.productSource || "website";
  const productTitle = options?.productLabel || "Promoted product";
  const product = {
    title: productTitle,
    price: source === "lead_generation" ? "N/A" : "Pending merchant price",
    destination: options?.productUrl || "Pending user input",
    platform:
      source === "website"
        ? "Direct product URL"
        : source === "tiktok_shop"
          ? "TikTok Shop / GMV Max"
          : source === "lead_generation"
            ? "Lead collection flow"
            : "App install flow"
  };

  return {
    screen: "product",
    phaseLabel: "Product path",
    headline: "What do you want to promote?",
    summary:
      "Start with a product page if you know what to promote, or use a store link if you want Hooray to recommend products first.",
    primaryCta: "Use website path",
    secondaryCta: "See other launch paths",
    timeline: makeTimeline("product"),
    checklist: [
      { id: "goal", label: "Lock the launch path", detail: "Set the product or destination type first so the app knows whether to ask for a URL, catalog, form, or app asset.", status: "current" },
      { id: "url", label: "Capture a concrete destination", detail: "For website campaigns, confirm a valid landing page that creative can reference.", status: source === "website" ? "current" : "todo" },
      { id: "asset-shape", label: "Translate into campaign shape", detail: "Map the choice into Smart+, GMV Max, lead gen, or app promotion requirements.", status: "todo" }
    ],
    optionGroups: [
      {
        title: "Promoted-product paths",
        description: "Choose the simplest path that matches what you want to promote.",
        options: [
          {
            id: "website",
            title: "Website conversions",
            kicker: "Recommended first path",
            description: "Best default for a non-Shopify advertiser with a product page and no TikTok Shop dependency.",
            status: source === "website" ? "recommended" : "ready",
            meta: ["Needs landing page URL", "Maps cleanly into Smart+ website flow"]
          },
          {
            id: "shop",
            title: "TikTok Shop / GMV Max",
            kicker: "Advanced",
            description: "Great when the seller already has TikTok Shop eligibility, GMV Max access, and product-level creative assets.",
            status: source === "tiktok_shop" ? "connected" : "draft",
            meta: ["Eligibility varies", "Needs shop + campaign prerequisites"]
          },
          {
            id: "lead",
            title: "Lead generation",
            kicker: "Use when there is no direct product URL",
            description: "Useful for services, consultations, waitlists, or businesses that need contact capture first.",
            status: source === "lead_generation" ? "connected" : "ready",
            meta: ["Form-first experience", "Different publish checklist"]
          },
          {
            id: "app",
            title: "App promotion",
            kicker: "Separate setup track",
            description: "Only show this if the advertiser explicitly asks for app installs and has the required app setup ready.",
            status: source === "app" ? "connected" : "blocked",
            meta: ["Separate product path", "Do not recommend by default"]
          }
        ]
      }
    ],
    highlights: [
      { label: "Selected source", value: source.replace("_", " "), tone: "accent" },
      { label: "Recommended objective", value: source === "website" ? "Smart+ Web Conversions" : source === "lead_generation" ? "Lead Generation" : "Needs path-specific setup" },
      { label: "Destination", value: options?.productUrl || "Pending user input" }
    ],
    capabilityNotes: [
      {
        id: "website-gap",
        title: "Website product scraping is still outside TikTok Ads MCP",
        detail: "The guided app should still own this step because it can normalize arbitrary merchant URLs into a clean creative brief.",
        status: "mixed"
      },
      {
        id: "gmv-max",
        title: "TikTok Shop and GMV Max exist, but should be shown as an eligibility-based lane",
        detail: "This path is powerful, but it should appear only when shop, store, and campaign prerequisites are actually met.",
        status: "mixed"
      }
    ],
    product,
    readiness: baseReadiness({
      accountConnection: "Authorize first or reuse connected advertiser",
      video: "Choose or generate after product path is locked"
    }),
    blockers:
      source === "app"
        ? [
            {
              id: "app-setup",
              title: "App promotion should stay hidden by default",
              detail: "This MVP is optimized for product-page advertising. App install campaigns need a separate setup path.",
              severity: "medium"
            }
          ]
        : []
  };
}

export function storeProductScanLoadingResult(storeUrl: string): ToolViewModel {
  return {
    screen: "product",
    phaseLabel: "Product",
    headline: "Finding products ready for TikTok ads.",
    summary:
      "Scanning your store page for products with strong visuals, clear offers, usable landing pages, and short-video storytelling potential.",
    primaryCta: "Scanning store",
    timeline: withProductSubsteps(makeTimeline("product"), "pick"),
    checklist: [
      { id: "store-url", label: "Store URL received", detail: storeUrl, status: "done" },
      {
        id: "scan-products",
        label: "Find product candidates",
        detail: "Review visible store signals, product-page quality, and creative fit.",
        status: "current"
      },
      {
        id: "confirm-product",
        label: "Confirm one product",
        detail: "After you pick a candidate, we will confirm the product page and images before storyboarding.",
        status: "todo"
      }
    ],
    highlights: [
      { label: "Store", value: new URL(storeUrl).hostname.replace(/^www\./, ""), tone: "accent" },
      { label: "Ranking", value: "Ad-readiness signals" },
      { label: "Next", value: "Pick one product", tone: "good" }
    ],
    readiness: baseReadiness({
      accountConnection: "Not needed yet",
      video: "Starts after product confirmation"
    }),
    storeDiscovery: {
      status: "loading",
      storeUrl,
      rankingBasis: ["Visual fit", "Clear offer", "Landing page quality", "Short-video potential"],
      note: "This scan uses visible store-page signals. It is not a sales forecast."
    }
  };
}

export function storeProductCandidatesResult(storeUrl: string, candidates: StoreProductCandidate[]): ToolViewModel {
  const selectedCandidate = candidates.find((candidate) => candidate.selected) || candidates[0];

  return {
    screen: "product",
    phaseLabel: "Product",
    headline: "Pick a product to promote.",
    summary: `I found ${candidates.length} products from your store that look ready to promote on TikTok. Choose one.`,
    primaryCta: "Use selected product",
    secondaryCta: "Show more candidates",
    timeline: withProductSubsteps(makeTimeline("product"), "pick"),
    checklist: [
      { id: "store-url", label: "Store URL scanned", detail: storeUrl, status: "done" },
      {
        id: "pick-product",
        label: "Pick one product",
        detail: "Choose the product that should move into product confirmation and storyboard generation.",
        status: "current"
      },
      {
        id: "confirm-product",
        label: "Confirm product page and images",
        detail: "The next screen checks the selected product details before any video is created.",
        status: "todo"
      }
    ],
    highlights: [
      { label: "Top pick", value: selectedCandidate?.title || "Needs selection", tone: "accent" },
      { label: "Candidates", value: String(candidates.length), tone: "good" },
      { label: "Recommendation", value: selectedCandidate?.confidence || "Good potential" }
    ],
    product: selectedCandidate
      ? {
          title: selectedCandidate.title,
          price: "Needs confirmation",
          destination: selectedCandidate.productUrl,
          platform: "Store URL discovery"
        }
      : undefined,
    readiness: baseReadiness({
      accountConnection: "Not needed yet",
      video: "Starts after product confirmation"
    }),
    storeDiscovery: {
      status: "ready",
      storeUrl,
      candidates,
      selectedCandidateId: selectedCandidate?.id,
      rankingBasis: ["Visual fit", "Clear offer", "Landing page quality", "Short-video potential"],
      note: "These are recommendations from visible store-page signals, not sales predictions."
    }
  };
}

export function scrapeResult(url: string, product?: Partial<ProductContext>): ToolViewModel {
  const currentProduct = toProductContext({
    destination: url,
    ...product
  });

  return {
    screen: "product",
    phaseLabel: "Product",
    headline: "Confirm this product.",
    summary:
      "We found this from your URL. Check the name, page, and images before we make the ad.",
    primaryCta: "Confirm product",
    secondaryCta: "Edit details",
    timeline: makeTimeline("product"),
    checklist: [
      { id: "url", label: "Landing page captured", detail: "Keep the exact destination visible so the advertiser knows what creative is being based on.", status: "done" },
      { id: "copy", label: "Product facts reviewed", detail: "Title, price, and offer should be clean enough to feed creative generation.", status: "current" },
      { id: "images", label: "Reference images approved", detail: "Replace poor product photography before storyboarding starts.", status: "todo" }
    ],
    highlights: [
      { label: "Source", value: "Website scrape", tone: "accent" },
      { label: "Image review", value: "Needs advertiser approval" },
      { label: "Next step", value: "Storyboard generation", tone: "good" }
    ],
    optionGroups: [
      {
        title: "What the UI should help the advertiser decide",
        options: [
          {
            id: "product-keep",
            title: "Use detected details",
            kicker: "Fast path",
            description: "Best when the product page is already clean and the imagery is usable for UGC or product-demo creative.",
            status: "recommended",
            meta: ["1 click to continue", "Lowest friction path"]
          },
          {
            id: "product-fix",
            title: "Correct images or offer text",
            kicker: "Safety path",
            description: "Give the advertiser a clean way to override weak source content without restarting the flow.",
            status: "ready",
            meta: ["Protects creative quality", "Avoids bad first render"]
          }
        ]
      }
    ],
    product: {
      title: currentProduct.title,
      price: currentProduct.price || "Pending extraction",
      destination: currentProduct.destination,
      platform: currentProduct.platform || "Direct product URL",
      imageCount: currentProduct.imageCount
    },
    readiness: baseReadiness({
      video: "Storyboard starts after image review"
    }),
    capabilityNotes: defaultCapabilityNotes()
  };
}

export function creativeWorkspaceResult(options?: {
  productLabel?: string;
  product?: Partial<ProductContext>;
}): ToolViewModel {
  const product = toProductContext({
    ...options?.product,
    title: options?.productLabel || options?.product?.title
  });
  const creativeBriefTitle = product.creativeBriefTitle || "Pain-to-comfort UGC";
  const creativeBriefHook =
    product.creativeBriefHook ||
    "Start with the problem, then pivot hard into the product payoff with one spoken line and one tactile reveal.";
  const creativeBriefFormat = product.creativeBriefFormat || "2-scene UGC";
  const creativeBriefObjective = product.creativeBriefObjective || "Web Conversions";
  const creativeBriefSummary =
    product.creativeBriefSummary ||
    `Hook the viewer with the problem first, then reveal ${product.title} as the relief moment.`;

  return {
    screen: "creative",
    phaseLabel: "Creative source",
    headline: "Pick a storyboard.",
    summary:
      "I drafted two story directions from the product page. Choose one, then preview the video.",
    primaryCta: "Use selected storyboard",
    secondaryCta: "Regenerate options",
    timeline: makeTimeline("creative"),
    checklist: [
      { id: "lane", label: "Pick a creative lane", detail: "Start with a simple choice between existing content and net-new generation.", status: "current" },
      { id: "review", label: "Review the concept", detail: "Before rendering or selecting a post, show the advertiser the angle, hook, and CTA in plain language.", status: "todo" },
      { id: "asset", label: "Lock the launch asset", detail: "Only after approval should the campaign use a video ID or rendered output.", status: "todo" }
    ],
    optionGroups: [
      {
        title: "Creative lanes",
        description: "Each lane should feel like a deliberate product choice, not an API fallback.",
        options: [
          {
            id: "generate",
            title: "Generate a fresh ad",
            kicker: "Recommended for first launch",
            description: "Use the product page, approved images, and a clear business goal to create a storyboard and then a rendered preview.",
            status: "recommended",
            meta: ["Best for new advertisers", "Keeps the app differentiated"]
          },
          {
            id: "reuse",
            title: "Reuse an existing TikTok post",
            kicker: "MCP-backed asset path",
            description: "Once identity access is ready, the app can guide the user to pick a usable post instead of generating from scratch.",
            status: "ready",
            meta: ["Maps to identity_video_get", "Needs a usable identity first"]
          },
          {
            id: "hybrid",
            title: "Start from existing product media",
            kicker: "Fast creative iteration",
            description: "Best when the advertiser has decent product imagery but still wants the app to script and package the ad.",
            status: "ready",
            meta: ["Good for DTC products", "Keeps visual review inside ChatGPT"]
          }
        ]
      }
    ],
    creativeAssets: [
      {
        id: "asset-1",
        title: creativeBriefTitle,
        source: "Generated storyboard",
        description: creativeBriefSummary,
        status: "recommended",
        meta: ["User-guided direction", creativeBriefFormat, "Direct CTA"]
      },
      {
        id: "asset-2",
        title: "Existing TikTok post reuse",
        source: "Identity video library",
        description: "Use this lane when the brand already has a post with strong watch time or social proof.",
        status: "available",
        meta: ["Requires identity selection", "Maps to MCP asset discovery"]
      },
      {
        id: "asset-3",
        title: "Thumbnail + CTA polish",
        source: "Creative enhancement",
        description: "After a video ID exists, the app can guide thumbnail and CTA cleanup so the creative feels launch-ready.",
        status: "needs_input",
        meta: ["Needs real video ID", "Maps partly to file_video_suggestcover_get"]
      }
    ],
    angles: [
      {
        id: "hook-01",
        title: creativeBriefTitle,
        hook: creativeBriefHook,
        format: creativeBriefFormat,
        targetObjective: creativeBriefObjective
      },
      {
        id: "hook-02",
        title: "Proof-first social clip",
        hook: "Open on a believable proof point or social cue, then move quickly into the product benefit and click reason.",
        format: "Identity-post reuse",
        targetObjective: "Landing page views"
      }
    ],
    highlights: [
      { label: "Creative direction", value: creativeBriefTitle, tone: "accent" },
      { label: "Reuse lane", value: "Existing TikTok post if identity is connected" },
      { label: "Approval rule", value: "Never render or publish before explicit review", tone: "good" }
    ],
    readiness: baseReadiness({
      video: "Creative lane selected, final asset still pending"
    }),
    capabilityNotes: [
      {
        id: "creative-live",
        title: "Existing post reuse is the strongest MCP-native creative path today",
        detail: "Identity-based post discovery is a natural bridge between TikTok-native content and campaign creation.",
        status: "live"
      },
      {
        id: "creative-gap",
        title: "Generated storyboard and render remain the signature ChatGPT layer",
        detail: "This is where the app adds the most product value beyond Ads Manager.",
        status: "mixed"
      }
    ],
    product
  };
}

export function storyboardResult(product?: Partial<ProductContext>): ToolViewModel {
  return {
    ...creativeWorkspaceResult({ product }),
    phaseLabel: "Storyboard",
    headline: "Pick a storyboard.",
    summary:
      "I drafted two story directions from the product page. Choose one, then preview the video.",
    primaryCta: "Use selected storyboard",
    secondaryCta: "Regenerate options"
  };
}

export function renderPendingResult(product?: Partial<ProductContext>): ToolViewModel {
  return {
    ...creativeWorkspaceResult({ product }),
    screen: "render",
    phaseLabel: "Preview",
    headline: "Generating your video preview.",
    summary:
      "I’m turning the selected storyboard into a short draft. Nothing is connected to TikTok Ads yet.",
    primaryCta: "Check render status",
    secondaryCta: "Edit storyboard",
    timeline: makeTimeline("render"),
    checklist: [
      { id: "lane", label: "Creative lane selected", detail: "The advertiser already approved the concept, so rendering can happen asynchronously.", status: "done" },
      { id: "render", label: "Generate preview asset", detail: "Poll for completion and keep the user in the same workspace.", status: "current" },
      { id: "review", label: "Move into campaign setup", detail: "Only once the preview exists should the app ask for final campaign inputs.", status: "todo" }
    ],
    readiness: baseReadiness({
      video: "Preview rendering in progress"
    })
  };
}

export function renderCompleteResult(product: Partial<ProductContext> | undefined, videoPreview: VideoPreview): ToolViewModel {
  const currentProduct = toProductContext(product);

  return {
    ...creativeWorkspaceResult({ product: currentProduct }),
    screen: "render",
    phaseLabel: "Preview",
    headline: "Preview the video.",
    summary:
      "Review the selected storyboard as a short draft. Nothing is connected to TikTok Ads yet.",
    primaryCta: "Approve preview",
    secondaryCta: "Edit storyboard",
    timeline: makeTimeline("render"),
    checklist: [
      { id: "concept", label: "Storyboard approved", detail: "The hook, product framing, and CTA were approved before rendering.", status: "done" },
      { id: "preview", label: "Preview video ready", detail: "Watch the generated preview and confirm it is launch-worthy.", status: "current" },
      { id: "campaign", label: "Continue to campaign setup", detail: "After preview approval, attach the asset context to the Smart+ draft flow.", status: "todo" }
    ],
    highlights: [
      { label: "Preview", value: `${videoPreview.durationSeconds}s vertical`, tone: "good" },
      { label: "Asset", value: videoPreview.videoId, tone: "accent" },
      { label: "TikTok upload", value: videoPreview.tiktokVideoId ? "Ready" : "Needed before publish", tone: videoPreview.tiktokVideoId ? "good" : "warn" }
    ],
    readiness: baseReadiness({
      video: "Preview ready for review"
    }),
    blockers: videoPreview.tiktokVideoId
      ? []
      : [
          {
            id: "tiktok-upload",
            title: "Preview is not a TikTok-hosted video yet",
            detail:
              "The app can show the rendered preview now. Before final ad creative creation or publish, the renderer still needs to upload the MP4 to TikTok and return a real TikTok video_id.",
            severity: "medium"
          }
        ],
    product: {
      title: currentProduct.title,
      price: currentProduct.price,
      destination: currentProduct.destination,
      platform: currentProduct.platform,
      imageCount: currentProduct.imageCount,
      creativeBriefTitle: currentProduct.creativeBriefTitle,
      creativeBriefHook: currentProduct.creativeBriefHook,
      creativeBriefFormat: currentProduct.creativeBriefFormat,
      creativeBriefObjective: currentProduct.creativeBriefObjective
    },
    videoPreview
  };
}

export function reviewReadyResult(options?: {
  product?: Partial<ProductContext>;
  selectedAdvertiserId?: string;
  selectedIdentityId?: string;
}): ToolViewModel {
  const product = toProductContext(options?.product);

  return withSkippedAccountSetup(
    {
      screen: "draft",
      phaseLabel: "Review",
      headline: "Review before launch.",
      summary:
        "Account setup is already complete, so you can review the launch details before any spend starts.",
      primaryCta: "Create Smart+ draft",
      secondaryCta: "Edit campaign details",
      timeline: makeTimeline("publish"),
      checklist: [
        { id: "creative", label: "Video preview approved", detail: "The launch can continue from the selected creative preview.", status: "done" },
        {
          id: "account",
          label: "Account setup skipped",
          detail: "TT4B, Business Center, Advertiser Account, and TikTok Account are already connected.",
          status: "done"
        },
        {
          id: "review",
          label: "Review launch settings",
          detail: "Confirm budget, destination, identity, and campaign defaults before creating the Smart+ draft.",
          status: "current"
        }
      ],
      highlights: [
        { label: "Account setup", value: "Skipped", tone: "good" },
        { label: "Advertiser", value: options?.selectedAdvertiserId || "Ready", tone: "accent" },
        { label: "Next step", value: "Review campaign details" }
      ],
      readiness: baseReadiness({
        accountConnection: "Ready",
        identity: "TikTok Account connected",
        payment: "Check before enabling delivery",
        video: "Preview ready",
        recommendedObjective: "Smart+ Web Conversions"
      }),
      product
    },
    {
      selectedAdvertiserId: options?.selectedAdvertiserId,
      selectedIdentityId: options?.selectedIdentityId
    }
  );
}

export function accountResult(product?: Partial<ProductContext>): ToolViewModel {
  const currentProduct = toProductContext(product);

  return {
    screen: "accounts",
    phaseLabel: "Account setup",
    headline: "Account setup.",
    summary:
      "Confirm the TikTok business accounts Hooray will use for this ad.",
    primaryCta: "Continue",
    secondaryCta: "Change account",
    timeline: makeTimeline("accounts"),
    checklist: [
      { id: "account", label: "Advertiser selected", detail: "The user knows which account will own the draft.", status: "done" },
      { id: "identity", label: "Identity confirmed", detail: "A usable TikTok identity is available for delivery.", status: "done" },
      { id: "tt4b", label: "TikTok for Business ready", detail: "The user has authorized the business login for this launch.", status: "done" },
      { id: "business_center", label: "Business Center ready", detail: "Assets and permissions are available for the selected advertiser.", status: "done" }
    ],
    readiness: baseReadiness({
      accountConnection: "1 advertiser selected",
      identity: "Connected",
      payment: "Needs final billing confirmation",
      video: "Renderable preview ready"
    }),
    blockers: [
      {
        id: "final-review",
        title: "Final review still comes before publish",
        detail: "Budget, destination, and account choice should be reviewed before anything goes live.",
        severity: "medium"
      }
    ],
    optionGroups: [
      {
        title: "How the app should present setup",
        options: [
          {
            id: "smart-plus",
            title: "Smart+ website draft",
            kicker: "Recommended default",
            description: "Make Smart+ the default write path for website advertisers because it minimizes choices and still feels high-confidence.",
            status: "recommended",
            meta: ["Fastest route to first launch", "Works with guided product + creative flow"]
          },
          {
            id: "manual-advanced",
            title: "Advanced settings lane",
            kicker: "Only for experienced advertisers",
            description: "Show bids, audience IDs, and extra controls only when the advertiser explicitly asks for them.",
            status: "draft",
            meta: ["Do not force by default", "Protect novice advertisers from overload"]
          }
        ]
      }
    ],
    capabilityNotes: defaultCapabilityNotes(),
    product: currentProduct
  };
}

export function accountAuthorizationResult(authorizationUrl: string, redirectUri: string): ToolViewModel {
  return {
    ...onboardingWorkspaceResult(),
    headline: "Account setup.",
    summary:
      "Connect TikTok Ads so Hooray can find the right Business Center, advertiser account, and TikTok Account.",
    primaryCta: "Authorize TikTok Ads",
    secondaryCta: "Why this is needed",
    auth: {
      status: "needs_authorization",
      authorizationUrl,
      redirectUri
    },
    blockers: [
      {
        id: "oauth",
        title: "TikTok Ads authorization required",
        detail: "Complete the authorization flow once, then return to the same Hooray TikTok Ads session and continue.",
        severity: "high"
      }
    ],
    readiness: baseReadiness({
      accountConnection: "Not authorized yet"
    })
  };
}

export function identityConnectResult(authorizationUrl: string, redirectUri: string): ToolViewModel {
  return {
    screen: "onboarding",
    phaseLabel: "Identity setup",
    headline: "Connect a usable TikTok identity before the app creates a draft",
    summary:
      "The selected advertiser exists, but there is no usable delivery identity yet. The right experience is to keep the user in a guided identity setup lane instead of surprising them later at ad creation time.",
    primaryCta: "Connect TikTok identity",
    secondaryCta: "Use another advertiser",
    timeline: makeTimeline("onboarding"),
    checklist: [
      { id: "account", label: "Advertiser selected", detail: "The draft owner is known.", status: "done" },
      { id: "identity", label: "Authorize or connect identity", detail: "Open the TikTok identity connection flow, then return here to continue.", status: "current" },
      { id: "creative", label: "Resume creative and draft flow", detail: "Once identity is ready, the app can reuse existing posts or create a Smart+ draft.", status: "todo" }
    ],
    readiness: baseReadiness({
      accountConnection: "1 advertiser selected",
      identity: "Needs authorization"
    }),
    blockers: [
      {
        id: "identity",
        title: "Identity connection required",
        detail: "This advertiser cannot deliver until a TikTok identity is available.",
        severity: "high"
      }
    ],
    auth: {
      status: "needs_authorization",
      authorizationUrl,
      redirectUri
    },
    capabilityNotes: defaultCapabilityNotes()
  };
}

export function liveAccountResult(options: {
  accounts: AdvertiserSummary[];
  selectedAdvertiserId?: string;
  selectedIdentities?: IdentitySummary[];
  product?: Partial<ProductContext>;
  userDisplayName?: string;
}): ToolViewModel {
  const selectedAccount =
    options.accounts.find((account) => account.advertiserId === options.selectedAdvertiserId) || options.accounts[0];
  const selectedIdentityCount = options.selectedIdentities?.length ?? selectedAccount?.identityCount ?? 0;
  const product = toProductContext(options.product);

  return {
    screen: "onboarding",
    phaseLabel: "Account setup",
    headline:
      options.accounts.length > 1
        ? "Choose the advertiser account."
        : "Account setup.",
    summary:
      options.accounts.length > 1
        ? `${options.userDisplayName || "This TikTok Ads user"} can access ${options.accounts.length} advertiser accounts. Choose the one that should own this launch.`
        : "The TikTok Ads connection is ready. Confirm the account and TikTok Account before review.",
    primaryCta: selectedIdentityCount > 0 ? "Continue with this advertiser" : "Verify identity",
    secondaryCta: options.accounts.length > 1 ? "Switch advertiser" : "Review details",
    timeline: makeTimeline("onboarding"),
    checklist: [
      { id: "auth", label: "Authorize TikTok Ads", detail: "The app can now read real advertiser data.", status: "done" },
      { id: "account", label: "Choose advertiser owner", detail: "Make the selected account visible and explicit before the app writes anything.", status: "current" },
      { id: "business_center", label: "Confirm Business Center", detail: "Show the Business Center connected to this advertiser account.", status: "done" },
      { id: "identity", label: "Confirm TikTok Account", detail: "If no TikTok Account exists, route into identity setup before draft creation.", status: selectedIdentityCount > 0 ? "done" : "todo" }
    ],
    highlights: [
      { label: "Advertiser accounts", value: String(options.accounts.length), tone: "accent" },
      { label: "Selected identities", value: String(selectedIdentityCount), tone: selectedIdentityCount > 0 ? "good" : "warn" },
      { label: "Recommended next step", value: selectedIdentityCount > 0 ? "Choose product path" : "Verify identity" }
    ],
    accounts: options.accounts,
    identities: options.selectedIdentities,
    readiness: baseReadiness({
      accountConnection: `${options.accounts.length} advertiser account(s) available`,
      identity: selectedIdentityCount > 0 ? `${selectedIdentityCount} usable identit${selectedIdentityCount === 1 ? "y" : "ies"} found` : "Needs verification"
    }),
    optionGroups: [
      {
        title: "Why this step matters",
        options: [
          {
            id: "ownership",
            title: "Prevent wrong-account drafts",
            kicker: "Advertiser need",
            description: "A guided account selection step is more trustworthy than hidden account context.",
            status: "recommended",
            meta: ["Reduces support load", "Avoids destructive mistakes"]
          },
          {
            id: "identity-reuse",
            title: "Unlock existing TikTok post reuse",
            kicker: "Creative payoff",
            description: "Once identity is known, the app can recommend existing TikTok posts as creative candidates.",
            status: "ready",
            meta: ["Connects setup to creative flow", "Feels distinctly TikTok-native"]
          }
        ]
      }
    ],
    product,
    capabilityNotes: defaultCapabilityNotes()
  };
}

export function accountErrorResult(detail: string, product?: Partial<ProductContext>): ToolViewModel {
  return {
    screen: "onboarding",
    phaseLabel: "Setup issue",
    headline: "TikTok account setup needs attention before the launch can continue",
    summary:
      "We could not load the TikTok account details yet. Your product and creative progress is saved, so you can retry without restarting.",
    primaryCta: "Try again",
    secondaryCta: "Check TikTok access",
    timeline: makeTimeline("onboarding"),
    checklist: [
      { id: "auth", label: "Authorization or account discovery failed", detail, status: "blocked" },
      { id: "retry", label: "Retry from the same workspace", detail: "Do not make the user restart the whole launch flow.", status: "todo" }
    ],
    readiness: baseReadiness({
      accountConnection: "Retry required"
    }),
    blockers: [
      {
        id: "account-discovery-error",
        title: "Could not load advertiser accounts",
        detail,
        severity: "high"
      }
    ],
    product: toProductContext(product)
  };
}

export function draftResult(options?: {
  adId?: string;
  adgroupId?: string;
  campaignId?: string;
  campaignName?: string;
  createdAtStage?: "needs_more_inputs" | "campaign_only" | "campaign_and_adgroup" | "draft_ready";
  targetCountryCode?: string;
  adgroupDailyBudget?: number;
  optimizationGoalLabel?: string;
  biddingStrategyLabel?: string;
  warnings?: string[];
  headline?: string;
  product?: Partial<ProductContext>;
  summary?: string;
}): ToolViewModel {
  const createdAtStage = options?.createdAtStage || "draft_ready";
  const product = toProductContext(options?.product);
  const warnings =
    options?.warnings && options.warnings.length > 0
      ? options.warnings
      : [
          "If billing needs attention, we’ll guide you to finish it before publish.",
          "Nothing goes live until you approve the final launch settings."
        ];
  const defaultHeadlineByStage: Record<typeof createdAtStage, string> = {
    campaign_and_adgroup: "Review before launch.",
    campaign_only: "Review before launch.",
    draft_ready: "Review before launch.",
    needs_more_inputs: "Review before launch."
  };
  const defaultSummaryByStage: Record<typeof createdAtStage, string> = {
    campaign_and_adgroup:
      "Campaign and ad group drafts exist in TikTok. Check what is still needed before any spend starts.",
    campaign_only:
      "The campaign draft exists. Check what is still needed before any spend starts.",
    draft_ready:
      "Check the video, budget, destination, and report plan. We’ll publish only after you confirm.",
    needs_more_inputs:
      "A few inputs are still missing. Review what is ready and what needs attention before continuing."
  };

  return {
    screen: "draft",
    phaseLabel: "Review",
    headline: options?.headline || defaultHeadlineByStage[createdAtStage],
    summary: options?.summary || defaultSummaryByStage[createdAtStage],
    primaryCta: "Approve launch settings",
    secondaryCta: "Edit campaign details",
    timeline: makeTimeline("publish"),
    checklist: [
      { id: "draft", label: "Draft objects created", detail: "Campaign, ad group, and ad IDs should be clearly visible when available.", status: createdAtStage === "needs_more_inputs" ? "blocked" : "done" },
      { id: "review", label: "Review launch settings", detail: "Budget, geo, CTA, landing page, and identity should be legible in one place.", status: "current" },
      { id: "publish", label: "Publish only after explicit approval", detail: "Keep the user in control of the final go-live step.", status: "todo" }
    ],
    highlights: [
      { label: "Draft status", value: createdAtStage.replaceAll("_", " "), tone: createdAtStage === "draft_ready" ? "good" : "warn" },
      { label: "Campaign ID", value: options?.campaignId || "Pending" },
      { label: "Ad ID", value: options?.adId || "Pending" }
    ],
    readiness: baseReadiness({
      accountConnection: "Selected advertiser ready",
      identity: options?.adId ? "Connected and usable" : "Needs final confirmation",
      payment: "Check before enabling delivery",
      video: options?.adId ? "Launch asset attached" : "Still needs video or creative input"
    }),
    draft: {
      name: options?.campaignName || `${product.title} | Smart+ | ${options?.targetCountryCode || "CA"}`,
      objective: "Web Conversions",
      fields: [
        { label: "Campaign ID", value: options?.campaignId || "Pending creation", editable: false },
        { label: "Ad group ID", value: options?.adgroupId || "Pending creation", editable: false },
        { label: "Ad ID", value: options?.adId || "Pending creation", editable: false },
        { label: "Daily budget", value: `$${options?.adgroupDailyBudget || 80}`, editable: true },
        { label: "Country", value: options?.targetCountryCode || "CA", editable: true },
        { label: "Optimization goal", value: options?.optimizationGoalLabel || "Landing page views", editable: true },
        { label: "Bidding strategy", value: options?.biddingStrategyLabel || "Maximum delivery", editable: true }
      ],
      warnings
    },
    optionGroups: [
      {
        title: "How to present draft review",
        options: [
          {
            id: "review-one",
            title: "Show a launch summary, not raw JSON",
            kicker: "Content design",
            description: "Keep the review card human-readable so the advertiser can approve quickly and with confidence.",
            status: "recommended",
            meta: ["One page summary", "Explicit publish control"]
          },
          {
            id: "review-two",
            title: "Escalate missing setup in-place",
            kicker: "Support design",
            description: "If a real blocker exists, show it in the draft review card so the user understands exactly why publish is paused.",
            status: "ready",
            meta: ["No hidden failures", "Better than a late error"]
          }
        ]
      }
    ],
    capabilityNotes: defaultCapabilityNotes(),
    product
  };
}

export function reportingSetupResult(options?: {
  advertiserId: string;
  cadence: "daily" | "weekly" | "monthly";
  deliveryMode: "chatgpt_digest" | "async_export" | "webhook";
  focus: "creative" | "delivery" | "conversion";
}): ToolViewModel {
  const cadenceLabel = options?.cadence || "weekly";
  const deliveryMode = options?.deliveryMode || "chatgpt_digest";
  const focus = options?.focus || "conversion";

  return {
    screen: "reporting",
    phaseLabel: "Reporting follow-through",
    headline: "Set up a reporting lane while the launch context is still fresh",
    summary:
      "Most advertisers do not just need a campaign published. They need a light-touch follow-up lane that tells them what happened, what to change, and when to come back. This is where the app should set that expectation and wire the right reporting mode.",
    primaryCta: "Save reporting plan",
    secondaryCta: "Compare delivery options",
    timeline: makeTimeline("reporting"),
    checklist: [
      { id: "focus", label: "Choose the first reporting lens", detail: "Start with the question the advertiser cares about most: delivery, creative, or conversions.", status: "current" },
      { id: "cadence", label: "Choose a reporting cadence", detail: "Default to weekly for most SMB advertisers; daily only when they are actively learning or troubleshooting.", status: "current" },
      { id: "delivery", label: "Choose delivery mode", detail: "Let the user pick between in-chat digests, async exports, or webhooks if the integration is ready.", status: "todo" }
    ],
    highlights: [
      { label: "Cadence", value: cadenceLabel, tone: "accent" },
      { label: "Delivery mode", value: deliveryMode.replace("_", " ") },
      { label: "Focus", value: focus, tone: "good" }
    ],
    optionGroups: [
      {
        title: "Reporting delivery modes",
        description: "Different advertisers need different levels of fidelity and automation.",
        options: [
          {
            id: "digest",
            title: "ChatGPT digest",
            kicker: "Recommended default",
            description: "A friendly recurring summary with a few metrics, a diagnosis, and 1-2 next actions is the best first reporting experience for most advertisers.",
            status: deliveryMode === "chatgpt_digest" ? "recommended" : "ready",
            meta: ["Best for SMBs", "Needs thread-side scheduling"]
          },
          {
            id: "export",
            title: "Async export",
            kicker: "Ops-friendly",
            description: "Good for agencies or analysts who want a CSV/XLSX task and will review the data outside the chat flow.",
            status: deliveryMode === "async_export" ? "connected" : "ready",
            meta: ["Maps to report_task_create", "Good for larger accounts"]
          },
          {
            id: "webhook",
            title: "Webhook subscription",
            kicker: "Advanced / allowlist-sensitive",
            description: "Great when the integration wants push-style updates, but this path needs a durable callback service and may be allowlist-limited.",
            status: deliveryMode === "webhook" ? "draft" : "blocked",
            meta: ["Maps to subscription_subscribe_create", "Not the best default UX"]
          }
        ]
      }
    ],
    reportPlan: {
      cadence: cadenceLabel,
      delivery: deliveryMode.replace("_", " "),
      nextRun: cadenceLabel === "daily" ? "Tomorrow at 9:00 AM advertiser time" : cadenceLabel === "weekly" ? "Next Monday at 9:00 AM advertiser time" : "First business day of next month",
      focus: focus,
      metrics: focus === "creative" ? ["CTR", "watch-through rate", "top creative fatigue signals"] : focus === "delivery" ? ["spend", "impressions", "CPM"] : ["clicks", "landing page views", "CPA / conversion signals"],
      notes: [
        "Use synchronous integrated reports for lightweight in-chat summaries.",
        "Use async report tasks when the user wants exportable files or larger result sets.",
        "Use webhook subscriptions only when the integration is ready for a callback-based reporting lane."
      ]
    },
    capabilityNotes: [
      {
        id: "reports-live",
        title: "Reporting APIs are one of the strongest MCP-backed surfaces",
        detail: "Synchronous reports, async exports, and benchmark-style follow-ups are all feasible paths for a guided reporting experience.",
        status: "live"
      },
      {
        id: "webhook-caution",
        title: "Webhook-driven reporting needs extra product plumbing",
        detail: "It is powerful, but it should not be the default until callback reliability, scheduling, and notification UX are in place.",
        status: "mixed"
      }
    ],
    readiness: baseReadiness({
      accountConnection: `Advertiser ${options?.advertiserId || ""}`.trim(),
      identity: "No longer the main risk",
      payment: "Not relevant for reporting",
      video: "Use creative metrics only when the asset is live"
    })
  };
}

export function publishResult(product?: Partial<ProductContext>): ToolViewModel {
  const currentProduct = toProductContext(product);

  return {
    screen: "publish",
    phaseLabel: "Launch complete",
    headline: "Campaign submitted successfully, and the next best move is follow-through",
    summary:
      "A strong launch state should celebrate briefly, confirm the campaign ID, and immediately guide the advertiser into reporting expectations so they know what success looks like next.",
    primaryCta: "Set up reporting digest",
    secondaryCta: "View in Ads Manager",
    timeline: makeTimeline("publish"),
    highlights: [
      { label: "Launch state", value: "Submitted", tone: "good" },
      { label: "Campaign", value: "spc_poc_20260624_001" },
      { label: "Recommended follow-up", value: "Weekly digest", tone: "accent" }
    ],
    publish: {
      state: "submitted",
      campaignId: "spc_poc_20260624_001",
      nextCheckIn: "Tell the advertiser that learning and performance signals usually need time to stabilize before major changes."
    },
    reportPlan: {
      cadence: "weekly",
      delivery: "ChatGPT digest",
      nextRun: "Next Monday at 9:00 AM advertiser time",
      focus: "conversion",
      metrics: ["spend", "CTR", "landing page views", "CPA / conversion quality"],
      notes: [
        "The first digest should explain whether the campaign is delivering cleanly before recommending optimization.",
        "Keep the first report lightweight and focused on trust-building, not dashboard overload."
      ]
    },
    capabilityNotes: [
      {
        id: "launch-to-report",
        title: "The publish step should naturally hand off into reporting setup",
        detail: "That follow-through is part of the product, not an afterthought.",
        status: "live"
      }
    ],
    readiness: baseReadiness({
      accountConnection: "Live advertiser selected",
      identity: "Live identity attached",
      payment: "Assumed ready for launch",
      video: "Live creative attached"
    }),
    product: currentProduct
  };
}
