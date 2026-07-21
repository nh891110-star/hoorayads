# Campaign Review ChatGPT Production QA

**Date:** July 20, 2026  
**Environment:** ChatGPT, Hooray TikTok Ads production connector  
**Endpoint:** `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`  
**Authorized advertiser used when explicitly selected:** `Education Coaching0315`  
**Widget:** Campaign Review `v15` with legacy aliases for cached connector versions

## Result summary

- 13 model-routing and card-assembly scenarios passed in the signed-in ChatGPT environment.
- Natural-language replacement produced a new proposal and made the prior card `Inactive`.
- TypeScript, Campaign contract, and headless widget interaction suites passed.
- The contract now proves that the server does not auto-select an advertiser even when authorization returns exactly one account.
- Widget `v15` prefers ChatGPT's native app-tool API, reconciles every Edit or Confirm action against server-owned state when ChatGPT returns stale tool output, and shows `Submitting…` immediately; the standard MCP Apps bridge remains the cross-host fallback.
- A real TikTok Campaign ID is **not yet verified**. The safe live proposal remained `Proposed campaign`; browser automation did not complete the nested-card Confirm action. Card rendering is not counted as Campaign creation.

## Prompt and behavior matrix

| ID | Test prompt | Test intention | Actual result | Verdict |
| --- | --- | --- | --- | --- |
| WEB-01 | `Use Hooray TikTok Ads Campaign Review. Prepare a Website conversions Campaign for advertiser Education Coaching0315 named QA Matrix Web 2026-07-20 1930. Use Website destination, USD 50/day Dynamic daily budget, CBO On, no catalog, and no special ad category. Render the card and do not submit.` | Complete Web input should render supported Campaign-level fields without a write. | Proposed card showed `$50.00/day`, Website conversions, Website, CBO On, Catalog Not used, and None selected. | PASS |
| REV-01 | `Update the proposed campaign budget from USD 50/day to USD 100/day. Show a new review card and do not submit.` | A conversational change should create a new immutable proposal. | New `$100.00/day` card appeared; prior `$50.00/day` card changed to `Inactive`. | PASS |
| REV-02 | `Reload the conversation and inspect both proposal versions.` | Proposal ownership and inactive state must survive page reload and OAuth token rotation. | Old card remained `Inactive`; new card remained `Proposed campaign`. | PASS |
| EDIT-01 | In the `$100/day` card, choose **Edit**, change budget, then **Apply changes**. | In-card edits should create a replacement proposal without writing to TikTok. | The original live attempt exposed a ChatGPT bridge-state bug. The metadata fallback was implemented, and the automated widget suite now passes `revision` and `mcp_apps_standard_bridge_metadata_fallback`. A fresh signed-in ChatGPT click-through remains to be repeated. | FIXED; LIVE RETEST PENDING |
| WEB-02 | `I sell premium running shoes through my website. Use advertiser Education Coaching0315 and a USD 60/day test budget. I confirm that no special ad category applies. Recommend the missing Smart+ Campaign settings and show me the proposal before creating anything.` | Partial input should preserve user values and identify model-completed values. | Web card rendered at `$60/day`; three model-completed fields were labeled `AI suggested`; no Ad Group fields appeared. | PASS |
| LEAD-01 | `Use Hooray TikTok Ads Campaign Review. Prepare a Lead Generation Campaign for advertiser Education Coaching0315, USD 70/day Dynamic daily budget, CBO On, no catalog, and no special ad category. Render and do not submit.` | Lead Generation should use only supported Campaign fields. | Lead generation card rendered at `$70/day`; Sales destination was omitted; Catalog remained available as a Campaign setting. | PASS |
| APP-01 | `Use Hooray TikTok Ads Campaign Review. Prepare an App Promotion Campaign for advertiser Education Coaching0315, USD 80/day Dynamic daily budget, CBO On, App install, Regular Campaign, and no special ad category. Do not invent an App ID. Render and do not submit.` | Regular App Promotion should omit Web-only fields and never invent an App ID. | App promotion, App install, Regular Campaign, and `$80/day` rendered; Catalog and Sales destination were absent; no App ID was invented. | PASS |
| DISC-01 | `Use Hooray TikTok Ads Campaign Review. I run an education coaching business and want to advertise on TikTok. Propose a campaign for me.` | Insufficient input should trigger discovery rather than an actionable card. | No widget rendered. ChatGPT asked for goal, budget, special-ad-category answer, and advertiser selection. | PASS |
| LEGAL-01 | `Use Hooray TikTok Ads Campaign Review. Prepare a Website conversions Campaign review for advertiser Education Coaching0315 named QA Missing Special Category. Use Website destination, USD 65/day Dynamic daily budget, CBO On, and no catalog. Render the card and do not submit.` | The model must not infer Housing, Employment, Credit, or none. | No card rendered; ChatGPT explicitly asked the user to choose the applicable special ad category. | PASS |
| OBJ-NEG-01 | `Use Hooray TikTok Ads Campaign Review. Prepare a Smart+ Brand Awareness or Reach campaign for advertiser Education Coaching0315 with USD 100/day. I confirm no special ad category applies.` | Unsupported objectives must not be remapped to a supported objective. | No card rendered; ChatGPT stated that the contract supports Website Conversions, Lead Generation, and App Promotion only. | PASS |
| OBJ-NEG-02 | `Use Hooray TikTok Ads Campaign Review. Prepare a Smart+ Traffic campaign for advertiser Education Coaching0315, USD 40/day, no special ad category. Do not submit.` | Traffic is outside the current create contract. | No card rendered and nothing was submitted. | PASS |
| APP-VAL-01 | `Prepare an iOS 14 Dedicated App Promotion Campaign but do not provide an App ID.` | A required App ID must never be invented. | A non-actionable `Review required` state identified the missing App ID; Confirm remained unavailable by contract. | PASS |
| WEB-CATALOG-01 | `Prepare a Website Conversions Campaign for advertiser Education Coaching0315 with a USD 1,200 total budget and E-commerce catalog. No special ad category. Render only.` | Validate total-budget and catalog enums supported by the create contract. | Card showed `$1,200.00 total · Total budget` and `Used · E-commerce catalog`. | PASS |
| ADV-01 | `Use my only authorized advertiser account and prepare a Website conversions Campaign.` | The model/server must not treat “only” as an explicit account selection. | Server returned `Needs attention: Choose one authorized advertiser account`; no proposal or Campaign was created. | PASS |
| ADV-02 | `Use advertiser Education Coaching0315 and prepare a Website conversions Campaign.` | An exact user-selected authorized account name should be accepted. | Account resolved to `Education Coaching0315` and the proposed card displayed its masked advertiser ID. | PASS |
| CREATE-01 | `Use advertiser Education Coaching0315. Campaign name: QA Live Web Create 2026-07-20 2105. Website conversions, Website, USD 30/day Dynamic daily, CBO On, Catalog not used, no special category. Render and wait.` Then select **Confirm**. | Verify the full write, receipt, Campaign ID, and TikTok read-back. | Valid proposed card rendered, but browser automation did not complete the nested-widget Confirm action. Status remained `Proposed campaign`; no Campaign ID was returned. | BLOCKED, NOT A PRODUCT PASS |

## Automated verification

| Suite | Coverage | Result |
| --- | --- | --- |
| TypeScript | Static contract and implementation checks | PASS |
| Campaign contract | Web, Lead, App, objective guards, API field omission, AI provenance, Active-only payload, read-back, stale-card protection, OAuth isolation/rotation, explicit advertiser selection | PASS |
| Widget interaction | Proposed, Edit, Cancel, objective-specific fields, revision, create/receipt, inactive behavior, single actionable card, OAuth error, ChatGPT metadata fallback | PASS |

## Release gates still open

1. Repeat **EDIT-01** in a fresh ChatGPT conversation that loads widget `v15`, and visually confirm the revised values remain visible.
2. Manually select **Confirm** on one safe Campaign-only proposal, then require `Submitted successfully`, a TikTok Campaign ID, and matching `campaign_get` read-back before marking live creation complete.
3. Run the live Confirm/read-back once per supported objective only after the first Web write is verified. App Promotion must use a real user-selected App ID whenever its selected Campaign type requires one.
