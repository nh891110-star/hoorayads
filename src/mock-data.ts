export type TimelineStep = {
  id: string;
  label: string;
  status: "done" | "current" | "todo";
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

export type ToolViewModel = {
  screen: "scrape" | "storyboard" | "render" | "accounts" | "draft" | "publish";
  headline: string;
  summary: string;
  primaryCta: string;
  secondaryCta?: string;
  timeline: TimelineStep[];
  blockers?: Blocker[];
  product?: {
    title: string;
    price: string;
    destination: string;
    platform: string;
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
  auth?: {
    status: "connected" | "needs_authorization";
    authorizationUrl?: string;
    redirectUri?: string;
  };
};

export const previewState: ToolViewModel = {
  screen: "storyboard",
  headline: "Storyboard approved, ready to render the ad",
  summary:
    "The private POC follows the original TikTok ChatGPT App PRD: product URL in, storyboard review, video generation, Smart+ draft creation, and publish.",
  primaryCta: "Generate video",
  secondaryCta: "Revise storyboard",
  timeline: [
    { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
    { id: "storyboard", label: "Storyboard approved", status: "current", owner: "user" },
    { id: "render", label: "Video rendering", status: "todo", owner: "chatgpt" },
    { id: "account", label: "Ad account + identity", status: "todo", owner: "tiktok" },
    { id: "publish", label: "Publish", status: "todo", owner: "user" }
  ],
  product: {
    title: "CloudSoft Compression Pillow",
    price: "$49",
    destination: "https://merchant.example/products/cloudsoft-pillow",
    platform: "Direct product URL"
  },
  readiness: {
    accountConnection: "Connect during campaign setup",
    identity: "Required before Smart+ draft",
    payment: "Check before publish",
    video: "Storyboard locked, render pending",
    recommendedObjective: "Web Conversions"
  },
  angles: [
    {
      id: "hook-01",
      title: "Pain-to-comfort switch",
      hook: "Start with the sleep problem, then flip to a tactile product reveal and natural spoken line.",
      format: "2-scene UGC",
      targetObjective: "Web Conversions"
    },
    {
      id: "hook-02",
      title: "Giftable upgrade",
      hook: "Frame the product as an easy premium gift and keep the spoken line warm and direct.",
      format: "2-scene lifestyle",
      targetObjective: "Web Conversions"
    }
  ]
};

export function scrapeResult(url: string): ToolViewModel {
  return {
    screen: "scrape",
    headline: "Product details captured",
    summary:
      "This first review checkpoint is where the app confirms the scraped title, price, description, and reference images before moving into storyboard generation.",
    primaryCta: "Looks correct",
    secondaryCta: "Replace images",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "current", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "todo", owner: "user" },
      { id: "render", label: "Video rendering", status: "todo", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "todo", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    product: {
      title: "Detected product page",
      price: "Pending extraction",
      destination: url,
      platform: "Direct product URL"
    }
  };
}

export function storyboardResult(): ToolViewModel {
  return {
    screen: "storyboard",
    headline: "Storyboard draft ready for user review",
    summary:
      "The app should show a visual-first scene review with motion, spoken line, and tone before it ever starts a video render.",
    primaryCta: "Approve storyboard",
    secondaryCta: "Change the hook",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "current", owner: "user" },
      { id: "render", label: "Video rendering", status: "todo", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "todo", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    angles: [
      {
        id: "scene-1",
        title: "Scene 1: Hook",
        hook: "Camera pushes in on a tired customer, then lands on the product with a fast emotional contrast.",
        format: "8s scene",
        targetObjective: "Attention + click intent"
      },
      {
        id: "scene-2",
        title: "Scene 2: Payoff + CTA",
        hook: "The speaker demonstrates the benefit and closes with a direct reason to tap through now.",
        format: "8s scene",
        targetObjective: "Landing page view"
      }
    ],
    product: {
      title: "CloudSoft Compression Pillow",
      price: "$49",
      destination: "https://merchant.example/products/cloudsoft-pillow",
      platform: "Direct product URL"
    }
  };
}

export function renderPendingResult(): ToolViewModel {
  return {
    screen: "render",
    headline: "Video render is in progress",
    summary:
      "The PRD expects this to return immediately with a job ID and let ChatGPT poll for completion rather than blocking in one long request.",
    primaryCta: "Check again",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "current", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "todo", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    readiness: {
      accountConnection: "Will be checked after render",
      identity: "Will be verified before draft creation",
      payment: "Will be checked before publish",
      video: "Pending",
      recommendedObjective: "Web Conversions"
    }
  };
}

export function accountResult(): ToolViewModel {
  return {
    screen: "accounts",
    headline: "Ready to create a Smart+ draft",
    summary:
      "The app now narrows down the advertiser account, TikTok identity, and payment path before it writes campaign objects.",
    primaryCta: "Create draft",
    secondaryCta: "Switch account",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "current", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    blockers: [
      {
        id: "identity",
        title: "TikTok identity check",
        detail: "If no usable identity is connected, the app should return an authorization link instead of failing late.",
        severity: "medium"
      }
    ],
    readiness: {
      accountConnection: "1 advertiser selected",
      identity: "Connected",
      payment: "Needs verification",
      video: "Renderable preview ready",
      recommendedObjective: "Smart+ Web Conversions"
    }
  };
}

export function accountAuthorizationResult(authorizationUrl: string, redirectUri: string): ToolViewModel {
  return {
    screen: "accounts",
    headline: "Authorize TikTok Ads access to continue",
    summary:
      "The app can already guide the creative flow, but it needs TikTok Ads authorization before it can load your real advertiser accounts and continue to draft creation.",
    primaryCta: "Authorize TikTok Ads",
    secondaryCta: "Check setup",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "current", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    blockers: [
      {
        id: "mcp-authorization",
        title: "TikTok MCP authorization required",
        detail: "Finish the TikTok authorization flow once, then return here and continue with the same Hooray TikTok Ads session.",
        severity: "high"
      }
    ],
    readiness: {
      accountConnection: "Not authorized yet",
      identity: "Will verify after account discovery",
      payment: "Check later in flow",
      video: "Renderable preview ready",
      recommendedObjective: "Smart+ Web Conversions"
    },
    auth: {
      status: "needs_authorization",
      authorizationUrl,
      redirectUri
    }
  };
}

export function identityConnectResult(authorizationUrl: string, redirectUri: string): ToolViewModel {
  return {
    screen: "accounts",
    headline: "Connect a TikTok identity before creating the draft",
    summary:
      "This account does not have a usable TikTok identity yet. The app should open the TikTok authorization flow, then return here and continue with draft creation.",
    primaryCta: "Connect TikTok identity",
    secondaryCta: "Use another advertiser",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "current", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    blockers: [
      {
        id: "identity-connect",
        title: "Identity connection required",
        detail: "Return the user to TikTok authorization and resume the Smart+ draft flow after callback.",
        severity: "high"
      }
    ],
    readiness: {
      accountConnection: "1 advertiser selected",
      identity: "Needs authorization",
      payment: "Check after identity setup",
      video: "Renderable preview ready",
      recommendedObjective: "Smart+ Web Conversions"
    },
    auth: {
      status: "needs_authorization",
      authorizationUrl,
      redirectUri
    }
  };
}

export function liveAccountResult(options: {
  accounts: AdvertiserSummary[];
  selectedAdvertiserId?: string;
  selectedIdentities?: IdentitySummary[];
  userDisplayName?: string;
}): ToolViewModel {
  const selectedAccount =
    options.accounts.find((account) => account.advertiserId === options.selectedAdvertiserId) || options.accounts[0];
  const multipleAccounts = options.accounts.length > 1;
  const selectedIdentityCount = options.selectedIdentities?.length ?? selectedAccount?.identityCount ?? 0;
  const hasAccountList = options.accounts.length > 0;

  return {
    screen: "accounts",
    headline: multipleAccounts
      ? `Choose the advertiser to use for this draft`
      : `Account ready for Smart+ draft creation`,
    summary: multipleAccounts
      ? `${options.userDisplayName || "This TikTok Ads user"} can access ${options.accounts.length} advertiser accounts. Pick one, then the app will confirm identity and payment readiness.`
      : hasAccountList
        ? `The TikTok Ads connection is live. The app found one advertiser account and can continue into identity verification and Smart+ draft creation.`
        : `The TikTok Ads connection is live. The selected advertiser can now continue into Smart+ draft creation.`,
    primaryCta: selectedIdentityCount > 0 ? "Continue with this account" : "Verify identity",
    secondaryCta: multipleAccounts ? "Switch advertiser" : "Review account details",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "current", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    readiness: {
      accountConnection: hasAccountList
        ? `${options.accounts.length} advertiser account${options.accounts.length === 1 ? "" : "s"} available`
        : "Selected advertiser ready",
      identity: selectedIdentityCount > 0 ? `${selectedIdentityCount} usable identit${selectedIdentityCount === 1 ? "y" : "ies"} found` : "Needs verification",
      payment: "Check before publish",
      video: "Renderable preview ready",
      recommendedObjective: "Smart+ Web Conversions"
    },
    accounts: options.accounts,
    identities: options.selectedIdentities,
    blockers:
      selectedIdentityCount > 0
        ? []
        : [
            {
              id: "identity-review",
              title: "Identity check still needed",
              detail: "Before creating the draft, the app should confirm the selected advertiser has a usable TikTok identity.",
              severity: "medium"
            }
          ],
    product: {
      title: "CloudSoft Compression Pillow",
      price: "$49",
      destination: "https://merchant.example/products/cloudsoft-pillow",
      platform: "Direct product URL"
    }
  };
}

export function accountErrorResult(detail: string): ToolViewModel {
  return {
    screen: "accounts",
    headline: "TikTok account setup needs attention",
    summary:
      "The app could not finish advertiser account discovery. Instead of dropping a raw API error, it should tell the user what to fix and let them retry from the same step.",
    primaryCta: "Try again",
    secondaryCta: "Check TikTok access",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "current", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "todo", owner: "user" }
    ],
    blockers: [
      {
        id: "account-discovery-error",
        title: "Could not load advertiser accounts",
        detail,
        severity: "high"
      }
    ],
    readiness: {
      accountConnection: "Retry required",
      identity: "Not checked yet",
      payment: "Not checked yet",
      video: "Renderable preview ready",
      recommendedObjective: "Smart+ Web Conversions"
    }
  };
}

export function draftResult(): ToolViewModel {
  return {
    screen: "draft",
    headline: "Smart+ campaign draft is ready for review",
    summary:
      "This is the campaign setup review card from the PRD: clear defaults, editable fields, and a final user approval before publish.",
    primaryCta: "Approve parameters",
    secondaryCta: "Adjust budget",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "done", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "current", owner: "user" }
    ],
    draft: {
      name: "CloudSoft Pillow | Smart+ | CA",
      objective: "Web Conversions",
      fields: [
        { label: "Daily budget", value: "$80", editable: true },
        { label: "Country", value: "CA", editable: true },
        { label: "Optimization goal", value: "Landing page views", editable: true },
        { label: "Bidding strategy", value: "Maximum delivery", editable: true }
      ],
      warnings: [
        "If payment is missing, the app should return a clear TTAM handoff instead of a raw API error.",
        "Only publish after explicit user approval of campaign parameters."
      ]
    },
    product: {
      title: "CloudSoft Compression Pillow",
      price: "$49",
      destination: "https://merchant.example/products/cloudsoft-pillow",
      platform: "Direct product URL"
    }
  };
}

export function publishResult(): ToolViewModel {
  return {
    screen: "publish",
    headline: "Campaign submitted successfully",
    summary:
      "The success state should confirm the campaign is live, remind the user that performance data takes time, and offer a TTAM link.",
    primaryCta: "View in Ads Manager",
    timeline: [
      { id: "scrape", label: "Product scraped", status: "done", owner: "chatgpt" },
      { id: "storyboard", label: "Storyboard approved", status: "done", owner: "user" },
      { id: "render", label: "Video rendering", status: "done", owner: "chatgpt" },
      { id: "account", label: "Ad account + identity", status: "done", owner: "tiktok" },
      { id: "publish", label: "Publish", status: "done", owner: "user" }
    ],
    publish: {
      state: "submitted",
      campaignId: "spc_poc_20260624_001",
      nextCheckIn: "Tell the user that results may take 24-48 hours to stabilize."
    }
  };
}
