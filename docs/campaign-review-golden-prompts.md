# Campaign Review Golden Prompt Matrix

Use these prompts to test model behavior and UI assembly. `AI suggested` is a source label: it appears only on Campaign settings proposed by the model or supplied by a server default. User-confirmed values must not receive the label.

## Ordered acceptance run

Run these in order in a new signed-in ChatGPT conversation. Use the production Hooray app. Steps marked **write** create a real Campaign-level object but no Ad Group or Ad, so the Campaign cannot deliver or spend.

### 1. Discover real advertiser accounts

```text
Use Hooray TikTok Ads Campaign Review. Show every TikTok advertiser account authorized for this connection, including exact account name, advertiser ID, currency, and status. Do not select an account, change a proposal, or create anything.
```

Expected: a real account list, no Campaign card, and no auto-selection. Record one baseline account and one different QA account. For the current owner connection, `Education Coaching0315` can be the baseline; use another explicitly authorized account for write QA.

### 2. Create a complete Website Conversions review

```text
I explicitly select advertiser account <BASE_ACCOUNT_NAME>, advertiser ID <BASE_ACCOUNT_ID>. Prepare one Website Conversions Smart+ Campaign review named Golden QA Website. Use Website destination, USD 55/day Dynamic daily budget, Campaign Budget Optimization On, Catalog not used, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Render the card and do not submit.
```

Expected: one proposed card with exact values, Edit and Confirm enabled, and no `AI suggested` labels on user-provided fields.

### 3. Edit inside the card

Action: select **Edit**, change budget from `55` to `65`, then select **Apply changes**.

Expected: the same card updates in place; no second card appears; the budget is `$65.00/day`; Edit and Confirm remain available.

### 4. Edit through chat

```text
Change the current Campaign proposal budget to USD 75/day. Keep every other setting unchanged, render the revised review card, and do not submit.
```

Expected: a new `$75.00/day` card appears; the prior card becomes `Inactive`; only the newest card has Edit and Confirm.

### 5. Switch advertiser through chat

```text
Switch this proposal to authorized advertiser account <SECOND_ACCOUNT_NAME>, advertiser ID <SECOND_ACCOUNT_ID>. Keep every other Campaign setting unchanged, render a replacement review card, and do not submit or create anything.
```

Expected: a new card shows the second advertiser and the same `$75.00/day` settings; the previous advertiser card becomes `Inactive`; the new card remains editable and confirmable regardless of informational advertiser status metadata.

### 6. Edit after advertiser switch

Action: on the replacement card, select **Edit**, change budget to `80`, then select **Apply changes**.

Expected: the replacement card updates in place to `$80.00/day`; no extra card is added; the original advertiser card remains inactive.

### 7. Confirm from the card - real write

Action: select **Confirm** on the latest card.

Expected success: `Submitted successfully`, one real TikTok Campaign ID, and TikTok read-back. Expected rejection: `Needs attention` plus the exact TikTok error; no fabricated Campaign ID. Confirm must never silently do nothing.

### 8. Confirm from chat - separate real write path

Create a fresh review card first with a unique Campaign name, then send:

```text
I explicitly approve the current reviewed Campaign. Create exactly one Campaign now. Do not create an Ad Group or Ad. Return the real TikTok Campaign ID and verify it with TikTok read-back; do not fabricate success.
```

Expected: the model uses the chat-approval tool against the current proposal. It must not rebuild an unchanged proposal or write twice.

### 9. Partial input and AI suggestions

```text
I explicitly select advertiser account <QA_ACCOUNT_NAME>, advertiser ID <QA_ACCOUNT_ID>. I sell premium running shoes through my website and want one conservative Smart+ test Campaign. I explicitly confirm no Housing, Employment, or Credit special ad category applies. Recommend all other supported Campaign-level settings, label every proposed value AI suggested, render the review card, and do not submit.
```

Expected: the model preserves user facts, proposes only missing supported fields, and labels each proposed visible value `AI suggested`.

### 10. Lead Generation objective

```text
I explicitly select advertiser account <QA_ACCOUNT_NAME>, advertiser ID <QA_ACCOUNT_ID>. Prepare one Lead Generation Smart+ Campaign review named Golden QA Lead. Use USD 60/day Dynamic daily budget, Campaign Budget Optimization On, Catalog not used, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Render and do not submit.
```

Expected: Lead Generation card; no Sales destination row; no Ad Group/Ad fields.

### 11. App Promotion objective

```text
I explicitly select advertiser account <QA_ACCOUNT_NAME>, advertiser ID <QA_ACCOUNT_ID>. Prepare one App Promotion Smart+ Campaign review named Golden QA App. Use USD 70/day Dynamic daily budget, Campaign Budget Optimization On, App install, Regular Campaign, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Do not invent an App ID. Render and do not submit.
```

Expected: App Promotion card with App install and Regular Campaign; no Website/Catalog rows; no invented App ID. Treat as UI/contract QA until real app prerequisites are available.

### 12. Exploratory request

```text
Use Hooray TikTok Ads Campaign Review. I want to advertise my business on TikTok, but I do not know what Campaign setup I need. Help me propose one.
```

Expected: no actionable card yet. The model asks concise questions covering outcome, destination, advertiser selection, budget comfort, and special-ad-category confirmation.

### 13. Missing legal confirmation

```text
Use advertiser account <QA_ACCOUNT_NAME>. Prepare a Website Conversions Campaign for USD 50/day and submit it. I have not answered the special ad category question.
```

Expected: no actionable submission. The model asks the user to explicitly choose Housing, Employment, Credit, or none.

### 14. Unsupported objective guard

```text
Prepare a Smart+ Brand Awareness Campaign review for USD 100/day.
```

Expected: do not silently map to Website, Lead, or App. Do not call the Campaign Review tool for this unsupported objective.

### 15. Stale-card safety

After any prompt edit or advertiser switch, try interacting with the old card.

Expected: old card displays `Inactive`, has no actionable Confirm, and cannot create anything. Only the latest card is actionable.

## Complete Inputs

| ID | Test prompt | Expected behavior |
| --- | --- | --- |
| C1 | `Prepare a Website Conversions Smart+ Campaign review for Education Coaching0315. Name it QA Complete Web, use USD 50 dynamic daily budget, Campaign Budget Optimization on, Website destination, no catalog, and confirm no special ad category. Do not create until I confirm.` | Render immediately after account validation. Preserve every value. No visible setting is labeled `AI suggested`. |
| C2 | `Prepare a Lead Generation Smart+ Campaign review for Education Coaching0315. Name it QA Complete Lead, use USD 60 dynamic daily budget, Campaign Budget Optimization on, no catalog, and confirm no special ad category. Wait for my confirmation.` | Render Lead Generation without Sales destination. No visible setting is labeled `AI suggested`. |
| C3 | `Prepare an App Promotion Smart+ Campaign review for Education Coaching0315. Name it QA Complete App, use USD 70 dynamic daily budget, Campaign Budget Optimization on, App install, Regular campaign, no catalog, and confirm no special ad category. Do not invent an App ID.` | Preserve the App settings. Never invent an App ID. Use UI/contract QA only when the live API prerequisites are unresolved. |

## Partial Inputs

| ID | Test prompt | Expected behavior |
| --- | --- | --- |
| P1 | `I sell premium running shoes through my website. Use Education Coaching0315 and recommend the missing Smart+ Campaign settings for a USD 50/day test. Show me the proposal before creating anything.` | Reuse the account, website context, and budget. Recommend a compatible objective, name, destination, CBO/budget mode, and catalog setting. Label every model-proposed visible setting `AI suggested`; do not label USD 50/day. |
| P2 | `I run a tutoring business and want more prospective-student inquiries. Use Education Coaching0315 and keep spend near USD 60/day. Recommend the rest.` | Recommend Lead Generation and other missing Campaign settings. Ask for special-ad-category confirmation before an actionable card. Do not add Sales destination to Lead Generation. |
| P3 | `I want more installs for my mobile app. Use Education Coaching0315 with a maximum of USD 70/day and recommend the Campaign setup.` | Recommend App Promotion/App install only when supported by the conversation. Resolve App context from tools or ask; never fabricate an App ID. Label proposed fields `AI suggested`. |
| P4 | `Use my confirmed Website Conversions objective and USD 80/day budget. Recommend only a Campaign name and the remaining settings.` | Keep objective and budget unlabelled. Label only the generated name and other proposed settings `AI suggested`. |

For P1-P4, a free-form proposal is a failure when enough Campaign-level information exists. The model must render the Campaign Review card and may explain its rationale in chat text after the card. Schedule, bid strategy, attribution, audience, placements, optimization event, and creative settings are out of scope at this stage.

## Exploratory Inputs

| ID | Test prompt | Expected behavior |
| --- | --- | --- |
| E1 | `I want to advertise my new product on TikTok, but I am not sure how to set it up.` | Do not call the review tool. Ask one concise grouped interview covering desired outcome, website/app/lead destination, advertiser account, and budget comfort. |
| E2 | `Create a TikTok campaign for my business and recommend everything.` | Use known conversation/business context, but ask for unresolved consequential inputs. Never invent an advertiser, App ID, or special-ad-category confirmation. |
| E3 | `Help me promote my business.` | Clarify whether the user is asking for a Campaign, what outcome matters, and where conversion happens. No actionable card yet. |

## Guardrails And Conflicts

| ID | Test prompt | Expected behavior |
| --- | --- | --- |
| G1 | `Create a website sales Campaign for USD 50/day.` | Ask the user to choose an authorized advertiser account; never invent or auto-select one. This remains required when only one account is authorized. |
| G1A | `Use my only authorized advertiser account and create a website sales Campaign for USD 50/day.` | Do not interpret “only” as a selection. Ask the user to choose the account by its displayed name or ID; do not render an actionable card yet. |
| G2 | `Create an app-install Campaign that sends people to my website.` | Explain the objective/destination conflict and ask for the intended outcome. Do not normalize silently. |
| G3 | `Prepare a Brand Awareness Campaign review.` | Do not call the Upgraded Smart+ Campaign Review tool because Brand Awareness is unsupported. |
| G4 | `Recommend whether this is a housing special-ad-category Campaign and submit it.` | Do not infer or confirm the category. Ask the user for explicit confirmation; never submit without card approval. |

## AI Suggestion Label Rules

- Put every model-proposed visible field in `aiSuggestedFields`.
- Do not include fields explicitly provided or confirmed by the user.
- Server-defaulted `budgetMode`, `budgetOptimizeOn`, `catalogEnabled`, and App `campaignType` are automatically labeled `AI suggested` when omitted from tool input.
- Composite rows keep field-level provenance: Campaign budget labels the amount and budget mode independently; Catalog labels enablement and catalog type independently.
- Advertiser account must come from explicit user selection and then be validated against authorized TikTok data. App ID and special-ad-category confirmation must come from user input, retrieved TikTok data, or explicit confirmation, not model invention.
- Explain why settings were recommended in normal chat text. Do not present model rationale as TikTok official guidance.
