# Campaign Review ChatGPT Production QA

**Date:** July 20, 2026  
**Environment:** ChatGPT, Hooray TikTok Ads production connector  
**Endpoint:** `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`  
**Authorized advertiser used when explicitly selected:** `Education Coaching0315`  
**Widget:** Campaign Review `v17` with legacy aliases for cached connector versions

## Result summary

- 13 model-routing and card-assembly scenarios passed in the signed-in ChatGPT environment.
- Natural-language replacement produced a new proposal and made the prior card `Inactive`.
- A signed-in ChatGPT `v17` test changed Campaign budget from `$30/day` to `$45/day` through **Edit** > **Apply changes**. The card immediately displayed `$45/day`, while all unchanged fields remained stable.
- In the same test, **Confirm** immediately displayed `Submitting...`, called the real Campaign creation path, and then surfaced TikTok's official rejection: `Complete payment to continue.` The card correctly displayed `Campaign was not created`; no Campaign ID was fabricated.
- TypeScript, Campaign contract, and headless widget interaction suites passed.
- The contract now proves that the server does not auto-select an advertiser even when authorization returns exactly one account.
- Widget `v17` uses ChatGPT's native write action and reconciles action outcomes through the standard MCP Apps status bridge. A local `creating` lock prevents stale host globals from reverting a submitting card to `Proposed campaign`.
- A real TikTok Campaign ID is **not yet verified** because the authorized advertiser's payment state caused official TikTok API error `40002`. This is now presented as a confirmed rejection, not a silent no-op or unknown outcome.

## Prompt and behavior matrix

| ID | Test prompt | Test intention | Actual result | Verdict |
| --- | --- | --- | --- | --- |
| WEB-01 | `Use Hooray TikTok Ads Campaign Review. Prepare a Website conversions Campaign for advertiser Education Coaching0315 named QA Matrix Web 2026-07-20 1930. Use Website destination, USD 50/day Dynamic daily budget, CBO On, no catalog, and no special ad category. Render the card and do not submit.` | Complete Web input should render supported Campaign-level fields without a write. | Proposed card showed `$50.00/day`, Website conversions, Website, CBO On, Catalog Not used, and None selected. | PASS |
| REV-01 | `Update the proposed campaign budget from USD 50/day to USD 100/day. Show a new review card and do not submit.` | A conversational change should create a new immutable proposal. | New `$100.00/day` card appeared; prior `$50.00/day` card changed to `Inactive`. | PASS |
| REV-02 | `Reload the conversation and inspect both proposal versions.` | Proposal ownership and inactive state must survive page reload and OAuth token rotation. | Old card remained `Inactive`; new card remained `Proposed campaign`. | PASS |
| EDIT-01 | In a `$30/day` card, choose **Edit**, change budget to `$45/day`, then **Apply changes**. | In-card edits should create a replacement proposal without writing to TikTok. | Signed-in ChatGPT `v17` updated the visible card to `$45.00/day · Dynamic daily budget`. Objective, destination, CBO, catalog, and special-category values remained unchanged. | PASS |
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
| CREATE-01 | `Use Hooray TikTok Ads Campaign Review v10. I explicitly select advertiser account Education Coaching0315. Prepare one Website conversions Smart+ Campaign named QA v17 Edit Confirm 2026-07-20. Use Website destination, USD 30/day Dynamic daily budget, Campaign Budget Optimization On, Catalog not used, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Render the live Campaign Review card and wait. Do not use demo data and do not submit yet.` Then change budget to `$45/day` and select **Confirm**. | Verify the real write action, visible submitting state, final status reconciliation, receipt, Campaign ID, and TikTok read-back. | Confirm immediately showed `Submitting...` and `Creating one Active TikTok Campaign...`. TikTok then returned official error `40002: Complete payment to continue.` The card showed `Needs attention` and `Campaign was not created`; the edited `$45/day` value remained visible. No Campaign ID was returned because TikTok rejected creation. | PRODUCT FLOW PASS; ACCOUNT PAYMENT BLOCKED |

## Automated verification

| Suite | Coverage | Result |
| --- | --- | --- |
| TypeScript | Static contract and implementation checks | PASS |
| Campaign contract | Web, Lead, App, objective guards, API field omission, AI provenance, Active-only payload, read-back, stale-card protection, OAuth isolation/rotation, explicit advertiser selection, TikTok business-error classification, ambiguous transport-error classification | PASS |
| Widget interaction | Proposed, Edit, Cancel, objective-specific fields, revision, create/receipt, inactive behavior, single actionable card, OAuth error, stale native submit response, standard MCP status bridge, state-regression protection | PASS |
| Local and remote MCP | Tool discovery, widget resource, review/action/status contracts, legacy widget aliases | PASS |

## Release gates still open

1. Resolve the payment/balance blocker on the explicitly selected advertiser account.
2. Repeat **CREATE-01**, then require `Submitted successfully`, a real TikTok Campaign ID, and matching `campaign_get` read-back before marking live creation complete.
3. Run live Confirm/read-back for Lead Generation and App Promotion only after the Website Conversions write succeeds. App Promotion must use a real user-selected App ID whenever its selected Campaign type requires one.
