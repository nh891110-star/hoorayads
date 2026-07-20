import { z } from "zod";

export const getAdsReportInput = {
  advertiserId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  level: z.enum(["campaign", "adgroup", "ad"]).default("campaign"),
  comparePreviousPeriod: z.boolean().default(true)
};

export const getAdsReportOutput = {
  reportState: z.record(z.any())
};

export const getCreativePerformanceDemoInput = {
  campaignName: z.string().min(1).optional()
};

export const reviewCampaignLaunchDemoInput = {
  campaignName: z.string().min(1).optional(),
  dailyBudget: z.number().positive().optional()
};

export const reviewCampaignUpdateDemoInput = {
  campaignName: z.string().min(1).optional(),
  currentBudget: z.number().positive().optional(),
  proposedBudget: z.number().positive().optional()
};

export const decisionCardDemoOutput = {
  decisionState: z.record(z.any())
};
