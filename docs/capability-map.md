# TikTok Ads MCP Capability Map

This POC now follows the original `"[PRD] TikTok <—> ChatGPT App"` flow instead of a Shopify-only path.

The key split is:

- `creative-first user experience`
- `TikTok Ads MCP-backed account and campaign execution`
- `new orchestration needed for scrape, render, auth callback, and approval state`

## 1. Product scraping and intake

Productized app tools:

- `scrape_product`
- `update_product_images`

What they should do:

- load a product page
- extract title, description, price, and 1-3 usable images
- let the user replace bad reference images before creative generation

Current TikTok Ads MCP coverage:

- none

Gap:

- scraping and image validation are outside the current TikTok Ads MCP surface

## 2. Storyboard and video generation

Productized app tools:

- `generate_storyboard`
- `approve_ad_inputs`
- `generate_video`
- `get_video_status`

What they should do:

- generate a 2-scene TikTok storyboard
- capture explicit approval of product data, images, and storyboard
- start an async render
- return watermarked preview assets

Current TikTok Ads MCP coverage:

- none directly

Gap:

- rendering needs a separate media pipeline
- watermarking and job polling need a background orchestration layer

## 3. Account selection and identity readiness

Productized app tools:

- `get_ad_accounts`
- `verify_or_connect_tiktok_identity`
- `verify_payment_method`

Current MCP calls that map well:

- `user_info_get`
- `bc_get`
- `advertiser_info_get`
- `identity_get`

Current MCP gaps:

- no single ready-made `get_ad_accounts` tool
- no direct payment verification tool in the observed surface
- no complete identity connect callback flow in the MCP itself

## 4. Draft creation

Productized app tool:

- `create_smartplus_campaign`

Current MCP calls that matter:

- `smart_plus_campaign_create`
- `smart_plus_adgroup_get`
- `smart_plus_adgroup_update`
- `smart_plus_ad_create`
- `adgroup_review_info_get`
- `adgroup_quota_get`

Gap:

- we still need a safe draft layer that sequences upload, campaign creation, ad group creation, and ad creation with rollback-aware handling

## 5. Publish

Productized app tools:

- `approve_campaign_parameters`
- `publish_campaign`

Current MCP calls that matter:

- `ad_status_update`
- `smart_plus_adgroup_status_update`
- `report_integrated_get`

Gap:

- publish should normalize policy review, payment blockers, and TTAM handoff into one clean user-facing state

## 6. What we can already demo now

Without waiting for production permissions, this scaffold can already demo:

- the exact ChatGPT-side flow shape from the original PRD
- scrape review checkpoint
- storyboard review checkpoint
- async render status pattern
- account and identity selection step
- Smart+ draft review card
- post-publish success state

## 7. What still needs real permissions

For a true production-grade app, we still need:

- TikTok developer app and production OAuth where required
- a public HTTPS MCP endpoint
- ChatGPT connector creation and testing
- OpenAI app submission materials and review
- persistent session storage for callback and resume
- a render provider plus watermarked preview hosting
