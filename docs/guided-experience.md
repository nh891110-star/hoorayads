# Hooray TikTok Ads Guided Experience

This document defines the product layer that sits on top of TikTok Ads MCP. The goal is not to mirror raw Ads Manager. The goal is to help a real advertiser move from "I want to launch" to "my campaign is live and I know what to watch next" with a calmer, more guided experience.

## Design point of view

- Start with confidence, not configuration.
- Ask for one meaningful decision at a time.
- Keep every step visual and stateful.
- Show blockers early, not late.
- Use TikTok-flavored energy in the UI, but keep the working surface clean and readable.

## MCP-backed experience map

### 1. Account setup

What the advertiser needs:

- confidence that the app is connected to the correct TikTok for Business identity
- a clear advertiser-account owner for the launch
- visibility into identity readiness before creative or campaign writes
- a billing handoff before publish if needed

Current MCP coverage:

- `user_info_get`
- `bc_get`
- `bc_asset_get`
- `advertiser_info_get`
- `identity_get`
- `pixel_list_get`

Gaps:

- no direct payment-readiness API in the observed MCP surface

UX guidance:

- start the flow with authorization and account ownership
- never hide the selected advertiser in a dropdown
- show business center, currency, timezone, and identity count in the account card

Suggested copy:

- "Which ad account should own this launch?"
- "Before we create anything, let's confirm the TikTok account identity this ad can run from."
- "Billing still needs attention in Ads Manager, so I'll stop before publish."

### 2. Product selection

What the advertiser needs:

- a clear promoted-product path
- the right launch shape before creative work starts

Current MCP coverage:

- no arbitrary website scraping support inside TikTok Ads MCP
- GMV Max and TikTok Shop families exist, but require eligibility checks and a different setup path

UX guidance:

- recommend `website conversions` by default for non-Shopify SMB advertisers
- show TikTok Shop / GMV Max as an advanced lane, not the default
- show lead generation as a first-class path for service businesses

Suggested copy:

- "What are we promoting in this launch?"
- "The simplest path is usually a website conversion campaign. We can switch if your business needs a different lane."

### 3. Creative choice

What the advertiser needs:

- a choice between reusing existing content and generating something new
- a safe review step before any render or campaign write

Current MCP coverage:

- `identity_video_get`
- `file_video_suggestcover_get`
- `creative_report_get`

Gaps:

- no built-in storyboard generation
- no built-in net-new video rendering pipeline

UX guidance:

- present three lanes:
  - reuse an existing TikTok post
  - start from approved product images
  - generate a fresh storyboard and preview
- treat storyboard review like an editorial review, not a settings step

Suggested copy:

- "Do you want to reuse a TikTok post, or should I generate a fresh ad concept?"
- "Here are the hooks I'd test first."
- "Approve the idea first; I'll render after that."

### 4. Campaign setup and publish

What the advertiser needs:

- a low-anxiety draft review
- plain-language explanation of what is missing
- explicit control over publish

Current MCP coverage:

- `smart_plus_campaign_create`
- `smart_plus_adgroup_create`
- `smart_plus_adgroup_update`
- `smart_plus_ad_create`
- `smart_plus_adgroup_status_update`

Gaps:

- some paths still need more inputs than a novice advertiser naturally has on hand
- publish should normalize policy, payment, and asset blockers into one clean explanation

UX guidance:

- use Smart+ website draft as the default publish path
- keep advanced settings behind intent, not in the default form
- show campaign ID, ad group ID, and ad ID in the review card when available

Suggested copy:

- "I can create the draft now."
- "The campaign is created, but I still need a usable video asset before the ad can be completed."
- "Review this once, then choose whether to publish."

### 5. Reporting setup

What the advertiser needs:

- follow-through after launch
- a reporting lane that matches their maturity

Current MCP coverage:

- `report_integrated_get`
- `report_task_create`
- `report_task_check`
- `subscription_subscribe_create`
- `creative_report_get`
- `creative_fatigue_get`

Gaps:

- webhook delivery needs a durable callback layer
- recurring ChatGPT digests still need thread-side orchestration

UX guidance:

- default to a weekly ChatGPT digest
- offer async export for agency/operator users
- treat webhooks as advanced and dependency-heavy

Suggested copy:

- "Do you want a lightweight digest here in ChatGPT, or a file export?"
- "For most advertisers, weekly is the right cadence to start."
- "I'll focus the first report on whether delivery is healthy and whether the creative is earning clicks."

## UI system direction

Visual language:

- clean light background
- dark ink panels for structure
- TikTok pink and cyan as action accents
- bold CTA buttons, soft operational cards, visible status pills

Step architecture:

- hero with current phase and next action
- timeline that shows the end-to-end launch map
- operational checklist for the current step
- option cards for meaningful user choices
- capability notes that explain live vs mixed vs gap coverage

## Content design principles

- Prefer direct verbs: `Connect`, `Choose`, `Approve`, `Publish`
- Replace platform jargon with advertiser language
- Reveal complexity only when it becomes actionable
- Always explain blockers in one sentence before offering a next action

## What this means for the app

The app should feel like a guided launch workspace, not a thin UI wrapper around MCP tools. TikTok Ads MCP should handle the account and campaign execution layer wherever possible, while ChatGPT owns the simplification, sequencing, creative guidance, and reporting follow-through.
