import { z } from "zod";

export const campaignObjectiveSchema = z.enum(["WEB_CONVERSIONS", "LEAD_GENERATION", "APP_PROMOTION"]);
export const campaignBudgetModeSchema = z.enum([
  "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
  "BUDGET_MODE_TOTAL",
  "BUDGET_MODE_INFINITE",
  "BUDGET_MODE_DAY"
]);
export const campaignSalesDestinationSchema = z.enum(["WEBSITE", "APP", "WEB_AND_APP"]);
export const campaignCatalogTypeSchema = z.enum(["ECOMMERCE", "TRAVEL_ENTERTAINMENT", "MINI_SERIES"]);
export const campaignSpecialIndustrySchema = z.enum(["HOUSING", "EMPLOYMENT", "CREDIT"]);
export const campaignAppPromotionTypeSchema = z.enum(["APP_INSTALL", "APP_RETARGETING", "MINIS"]);
export const campaignTypeSchema = z.enum(["REGULAR_CAMPAIGN", "IOS14_CAMPAIGN"]);
export const campaignSourceFieldSchema = z.enum([
  "campaignName",
  "objectiveType",
  "budget",
  "budgetMode",
  "budgetOptimizeOn",
  "salesDestination",
  "catalogEnabled",
  "catalogType",
  "specialIndustries",
  "appPromotionType",
  "appId",
  "campaignType"
]);

export const campaignReviewFields = {
  advertiserId: z.string().optional(),
  advertiserName: z.string().optional(),
  campaignName: z.string().min(1).max(512),
  objectiveType: campaignObjectiveSchema,
  budget: z.number().positive().optional(),
  budgetMode: campaignBudgetModeSchema.optional(),
  budgetOptimizeOn: z.boolean().optional(),
  salesDestination: campaignSalesDestinationSchema.optional(),
  catalogEnabled: z.boolean().optional(),
  catalogType: campaignCatalogTypeSchema.optional(),
  specialIndustries: z.array(campaignSpecialIndustrySchema).max(3).optional(),
  specialIndustriesConfirmed: z.boolean().optional(),
  appPromotionType: campaignAppPromotionTypeSchema.optional(),
  appId: z.string().optional(),
  campaignType: campaignTypeSchema.optional(),
  aiSuggestedFields: z.array(campaignSourceFieldSchema).optional()
};

export const reviewSmartPlusCampaignInput = {
  ...campaignReviewFields
};

export const reviewSmartPlusCampaignOutput = {
  campaignReviewState: z.record(z.any())
};

export const reviseSmartPlusCampaignReviewInput = {
  proposalId: z.string(),
  expectedVersion: z.number().int().positive(),
  campaignName: z.string().min(1).max(512),
  objectiveType: campaignObjectiveSchema,
  budget: z.number().positive().optional(),
  budgetMode: campaignBudgetModeSchema.optional(),
  budgetOptimizeOn: z.boolean().optional(),
  salesDestination: campaignSalesDestinationSchema.optional(),
  catalogEnabled: z.boolean().optional(),
  catalogType: campaignCatalogTypeSchema.optional(),
  specialIndustries: z.array(campaignSpecialIndustrySchema).max(3).optional(),
  specialIndustriesConfirmed: z.boolean().optional(),
  appPromotionType: campaignAppPromotionTypeSchema.optional(),
  appId: z.string().optional(),
  campaignType: campaignTypeSchema.optional(),
  aiSuggestedFields: z.array(campaignSourceFieldSchema).optional()
};

export const reviseSmartPlusCampaignReviewOutput = {
  campaignReviewState: z.record(z.any())
};

export const getSmartPlusCampaignReviewStatusInput = {
  proposalId: z.string(),
  expectedVersion: z.number().int().positive()
};

export const getSmartPlusCampaignReviewStatusOutput = {
  campaignReviewState: z.record(z.any())
};

export const createSmartPlusCampaignFromReviewInput = {
  proposalId: z.string(),
  expectedVersion: z.number().int().positive(),
  confirmed: z.literal(true)
};

export const createSmartPlusCampaignFromReviewOutput = {
  campaignReviewState: z.record(z.any())
};

export type CampaignObjective = z.infer<typeof campaignObjectiveSchema>;
export type CampaignBudgetMode = z.infer<typeof campaignBudgetModeSchema>;
export type CampaignSalesDestination = z.infer<typeof campaignSalesDestinationSchema>;
export type CampaignCatalogType = z.infer<typeof campaignCatalogTypeSchema>;
export type CampaignSpecialIndustry = z.infer<typeof campaignSpecialIndustrySchema>;
export type CampaignAppPromotionType = z.infer<typeof campaignAppPromotionTypeSchema>;
export type CampaignType = z.infer<typeof campaignTypeSchema>;
export type CampaignSourceField = z.infer<typeof campaignSourceFieldSchema>;

export type CampaignReviewInput = {
  advertiserId?: string;
  advertiserName?: string;
  campaignName: string;
  objectiveType: CampaignObjective;
  budget?: number;
  budgetMode?: CampaignBudgetMode;
  budgetOptimizeOn?: boolean;
  salesDestination?: CampaignSalesDestination;
  catalogEnabled?: boolean;
  catalogType?: CampaignCatalogType;
  specialIndustries?: CampaignSpecialIndustry[];
  specialIndustriesConfirmed?: boolean;
  appPromotionType?: CampaignAppPromotionType;
  appId?: string;
  campaignType?: CampaignType;
  aiSuggestedFields?: CampaignSourceField[];
};
