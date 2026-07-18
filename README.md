# TikTok Ads Agent POC

This folder contains a private `v0` scaffold for the broader `"[PRD] TikTok <—> ChatGPT App"` flow.

The base journey is now:

1. product URL input
2. scrape and verify product details
3. review reference images
4. generate and review a 2-scene storyboard
5. render a candidate ad video
6. verify ad account, identity, and payment readiness
7. create a Smart+ draft
8. publish after explicit approval
9. generate a live TikTok Ads performance report

This is not Shopify-only. It is meant for any novice SMB advertiser who has a promotable product URL, with TikTok MCP handling the account and campaign side wherever possible.

## What is included

- `src/server.ts`
  Apps SDK-style MCP server scaffold with the user-facing tools described by the original PRD.
- `src/mock-data.ts`
  Deterministic POC data for the rich UI states.
- `src/tool-contract.ts`
  Tool schemas plus a capability map from productized app tools to observed TikTok Ads MCP capabilities.
- `web/`
  Self-contained MCP App UIs for the campaign workflow and cross-host reporting.
- `src/reporting.ts`
  Flat MCP reporting client, level-specific requests, previous-period comparison, metadata enrichment, and official TikTok Ad Diagnosis normalization.
- `src/campaign-review.ts`
  Server-owned Smart+ Campaign proposal versions, advertiser resolution, write guard, idempotent Campaign-only creation, and TikTok read-back reconciliation.
- `docs/capability-map.md`
  The concrete mapping between PRD flow steps and current TikTok Ads MCP coverage.
- `docs/mcp-app-compatibility-playbook.md`
  Persistent debugging guidance for cached widget templates and cross-host MCP transport failures.

## Current scope

This is a private POC scaffold with a working reporting demo, not a production-ready public app.

Already validated in the current environment:

- TikTok Ads MCP auth works for `user_info_get` and `bc_get`
- Business Center discovery is available
- Advertiser, identity, Smart+, ad, and reporting APIs are exposed
- `get_ads_report` returns the reporting MCP App directly
- `get_ads_report_demo` returns the same app with isolated deterministic data for OAuth-free host testing
- ChatGPT and Claude endpoint aliases expose the same portable UI and data contract
- Campaign, ad group, and ad level request mappings pass contract tests
- `tool_diagnosis_get` supplies the report's Issues & recommendations module; the app does not generate performance diagnosis rules
- The unauthenticated state returns the TikTok Ads connection step instead of sample report data
- Live reporting never falls back to demo data; the two tools are intentionally separate
- `/mcp/reporting` is isolated from the Hooray workspace tools and instructions
- Campaign Review supports `WEB_CONVERSIONS`, `LEAD_GENERATION`, and `APP_PROMOTION`; unsupported brand objectives are rejected rather than remapped
- Confirm creates one allowlisted Active Campaign only through `smart_plus_campaign_create`; no Ad Group, Ad, creative, delivery, or spend is created

Still needed for production:

- deploy the current reporting build to the existing public HTTPS service
- create the ChatGPT and Claude custom connectors
- OpenAI app submission assets and review
- a real scrape pipeline for arbitrary product URLs
- a real storyboard-to-video render pipeline
- identity connect-link handling and callback session storage
- payment verification path

## Suggested next steps

1. Install dependencies with `npm install`.
2. Replace mock handlers in `src/server.ts` with real orchestrator calls.
3. Add an HTTP transport at `/mcp` for local and hosted usage.
4. Wire product scraping, rendering, watermarking, and session persistence.
5. Connect the app with ChatGPT developer mode using the hosted MCP endpoint.

## Fastest stable hosting path

The quickest way to get a stable public HTTPS MCP endpoint is to deploy this service as a Node web service on Render and use Render's default domain first.

This repo is prepared for that path:

- `render.yaml` defines a Render web service with `/health` as the health check.
- `src/http-server.ts` respects the platform `PORT` environment variable.
- `pnpm start` runs the MCP HTTP server directly.

Recommended first deploy steps:

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from the repo.
3. If this repo contains only this app, leave the service root empty. If you later move it back into a monorepo, then set the service root accordingly.
4. Add these environment variables in Render:
   - `TIKTOK_APP_ENV=dev`
   - `TIKTOK_APP_ID`
   - `TIKTOK_APP_SECRET`
   - `TIKTOK_REDIRECT_URI=https://<your-render-domain>/callback`
   - `TIKTOK_ADVERTISER_AUTH_URL=https://business-api.tiktok.com/portal/auth?app_id=<your_app_id>&state=your_custom_params&redirect_uri=https%3A%2F%2F<your-render-domain>%2Fcallback`
5. Wait for `/health` to return `200 OK`.
6. Put `https://<your-render-domain>/mcp` into the ChatGPT app builder.
7. Put `https://<your-render-domain>/callback` into the TikTok developer app.

For the reporting demo, use these host-specific aliases after deployment:

- ChatGPT: `https://<your-render-domain>/mcp/chatgpt`
- Claude: `https://<your-render-domain>/mcp/claude`
- TikTok Reporting and Campaign Review: `https://<your-render-domain>/mcp/reporting`

Both aliases serve the same MCP server, `ReportState` contract, and MCP App UI. They are separate only to make host setup and production logs clearer.

The Claude alias uses stateless Streamable HTTP requests so delayed widget resource reads do not depend on an in-memory session. The ChatGPT and Reporting aliases remain stateful for multi-step UI interactions. The Reporting alias intentionally exposes reporting, decision-demo, and Campaign Review tools without exposing the Hooray workspace.

Note:

- Render gives you a stable HTTPS default domain immediately, which is much more reliable than a temporary tunnel.
- The local `.local/` auth state directory is sufficient for first-pass testing, but production should move OAuth state/tokens into a persistent store.
- A Render deploy restarts the service and can clear `.local/`; complete TikTok OAuth after each deploy until persistent token storage is added.

## Campaign Review QA

Use the Reporting connector URL `https://<your-render-domain>/mcp/reporting`.

Golden prompts:

- `Prepare a Website Conversions Smart+ Campaign review for Education Coaching0315 with a USD 50 dynamic daily budget, Website destination, no catalog, and no special ad category.`
- `Prepare a Lead Generation Smart+ Campaign review for Education Coaching0315 with a USD 60 dynamic daily budget, no catalog, and no special ad category.`
- `Preview an App Promotion Campaign Review UI for Education Coaching0315 using App install and App ID 1234567890123456789. Do not create it.`
- `Prepare a Brand Awareness campaign review.` The Smart+ review tool must not be called; route the request to a manual-campaign workflow.

When OAuth is unavailable, ask for an interaction demo instead of a live review:

- `OAuth is unavailable. Preview an interactive Smart+ Website Conversions Campaign Review for Education Coaching0315. Name it Summer Enrollment, use USD 50 dynamic daily budget, sales destination Website, CBO on, no catalog, and no special ad category. Do not create anything in TikTok.`
- `Show a no-OAuth Campaign Review demo for Lead Generation with USD 80/day, CBO off, no catalog, and no special ad category.`
- `Preview an App Promotion Campaign Review interaction demo using App install, App ID 1234567890123456789, USD 60/day, CBO on, and no special ad category.`

The complete positive, interaction, validation, error, and unsupported-objective prompt matrix is in `docs/campaign-review-demo-golden-prompts.md`.

Only the allowlisted advertiser IDs in `CAMPAIGN_REVIEW_WRITE_ADVERTISER_IDS` can use Confirm. `CAMPAIGN_REVIEW_WRITE_MODE` must be `campaign_only`.

## Reporting preview

Start the MCP service and open `http://localhost:3010/report-preview`. This read-only page uses the exact reporting CSS and JavaScript embedded in the MCP resource.

Example prompts:

- `Show my TikTok Ads report for the last 7 complete days.`
- `Compare campaign performance with the previous period.`
- `Show the ad-level report from 2026-07-01 to 2026-07-07.`

See `docs/reporting-live-demo-setup-zh.md` for the complete ChatGPT, Claude, TikTok OAuth, and API input checklist.

## Legacy widget preview

You can preview the widget shell by serving `web/` locally:

```bash
npm run preview
```

Then open `http://localhost:4173/preview.html`.
