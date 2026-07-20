# Hooray TikTok Ads

This service hosts two isolated MCP Apps on the TikTok Ads Flat MCP data surface.

## Endpoints

- Hooray Campaign Review for ChatGPT: `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`
- Hooray Campaign Review for Claude: `https://tiktok-ads-agent-poc.onrender.com/mcp/claude`
- TikTok Ads Reporting and explicit UI demos: `https://tiktok-ads-agent-poc.onrender.com/mcp/reporting`
- Health: `https://tiktok-ads-agent-poc.onrender.com/health`

`/mcp/chatgpt` contains only the live Campaign Review experience. The retired product, storyboard, video-render, Account setup, and full-funnel workspace are not registered.

## Campaign Review

The live flow is:

1. `review_smartplus_campaign` resolves the user's authorized advertiser and prepares an immutable Campaign-level proposal.
2. The user can select Edit. `revise_smartplus_campaign_review` creates a new proposal version and the previous card becomes Inactive.
3. The user explicitly selects Confirm. `create_smartplus_campaign_from_review` creates one Active Upgraded Smart+ Campaign through Flat MCP `smart_plus_campaign_create`.
4. The server reads the Campaign back through `smart_plus_campaign_get` before showing a verified receipt.
5. `get_smartplus_campaign_review_status` reconciles an uncertain outcome without retrying the write.

Before creation, Campaign settings are explicitly proposal values; the advertiser account is resolved from TikTok authorization. After creation, the success card prefers only fields returned by `smart_plus_campaign_get` and marks them `TikTok verified`. Fields omitted by TikTok remain marked `Proposal`. A missing or mismatched Campaign ID, name, objective, or Active status produces an unconfirmed state instead of a success receipt.

Supported objectives:

- `WEB_CONVERSIONS`
- `LEAD_GENERATION`
- `APP_PROMOTION`

The write is Campaign-only. It does not create an Ad Group, Ad, creative, delivery, or spend. Unsupported objectives such as Reach, Video Views, Traffic, and Brand Awareness are rejected instead of being remapped.

Set `CAMPAIGN_REVIEW_WRITE_MODE=campaign_only` in production. There is no advertiser allowlist: each user can create only in an advertiser returned by their own Flat MCP authorization.

## Golden prompts

The suite covers the three BRD starting states: complete input, partial input with model recommendations, and exploratory input that requires a business interview. See [`docs/campaign-review-golden-prompts.md`](docs/campaign-review-golden-prompts.md) for the full matrix.

The exact UI-to-Flat-MCP field, enum, conditional, and omission rules are documented in [`docs/campaign-review-api-field-mapping.md`](docs/campaign-review-api-field-mapping.md). A generic `industry` field is intentionally unsupported and must not be displayed or submitted.

- Complete: `Prepare a Website Conversions Smart+ Campaign review for Education Coaching0315. Name it QA Hooray Web, use USD 50 dynamic daily budget, Campaign Budget Optimization on, Website destination, no catalog, and confirm no special ad category. Show the card and do not create until I confirm.` No visible field should be labeled `AI suggested`.
- Partial: `I sell premium running shoes through my website. Use Education Coaching0315 and recommend the missing Smart+ Campaign settings for a USD 50/day test. Show me the proposal before creating anything.` Every model-proposed visible setting must be labeled `AI suggested`.
- Exploratory: `I want to advertise my new product on TikTok, but I am not sure how to set it up.` The model must ask a concise business interview and must not show an actionable card yet.
- Unsupported: `Prepare a Brand Awareness campaign review.` The Smart+ review tool must not be called.

## Local QA

```bash
pnpm install
pnpm run check
pnpm start
MCP_ENDPOINT=http://localhost:3010/mcp/chatgpt pnpm run qa:campaign-review-mcp
pnpm run qa:campaign-review-contract
pnpm run qa:campaign-review-widget
```

Reporting and demo QA remain isolated on `/mcp/reporting`; see `docs/reporting-live-demo-setup-zh.md`.

## Production configuration

Hooray Campaign Review uses delegated per-user OAuth. Each ChatGPT member connects their own TikTok advertiser account, and ChatGPT sends that member's bearer token to `/mcp/chatgpt`. The Hooray service does not persist those tokens.

Required Render variables for the ChatGPT path are:

- `PUBLIC_BASE_URL=https://tiktok-ads-agent-poc.onrender.com`
- `CAMPAIGN_REVIEW_WRITE_MODE=campaign_only`
- `TIKTOK_FLAT_MCP_URL=https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat`
- `TIKTOK_APP_ID=<approved TikTok app ID>`
- `OAUTH_REGISTRATION_SIGNING_KEY=<dedicated random secret>`

TikTok's live Flat MCP metadata declares a PKCE public client (`token_endpoint_auth_methods_supported: ["none"]`). New ChatGPT connections should use Hooray's restricted Dynamic Client Registration endpoint at `/oauth/register`; ChatGPT receives a signed public client ID bound to its exact callback, while Hooray uses the approved TikTok App ID upstream. OAuth Client Secret remains empty and is never forwarded to TikTok.

The static TikTok App ID client path remains available for existing connectors. DCR rejects localhost, dynamic ports, raw IPs, EC2 dynamic hosts, non-HTTPS callbacks, and redirect URIs not included in the original registration.

Register this exact advertiser redirect URL in the TikTok developer app:

- `https://tiktok-ads-agent-poc.onrender.com/oauth/tiktok/callback`

See [`docs/campaign-review-oauth-setup-zh.md`](docs/campaign-review-oauth-setup-zh.md) for the exact ChatGPT fields and [`docs/campaign-review-brd-qa-matrix.md`](docs/campaign-review-brd-qa-matrix.md) for interaction coverage.
