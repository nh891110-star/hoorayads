# Campaign Review Demo: Golden Prompts

Use these prompts with the TikTok Reporting connector. Every positive case must call `review_smartplus_campaign_demo`, render the interactive Campaign-level card, and avoid all TikTok write tools.

## Positive objective coverage

| ID | User prompt | Expected card behavior |
|---|---|---|
| WEB-01 | `OAuth is unavailable. Preview an interactive Smart+ Website Conversions Campaign Review for Education Coaching0315. Name it Summer Enrollment, use USD 50 dynamic daily budget, sales destination Website, CBO on, no catalog, and no special ad category. Do not create anything in TikTok.` | Ready proposed card; Website conversions; Website; budget marked user-provided; Demo banner. |
| WEB-02 | `Use the Campaign Review interaction demo for a website-and-app sales campaign. Use a USD 1,200 total budget, e-commerce catalog, CBO on, no special ad category, and suggest a campaign name.` | Website and app destination; total budget; catalog type; only Campaign name marked AI suggested. |
| LEAD-01 | `Show me a no-OAuth Campaign Review demo for Lead Generation. Name it July Lead Capture, use USD 80/day with Daily budget type, CBO off, no catalog, and confirm that no special ad category applies.` | Ready Lead generation card; no Sales destination or App fields. |
| LEAD-02 | `Preview a Lead Generation Smart+ campaign card for a housing advertiser. Use USD 100/day and mark Housing as the special ad category. This is UI testing only.` | Housing displayed; special category confirmed; no TikTok write. |
| LEAD-VAL-01 | `Preview Lead Generation with USD 80 dynamic daily budget and CBO off.` | `Review required`; Confirm disabled because Dynamic Daily Budget requires CBO on. |
| APP-01 | `Preview an App Promotion Campaign Review interaction demo for Education Coaching0315. Use App install, regular campaign, App ID 1234567890123456789, USD 60/day, CBO on, and no special ad category.` | App promotion fields visible; ready to confirm. |
| APP-02 | `Test the Campaign Review UI for an iOS 14 app-retargeting campaign. Use App ID 1234567890123456789, USD 500 total budget, CBO on, and no special ad category.` | App retargeting; iOS 14 Dedicated Campaign; total budget. |

## Interaction and state coverage

| ID | User prompt or action | Expected card behavior |
|---|---|---|
| INT-01 | Start with WEB-01, select `Edit`, change objective to Lead generation, and select `Apply changes`. | New proposal version; new card uses Lead fields; old card resolves to `Inactive`. |
| INT-02 | Select `Cancel` in Edit state. | Return to the same proposal version with no changed values. |
| INT-03 | Select `Confirm` on a ready demo card. | `Submitting...` appears, followed by `Demo · Submitted successfully`; receipt starts with `demo-`; no TikTok object is created. |
| INT-04 | `Show the Website Conversions Campaign Review demo, but simulate a submission error after I confirm. Use USD 50/day, Website, CBO on, no catalog, and no special ad category.` | Confirm transitions through submitting to `Needs attention`; message says no TikTok Campaign was created. |
| INT-05 | `Show the Campaign Review demo but leave the special ad category unconfirmed so I can test validation.` | `Review required`; Confirm disabled. |
| INT-06 | In App Promotion Edit state, choose iOS 14 Dedicated Campaign and remove App ID. | Browser validation or card validation blocks Confirm. |

## Negative objective routing

These prompts must not call the Smart+ Campaign Review demo because the current `smart_plus_campaign_create` contract does not support them.

| ID | User prompt | Expected model behavior |
|---|---|---|
| NEG-01 | `Preview a Reach campaign launch card.` | Explain that Reach requires a manual-campaign workflow; do not remap it. |
| NEG-02 | `Create a Video Views Campaign Review demo.` | Explain unsupported objective; no Smart+ card. |
| NEG-03 | `Show a Brand Awareness or Traffic Campaign Review.` | Route to future/manual campaign support; no Smart+ card. |

## Pass criteria

- The model selects the demo tool without attempting TikTok OAuth whenever the prompt says demo, preview, QA, simulate, sample, or no OAuth.
- Only `WEB_CONVERSIONS`, `LEAD_GENERATION`, and `APP_PROMOTION` render this Smart+ Campaign Review.
- Demo UI and result metadata state that no TikTok API call or mutation occurred.
- Edit creates an immutable proposal version; stale cards cannot submit.
- The card never shows Ad Group, Ad, creative, audience, schedule, delivery, or spend fields as Campaign-level inputs.
