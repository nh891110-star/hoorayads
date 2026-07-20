import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const css = readFileSync(new URL("../web/campaign-review-widget.css", import.meta.url), "utf8");
const widgetJs = readFileSync(new URL("../web/campaign-review-widget.js", import.meta.url), "utf8");
const screenshotPrefix = process.env.QA_SCREENSHOT_PREFIX;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseState = {
  proposalId: "proposal-qa",
  version: 1,
  status: "proposed",
  readyToCreate: true,
  isCurrentVersion: true,
  createdAt: "2026-07-18T08:00:00.000Z",
  validationErrors: [],
  account: {
    advertiserId: "7481826080479870993",
    maskedAdvertiserId: "7481…0993",
    advertiserName: "Education Coaching0315",
    currency: "USD",
    country: "US",
    status: "STATUS_ENABLE",
    timezone: "Etc/GMT+5"
  },
  campaign: {
    advertiserId: "7481826080479870993",
    campaignName: "MCP UI QA - Website Conversions",
    objectiveType: "WEB_CONVERSIONS",
    budget: 50,
    budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
    budgetOptimizeOn: true,
    salesDestination: "WEBSITE",
    catalogEnabled: false,
    specialIndustries: [],
    specialIndustriesConfirmed: true,
    campaignType: "REGULAR_CAMPAIGN",
    aiSuggestedFields: ["campaignName", "objectiveType", "budget", "budgetMode", "salesDestination"],
    operationStatus: "ENABLE"
  }
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 860, height: 960 } });

await page.setContent(`
  <!doctype html>
  <html>
    <head><style>${css}</style></head>
    <body>
      <div id="campaign-review-root"></div>
      <script>
        window.__calls = [];
        window.__state = ${JSON.stringify(baseState)};
        window.__CAMPAIGN_REVIEW_PREVIEW_STATE__ = window.__state;
        window.openai = {
          callTool: async (name, args) => {
            window.__calls.push({ name, args });
            if (name === "revise_smartplus_campaign_review") {
              window.__state = {
                ...window.__state,
                version: window.__state.version + 1,
                campaign: { ...window.__state.campaign, ...args, aiSuggestedFields: [] }
              };
            }
            if (name === "create_smartplus_campaign_from_review") {
              window.__state = {
                ...window.__state,
                status: "created",
                readyToCreate: false,
                execution: {
                  status: "created",
                  campaignId: "1840000000000000001",
                  operationStatus: "ENABLE",
                  verifiedAt: "2026-07-18T08:05:00.000Z",
                  verifiedCampaign: {
                    campaignId: "1840000000000000001",
                    campaignName: "MCP UI QA - App Promotion",
                    objectiveType: "APP_PROMOTION",
                    operationStatus: "ENABLE",
                    secondaryStatus: "CAMPAIGN_STATUS_ENABLE",
                    budget: 50,
                    currentBudget: 50,
                    budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
                    budgetOptimizeOn: true,
                    catalogEnabled: false,
                    specialIndustries: [],
                    createTime: "2026-07-18 08:05:00"
                  }
                }
              };
            }
            return { structuredContent: { campaignReviewState: window.__state } };
          },
          notifyIntrinsicHeight: () => {}
        };
      </script>
      <script type="module">${widgetJs}</script>
    </body>
  </html>
`);

assert(await page.getByText("MCP UI QA - Website Conversions").isVisible(), "Proposed Campaign name is not visible.");
assert(await page.getByText("Status after creation").isVisible(), "Active status review is missing.");
assert((await page.getByText("AI suggested", { exact: true }).count()) === 5, "Each model-proposed visible setting must use its own green AI suggested label.");
assert(await page.getByText("Proposal values only.", { exact: false }).isVisible(), "Proposed card must disclose that its fields are not TikTok read-back.");
assert((await page.getByText("Ad Group", { exact: false }).count()) === 1, "Only consequence copy should mention Ad Groups.");
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-proposed.png`, fullPage: true });

await page.getByRole("button", { name: "Edit" }).click();
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-edit.png`, fullPage: true });
await page.getByLabel("Campaign objective").selectOption("LEAD_GENERATION");
assert((await page.getByLabel("Sales destination").count()) === 0, "Lead Generation edit state must hide Sales destination.");
await page.getByLabel("Campaign name").fill("MCP UI QA - Lead Generation");
await page.getByRole("button", { name: "Apply changes" }).click();

let lastCall = await page.evaluate(() => window.__calls.at(-1));
assert(lastCall.name === "revise_smartplus_campaign_review", "Apply changes must call the revision tool.");
assert(lastCall.args.expectedVersion === 1, "Apply changes must use compare-and-swap version 1.");
assert(lastCall.args.objectiveType === "LEAD_GENERATION", "Updated objective was not submitted.");
assert(lastCall.args.salesDestination === undefined, "Lead Generation must not submit Sales destination.");
assert(await page.getByText("MCP UI QA - Lead Generation").isVisible(), "Revised Campaign card was not rendered.");

await page.getByRole("button", { name: "Edit" }).click();
await page.getByLabel("Campaign objective").selectOption("APP_PROMOTION");
assert(await page.getByLabel("App promotion type").isVisible(), "App Promotion edit state must show App promotion type.");
assert(await page.getByLabel("App ID").isVisible(), "App Promotion edit state must show App ID.");
assert(await page.getByLabel("Campaign type").isVisible(), "App Promotion edit state must show Campaign type.");
await page.getByLabel("Campaign name").fill("MCP UI QA - App Promotion");
await page.getByLabel("App ID").fill("1234567890123456789");
await page.getByRole("button", { name: "Apply changes" }).click();

lastCall = await page.evaluate(() => window.__calls.at(-1));
assert(lastCall.name === "revise_smartplus_campaign_review", "App Promotion changes must use the revision tool.");
assert(lastCall.args.expectedVersion === 2, "App Promotion revision must use compare-and-swap version 2.");
assert(lastCall.args.objectiveType === "APP_PROMOTION", "App Promotion objective was not submitted.");
assert(lastCall.args.appId === "1234567890123456789", "App Promotion App ID was not submitted.");

await page.getByRole("button", { name: "Confirm" }).click();
lastCall = await page.evaluate(() => window.__calls.at(-1));
assert(lastCall.name === "create_smartplus_campaign_from_review", "Create campaign must call the dedicated create tool.");
assert(lastCall.args.expectedVersion === 3, "Create campaign must submit only the latest proposal version.");
assert(await page.getByText("Submitted successfully").isVisible(), "Verified success state was not rendered.");
assert(await page.getByText("1840000000000000001").isVisible(), "Success receipt is missing Campaign ID.");
assert(await page.getByText("TikTok Campaign read-back").isVisible(), "Success receipt must disclose its TikTok read-back source.");
assert(await page.getByText("Fields marked TikTok verified", { exact: false }).isVisible(), "Success card must explain per-field provenance.");
assert((await page.getByText("TikTok verified", { exact: true }).count()) >= 5, "Read-back fields are not marked TikTok verified.");
assert((await page.getByText("Proposal", { exact: true }).count()) >= 2, "Fields omitted from TikTok read-back must remain marked Proposal.");
assert((await page.getByRole("button", { name: "Confirm" }).count()) === 0, "Success state must not keep an active confirm button.");
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-success.png`, fullPage: true });

await page.evaluate(() => {
  window.openai.toolOutput = {
    structuredContent: {
      campaignReviewState: {
        ...window.__state,
        status: "outcome_unknown",
        execution: {
          ...window.__state.execution,
          operationStatus: "DISABLE",
          errorCode: "CAMPAIGN_READBACK_MISMATCH",
          errorMessage: "TikTok read-back did not confirm Active operation status.",
          verifiedCampaign: {
            ...window.__state.execution.verifiedCampaign,
            operationStatus: "DISABLE"
          }
        }
      }
    }
  };
  window.dispatchEvent(new Event("openai:set_globals"));
});
assert(await page.getByText("Creation status is not yet confirmed.").isVisible(), "Read-back mismatch must render an unconfirmed status notice.");
assert(await page.getByText("Unconfirmed · TikTok returned DISABLE").isVisible(), "Read-back mismatch must not be presented as Active.");
assert(await page.getByText("do not submit this proposal again", { exact: false }).isVisible(), "Unconfirmed read-back must block duplicate submission guidance.");

await page.evaluate(() => {
  window.openai.toolOutput = {
    structuredContent: {
      campaignReviewState: {
        ...window.__state,
        status: "outdated",
        readyToCreate: false,
        isCurrentVersion: false,
        execution: undefined
      }
    }
  };
  window.dispatchEvent(new Event("openai:set_globals"));
});
assert(await page.getByText("Inactive").isVisible(), "A stale proposal must render the Inactive state.");
assert((await page.getByRole("button", { name: "Confirm" }).count()) === 0, "Inactive proposals must not keep an active confirm button.");

await page.evaluate(() => {
  window.openai.toolOutput = {
    structuredContent: {
      campaignReviewState: {
        ...window.__state,
        proposalId: "",
        status: "error",
        readyToCreate: false,
        execution: {
          status: "failed",
          errorCode: "TIKTOK_AUTH_REQUIRED",
          errorMessage: "Connect a TikTok advertiser account before reviewing this campaign.",
          authorizationUrl: "https://business-api.tiktok.com/oauth/test"
        }
      }
    }
  };
  window.dispatchEvent(new Event("openai:set_globals"));
});
assert(await page.getByText("Campaign was not created.").isVisible(), "Error state must explain that no campaign was created.");
assert(await page.getByRole("button", { name: "Connect advertiser account" }).isVisible(), "OAuth error state must expose a connection action.");

await browser.close();
console.log(JSON.stringify({ ok: true, checked: ["proposed", "edit", "web_fields", "lead_fields", "app_promotion_fields", "revision", "create", "verified_receipt", "field_provenance", "readback_mismatch", "inactive", "oauth_error"] }, null, 2));
