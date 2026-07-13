import type {
  GetAdsReportInput,
  ReportLevel,
  ReportMetrics,
  ReportRow,
  ReportRowDetails,
  ReportState
} from "./reporting.js";

const DEMO_ACCOUNT = {
  advertiserId: "demo-7390012345",
  advertiserName: "Demo Advertiser | North America",
  currency: "USD",
  timezone: "America/Los_Angeles"
};

const BASE_METRICS = [
  { spend: 1842.6, impressions: 284100, clicks: 4688 },
  { spend: 1260.4, impressions: 146220, clicks: 3224 },
  { spend: 922.15, impressions: 121800, clicks: 2777 },
  { spend: 714.8, impressions: 103700, clicks: 1984 },
  { spend: 466.25, impressions: 89700, clicks: 1421 }
] as const;

const TREND_SERIES = [
  { spend: 520, impressions: 126738, clicks: 1268 },
  { spend: 625, impressions: 104373, clicks: 2255 },
  { spend: 469, impressions: 134194, clicks: 1691 },
  { spend: 833, impressions: 82007, clicks: 2819 },
  { spend: 677, impressions: 119283, clicks: 1409 },
  { spend: 937, impressions: 96918, clicks: 2678 },
  { spend: 1145, impressions: 82007, clicks: 1974 }
] as const;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  return { startDate: isoDate(start), endDate: isoDate(end) };
}

function validDate(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

function resolveDateRange(input: GetAdsReportInput) {
  const fallback = defaultDateRange();
  const startDate = validDate(input.startDate) ? input.startDate! : fallback.startDate;
  const endDate = validDate(input.endDate) ? input.endDate! : fallback.endDate;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;

  if (days < 1 || days > 30) return fallback;
  return { startDate, endDate };
}

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current <= end) {
    dates.push(isoDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function completeMetrics(metrics: { spend: number; impressions: number; clicks: number }): ReportMetrics {
  return {
    ...metrics,
    ctr: metrics.impressions ? (metrics.clicks / metrics.impressions) * 100 : 0,
    cpc: metrics.clicks ? metrics.spend / metrics.clicks : 0,
    cpm: metrics.impressions ? (metrics.spend / metrics.impressions) * 1000 : 0
  };
}

function row(index: number, id: string, name: string, status: string, details: ReportRowDetails): ReportRow {
  return {
    id,
    name,
    status,
    details,
    ...completeMetrics(BASE_METRICS[index])
  };
}

function rowsForLevel(level: ReportLevel) {
  if (level === "campaign") {
    return [
      row(0, "qa-campaign-1", "Summer Sale | Prospecting", "Active", { campaignBudget: "500 USD | Daily" }),
      row(1, "qa-campaign-2", "Always-on Retargeting", "Active", { campaignBudget: "300 USD | Daily" }),
      row(2, "qa-campaign-3", "Creator Spark Test", "Active", { campaignBudget: "2,500 USD | Lifetime" }),
      row(3, "qa-campaign-4", "Catalog Best Sellers", "Active", { campaignBudget: "No limit" }),
      row(4, "qa-campaign-5", "App Install | US", "Paused", { campaignBudget: "250 USD | Daily" })
    ];
  }

  if (level === "adgroup") {
    return [
      row(0, "qa-adgroup-1", "Prospecting | Broad US", "Active", {
        adgroupId: "qa-adgroup-1",
        budget: "100 USD | Daily",
        bid: "12 USD | Custom",
        adScheduling: "Jul 1, 2026 - Jul 31, 2026",
        attributionSetting: "7-day click | 1-day view"
      }),
      row(1, "qa-adgroup-2", "Retargeting | 14-day visitors", "Active", {
        adgroupId: "qa-adgroup-2",
        budget: "140 USD | Daily",
        bid: "Maximum delivery",
        adScheduling: "Jul 1, 2026 - Ongoing",
        attributionSetting: "7-day click | 1-day view"
      }),
      row(2, "qa-adgroup-3", "Creator audience | US", "Active", {
        adgroupId: "qa-adgroup-3",
        budget: "600 USD | Lifetime",
        bid: "3.2 ROAS",
        adScheduling: "Jul 5, 2026 - Jul 19, 2026",
        attributionSetting: "1-day click | 1-day view"
      }),
      row(3, "qa-adgroup-4", "Catalog | High intent", "Active", {
        adgroupId: "qa-adgroup-4",
        budget: "80 USD | Daily",
        bid: "Maximum delivery",
        adScheduling: "Jul 1, 2026 - Ongoing",
        attributionSetting: "7-day click | 1-day view"
      }),
      row(4, "qa-adgroup-5", "App installs | iOS", "Paused", {
        adgroupId: "qa-adgroup-5",
        budget: "75 USD | Daily",
        bid: "8 USD | Cost cap",
        adScheduling: "Jul 1, 2026 - Jul 31, 2026",
        attributionSetting: "7-day click | 1-day view"
      })
    ];
  }

  return [
    row(0, "qa-ad-1", "Creator video A", "Active", {
      source: "TikTok account",
      adgroupId: "qa-adgroup-1",
      adgroupName: "Prospecting | Broad US",
      adId: "qa-ad-1"
    }),
    row(1, "qa-ad-2", "Product demo", "Active", {
      source: "Custom identity",
      adgroupId: "qa-adgroup-2",
      adgroupName: "Retargeting | 14-day visitors",
      adId: "qa-ad-2"
    }),
    row(2, "qa-ad-3", "Spark testimonial", "Active", {
      source: "Spark Ad",
      adgroupId: "qa-adgroup-3",
      adgroupName: "Creator audience | US",
      adId: "qa-ad-3"
    }),
    row(3, "qa-ad-4", "Catalog card", "Active", {
      source: "TikTok account",
      adgroupId: "qa-adgroup-4",
      adgroupName: "Catalog | High intent",
      adId: "qa-ad-4"
    }),
    row(4, "qa-ad-5", "App install video", "Paused", {
      source: "Custom identity",
      adgroupId: "qa-adgroup-5",
      adgroupName: "App installs | iOS",
      adId: "qa-ad-5"
    })
  ];
}

function totalMetrics(rows: ReportRow[]) {
  return completeMetrics(
    rows.reduce(
      (total, current) => ({
        spend: total.spend + current.spend,
        impressions: total.impressions + current.impressions,
        clicks: total.clicks + current.clicks
      }),
      { spend: 0, impressions: 0, clicks: 0 }
    )
  );
}

export function createDemoTikTokAdsReport(input: GetAdsReportInput): ReportState {
  const level = input.level || "campaign";
  const { startDate, endDate } = resolveDateRange(input);
  const rows = rowsForLevel(level);
  const totals = totalMetrics(rows);
  const advertiserId = input.advertiserId?.trim() || DEMO_ACCOUNT.advertiserId;
  const advertiserName = advertiserId === DEMO_ACCOUNT.advertiserId
    ? DEMO_ACCOUNT.advertiserName
    : `Demo Advertiser | ${advertiserId}`;

  return {
    status: "ready",
    generatedAt: new Date().toISOString(),
    requestTool: "get_ads_report_demo",
    advertiser: {
      id: advertiserId,
      name: advertiserName,
      currency: DEMO_ACCOUNT.currency,
      timezone: DEMO_ACCOUNT.timezone
    },
    accountOptions: [DEMO_ACCOUNT],
    filters: {
      startDate,
      endDate,
      level,
      comparePreviousPeriod: input.comparePreviousPeriod !== false
    },
    totals,
    kpis: [
      { key: "spend", label: "Spend", value: totals.spend, deltaPercent: 12.4 },
      { key: "impressions", label: "Impressions", value: totals.impressions, deltaPercent: 8.6 },
      { key: "clicks", label: "Clicks", value: totals.clicks, deltaPercent: 15.8 },
      { key: "ctr", label: "CTR", value: totals.ctr, deltaPercent: 6.7 }
    ],
    trend: datesBetween(startDate, endDate).map((date, index) => ({
      date,
      ...TREND_SERIES[index % TREND_SERIES.length]
    })),
    rows,
    diagnosis: {
      status: "issues",
      suggestions: [
        {
          source: "tiktok",
          category: "creative",
          suggestionCode: "VIDEO_RESOLUTION",
          suggestionId: "suggestion-creative-1",
          adgroupId: "qa-adgroup-1",
          adId: "qa-ad-1",
          entityName: "Creator video A",
          message: "Replace this video with a higher-resolution version.",
          suggestionTime: `${endDate} 10:30:00`,
          details: ["Ad group ID: qa-adgroup-1", "Ad ID: qa-ad-1"]
        },
        {
          source: "tiktok",
          category: "bid_and_budget",
          suggestionCode: "SUGGEST_BUDGET",
          suggestionId: "suggestion-budget-1",
          adgroupId: "qa-adgroup-2",
          entityName: "Retargeting | 14-day visitors",
          message: "TikTok recommends adjusting the budget.",
          currentValue: "100 USD",
          recommendedValue: "140 USD",
          suggestionTime: `${endDate} 10:30:00`
        },
        {
          source: "tiktok",
          category: "event_track",
          suggestionCode: "PIXEL",
          suggestionId: "suggestion-pixel-1",
          adgroupId: "qa-adgroup-3",
          entityName: "Creator audience | US",
          message: "Check and test the Pixel setup; TikTok detected no recent activity.",
          suggestionTime: `${endDate} 10:30:00`
        }
      ]
    }
  };
}
