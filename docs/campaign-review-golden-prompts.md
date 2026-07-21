# Campaign Review Golden Prompt Matrix

Use these prompts to test model behavior and UI assembly. `AI suggested` is a source label: it appears only on Campaign settings proposed by the model or supplied by a server default. User-confirmed values must not receive the label.

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
