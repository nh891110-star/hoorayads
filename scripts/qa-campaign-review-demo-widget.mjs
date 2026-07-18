import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const css = readFileSync(new URL("../web/campaign-review-widget.css", import.meta.url), "utf8");
const widgetJs = readFileSync(new URL("../web/campaign-review-widget.js", import.meta.url), "utf8");
const screenshotPrefix = process.env.QA_SCREENSHOT_PREFIX;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const state = {
  mode: "demo",
  actionTools: {
    revise: "revise_smartplus_campaign_review_demo",
    status: "get_smartplus_campaign_review_demo_status",
    submit: "submit_smartplus_campaign_review_demo"
  },
  proposalId: "demo-proposal-qa",
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
    timezone: "America/Los_Angeles"
  },
  campaign: {
    advertiserId: "7481826080479870993",
    campaignName: "Demo UI QA - Website Conversions",
    objectiveType: "WEB_CONVERSIONS",
    budget: 50,
    budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
    budgetOptimizeOn: true,
    salesDestination: "WEBSITE",
    catalogEnabled: false,
    specialIndustries: [],
    specialIndustriesConfirmed: true,
    campaignType: "REGULAR_CAMPAIGN",
    aiSuggestedFields: ["budget"],
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
        window.__state = ${JSON.stringify(state)};
        window.__submittedAt = 0;
        window.__CAMPAIGN_REVIEW_PREVIEW_STATE__ = window.__state;
        window.openai = {
          callTool: async (name, args) => {
            window.__calls.push({ name, args });
            if (name === "revise_smartplus_campaign_review_demo") {
              window.__state = {
                ...window.__state,
                version: window.__state.version + 1,
                campaign: { ...window.__state.campaign, ...args, aiSuggestedFields: [] }
              };
            }
            if (name === "submit_smartplus_campaign_review_demo") {
              window.__submittedAt = Date.now();
              window.__state = { ...window.__state, status: "creating", readyToCreate: false, execution: { status: "creating" } };
            }
            if (name === "get_smartplus_campaign_review_demo_status" && window.__submittedAt && Date.now() - window.__submittedAt > 700) {
              window.__state = {
                ...window.__state,
                status: "created",
                execution: {
                  status: "created",
                  campaignId: "demo-qa-receipt",
                  operationStatus: "ENABLE",
                  verifiedAt: "2026-07-18T08:05:00.000Z"
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

assert(await page.getByText("Interaction demo", { exact: true }).isVisible(), "Persistent demo disclosure is missing.");
assert(await page.getByText("No data is sent to TikTok.", { exact: false }).isVisible(), "No-write disclosure is missing.");
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-proposed.png`, fullPage: true });

await page.getByRole("button", { name: "Edit" }).click();
await page.evaluate(() => window.dispatchEvent(new Event("openai:set_globals")));
assert(
  await page.getByRole("button", { name: "Apply changes" }).isVisible(),
  "A duplicate ChatGPT host-state event reset edit mode."
);
await page.getByLabel("Campaign name").fill("Demo UI QA - Edited");
await page.getByRole("button", { name: "Apply changes" }).click();
let lastCall = await page.evaluate(() => window.__calls.at(-1));
assert(lastCall.name === "revise_smartplus_campaign_review_demo", "Edit escaped to the live revision tool.");

await page.getByRole("button", { name: "Confirm" }).click();
lastCall = await page.evaluate(() => window.__calls.at(-1));
assert(lastCall.name === "submit_smartplus_campaign_review_demo", "Confirm escaped to the live create tool.");
assert(await page.getByText("Demo · Submitting…").isVisible(), "Submitting state is missing.");
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-submitting.png`, fullPage: true });

await page.getByText("Demo · Submitted successfully").waitFor({ timeout: 4000 });
assert(await page.getByText("demo-qa-receipt").isVisible(), "Demo receipt is missing.");
assert(await page.getByText("No TikTok API was called", { exact: false }).isVisible(), "Success state does not disclose zero mutation.");
const calls = await page.evaluate(() => window.__calls.map((call) => call.name));
assert(calls.includes("get_smartplus_campaign_review_demo_status"), "Widget did not poll the demo status tool.");
assert(!calls.includes("create_smartplus_campaign_from_review"), "Widget called the live Campaign create tool.");
if (screenshotPrefix) await page.screenshot({ path: `${screenshotPrefix}-success.png`, fullPage: true });

await browser.close();
console.log(JSON.stringify({ ok: true, checked: ["demo_disclosure", "edit_routing", "submit_routing", "submitting", "auto_poll", "demo_receipt", "no_live_write"] }, null, 2));
