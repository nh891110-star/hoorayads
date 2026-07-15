import { randomUUID } from "node:crypto";

export type CreativePerformanceDemoInput = {
  campaignName?: string;
};

export type CampaignLaunchReviewDemoInput = {
  campaignName?: string;
  dailyBudget?: number;
};

export type CampaignUpdateReviewDemoInput = {
  campaignName?: string;
  currentBudget?: number;
  proposedBudget?: number;
};

const DEMO_GENERATED_AT = "2026-07-15T20:45:00-07:00";
const DEMO_ACCOUNT = {
  name: "Northstar US",
  id: "7284•••901",
  currency: "USD",
  timezone: "America/Los_Angeles"
};

function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export function createCreativePerformanceDemo(input: CreativePerformanceDemoInput = {}) {
  const startDate = "2026-07-01";
  const endDate = "2026-07-07";
  const campaignName = input.campaignName || "Summer Launch";

  return {
    schemaVersion: "decision-card-v1",
    cardInstanceId: `creative-demo-v1:${randomUUID()}`,
    kind: "creative_performance",
    mode: "demo",
    generatedAt: DEMO_GENERATED_AT,
    provenance: {
      sourceKind: "demo_fixture",
      mutationOccurred: false,
      capabilityReferenceTools: [
        "creative_report_get",
        "report_video_performance_get",
        "creative_fatigue_get",
        "file_video_ad_info_get"
      ]
    },
    account: DEMO_ACCOUNT,
    campaign: {
      name: campaignName,
      id: "1842•••118",
      objective: "Website conversions"
    },
    period: {
      startDate,
      endDate,
      label: `${dateLabel(startDate)} – ${dateLabel(endDate)}`
    },
    dataThrough: "Jul 7, 11:59 PM PT",
    latencyNote: "Video-level metrics may be delayed by up to 1 hour.",
    comparisonNote:
      "These videos share a campaign and reporting period, but delivery volume differs. Treat this as observed evidence, not a controlled test.",
    creatives: [
      {
        key: "creator-review",
        sourceKind: "demo_fixture",
        name: "Creator review",
        materialId: "6814•••722",
        videoId: "7062•••492",
        adId: "7492•••892",
        source: "Spark Ads",
        spend: 6556,
        impressions: 388240,
        conversions: 356,
        costPerConversion: 18.42,
        clicks: 8698,
        ctr: 2.24,
        cvr: 4.09,
        durationSeconds: 18,
        retention: [100, 91, 84, 77, 70, 63, 55, 47, 38, 28],
        retentionSourceKind: "sampled_demo_curve",
        fatigue: {
          sourceKind: "demo_normalization",
          status: "no_signal_returned",
          label: "No signal returned",
          title: "Demo: no fatigue signal returned",
          detail: "This fixture models an eligible fatigue response with no signal for Ad 7492•••892."
        },
        previewUrl: null
      },
      {
        key: "product-demo",
        sourceKind: "demo_fixture",
        name: "Product demo",
        materialId: "6814•••681",
        videoId: "7062•••681",
        adId: "7492•••655",
        source: "Uploaded video",
        spend: 5808,
        impressions: 314600,
        conversions: 241,
        costPerConversion: 24.1,
        clicks: 5097,
        ctr: 1.62,
        cvr: 4.73,
        durationSeconds: 22,
        retention: [100, 86, 72, 60, 49, 39, 31, 25, 21, 19],
        retentionSourceKind: "sampled_demo_curve",
        fatigue: {
          sourceKind: "demo_normalization",
          status: "detected",
          label: "Detected",
          title: "Demo: fatigue signal present",
          detail: "This fixture models a returned fatigue signal for Ad 7492•••655. No cause or action is inferred."
        },
        previewUrl: null
      },
      {
        key: "ugc-hook",
        sourceKind: "demo_fixture",
        name: "UGC hook",
        materialId: "6814•••033",
        videoId: "7062•••033",
        adId: "7492•••421",
        source: "Uploaded video",
        spend: 4102,
        impressions: 280430,
        conversions: 129,
        costPerConversion: 31.8,
        clicks: 2580,
        ctr: 0.92,
        cvr: 5,
        durationSeconds: 15,
        retention: [100, 80, 66, 53, 43, 34, 27, 22, 18, 16],
        retentionSourceKind: "sampled_demo_curve",
        fatigue: {
          sourceKind: "demo_normalization",
          status: "unavailable",
          label: "Not available",
          title: "Demo: fatigue data unavailable",
          detail: "This fixture models an unavailable fatigue result. Unavailable is different from no signal detected."
        },
        previewUrl: null
      }
    ]
  } as const;
}

export function createCampaignLaunchReviewDemo(input: CampaignLaunchReviewDemoInput = {}) {
  const campaignName = input.campaignName || "Summer Launch 2026";
  const dailyBudget = input.dailyBudget || 2000;
  const exposureDays = 16;

  return {
    schemaVersion: "decision-card-v1",
    cardInstanceId: `launch-demo-v1:${randomUUID()}`,
    kind: "campaign_launch_review",
    mode: "demo",
    generatedAt: DEMO_GENERATED_AT,
    provenance: {
      sourceKind: "demo_fixture",
      mutationOccurred: false,
      capabilityReferenceTools: ["campaign_create", "adgroup_create", "ad_create"]
    },
    account: DEMO_ACCOUNT,
    campaign: {
      name: campaignName,
      draftId: "1897•••201",
      objective: "Website conversions",
      optimizationEvent: "Complete payment",
      dailyBudget,
      budgetMode: "Campaign budget optimization",
      schedule: "Jul 16–31, 2026 · 9:00 AM PT",
      startTime: "Jul 16, 2026 · 9:00 AM PT"
    },
    objectCounts: { campaigns: 1, adgroups: 2, ads: 4 },
    exposure: {
      amount: dailyBudget * exposureDays,
      days: exposureDays,
      endDate: "Jul 31, 2026",
      note: "This is a budget limit, not a spend or results forecast."
    },
    sections: [
      {
        title: "Delivery and audience",
        summary: "2 ad groups",
        items: [
          ["Markets", "United States"],
          ["Audience", "Broad · Age 18+"],
          ["Placements", "Automatic placement"],
          ["Bid strategy", "Maximum delivery"],
          ["Attribution", "7-day click · 1-day view"],
          ["Pacing", "Standard"]
        ]
      },
      {
        title: "Destination and measurement",
        summary: "Selected inputs",
        items: [
          ["Destination", "shop.northstar.com/summer"],
          ["Pixel", "Northstar Web · 8721•••440"],
          ["Identity", "@northstar"]
        ]
      },
      {
        title: "Ads and creative",
        summary: "4 video ads",
        items: [
          ["Creator review", "Video 7062•••492"],
          ["Product demo", "Video 7062•••681"],
          ["Additional ads", "2 selected videos"]
        ]
      }
    ],
    preflight: [
      {
        title: "Required draft inputs represented",
        detail: "The fixture includes the campaign, ad group, and ad fields required by this review layout.",
        source: "Illustrative demo check"
      },
      {
        title: "Destination format represented",
        detail: "The fixture includes a valid-format landing-page value for review.",
        source: "Illustrative demo check"
      },
      {
        title: "Selected video references resolved",
        detail: "All 4 video IDs are present in this deterministic demo fixture.",
        source: "Illustrative demo check"
      },
      {
        title: "Campaign access available",
        detail: "The demo fixture represents an account with campaign-management permission.",
        source: "Illustrative demo check"
      }
    ],
    executionNote:
      "A live confirmation would create the campaign, ad groups, and ads through sequential TikTok API calls. Ad approval, delivery, and results are not guaranteed.",
    demoReceipt: {
      receiptMode: "simulation",
      mutationOccurred: false,
      platformRequestId: null,
      campaignId: "demo-campaign-001",
      adgroupCount: 2,
      adCount: 4
    }
  } as const;
}

export function createCampaignUpdateReviewDemo(input: CampaignUpdateReviewDemoInput = {}) {
  const currentBudget = input.currentBudget || 2000;
  const proposedBudget = input.proposedBudget || 2500;
  const currentSpend = 1450;
  const minimumBudget = currentSpend * 1.05;
  const difference = proposedBudget - currentBudget;
  const differencePercent = currentBudget ? (difference / currentBudget) * 100 : 0;

  return {
    schemaVersion: "decision-card-v1",
    cardInstanceId: `update-demo-v1:${randomUUID()}`,
    kind: "campaign_update_review",
    mode: "demo",
    generatedAt: DEMO_GENERATED_AT,
    provenance: {
      sourceKind: "demo_fixture",
      mutationOccurred: false,
      calculationSource: "local_calculation",
      capabilityReferenceTools: ["campaign_get", "report_integrated_get", "campaign_update"]
    },
    account: DEMO_ACCOUNT,
    campaign: {
      name: input.campaignName || "Summer Launch",
      id: "1842•••118",
      status: "Active",
      endDate: null
    },
    change: {
      field: "Daily campaign budget",
      currentValue: currentBudget,
      proposedValue: proposedBudget,
      difference,
      differencePercent
    },
    checks: {
      currentSpend,
      currentSpendSource: "demo_fixture",
      minimumBudget,
      minimumBudgetSource: "tiktok_tool_contract_calculation",
      minimumBudgetFormula: "current spend × 1.05",
      proposedBudget,
      passesMinimum: proposedBudget >= minimumBudget,
      checkResultSource: "local_calculation",
      submittedFields: ["budget"]
    },
    executionNote:
      "A live confirmation would send only the campaign budget field. A higher budget can change spend and delivery; spend already incurred cannot be undone.",
    demoReceipt: {
      receiptMode: "simulation",
      mutationOccurred: false,
      platformRequestId: null,
      verificationSource: "demo_fixture",
      verifiedBudget: proposedBudget,
      verifiedAt: "Jul 15, 8:45 PM PT"
    }
  } as const;
}
