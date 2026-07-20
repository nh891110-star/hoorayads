# Campaign Review Objective QA - One Pager

**Date:** July 19, 2026  
**Environment:** ChatGPT Work, Hooray TikTok Ads production plugin, Campaign Review widget `v7`  
**Endpoint:** `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`  
**Test account label:** Education Coaching0315  
**Write boundary:** No test selected **Confirm**. The advertiser OAuth gate is still active, so this run validates model routing, tool invocation, card assembly, field provenance, and safety behavior, not a live TikTok Campaign creation.

## Scope and verdict

The current Upgraded Smart+ Campaign Create MCP contract supports exactly three objectives: `WEB_CONVERSIONS`, `LEAD_GENERATION`, and `APP_PROMOTION`. This matches TikTok's Upgraded Smart+ product scope for Sales, Lead Generation, and App Promotion. Smart+ Traffic exists as a separate public product capability, but it is not part of the current Campaign Review tool contract and is therefore tested as unsupported.

**Overall:** 7 of 9 ChatGPT scenarios passed. All supported-objective card scenarios passed: **6 of 6** across complete and partial inputs. Two failures are model-orchestration issues before write execution, not Campaign API payload failures.

| ID | Objective / mode | Full test prompt | Expected | Actual | Result |
|---|---|---|---|---|---|
| WEB-COMPLETE | Web / complete | `Prepare a Website Conversions Smart+ Campaign review for Education Coaching0315. Name it QA Web Complete v7, use USD 50 dynamic daily budget, Campaign Budget Optimization on, Website destination, no catalog, and confirm no special ad category. Show the card and do not create until I confirm.` | Render Web card; preserve all values; no AI labels; no write. | Correct `v7` card, `$50/day`, Website, CBO On, no catalog, no special category; OAuth gate; no write. [Chat](https://chatgpt.com/c/6a5dbe1b-0a34-83e8-97c4-d5c6bf7c2cc2) | PASS |
| LEAD-COMPLETE | Lead / complete | `Prepare a Lead Generation Smart+ Campaign review for Education Coaching0315. Name it QA Lead Complete v7, use USD 60 dynamic daily budget, Campaign Budget Optimization on, no catalog, and confirm no special ad category. Show the card and do not create until I confirm.` | Render Lead card; omit Sales destination; no AI labels. | Correct Lead card and `$60/day`; Sales destination absent; OAuth gate; no write. [Chat](https://chatgpt.com/c/6a5dbe8f-389c-83e8-b496-3e2935e57343) | PASS |
| APP-COMPLETE | App / complete | `Prepare an App Promotion Smart+ Campaign review for Education Coaching0315. Name it QA App Complete v7, use USD 70 dynamic daily budget, Campaign Budget Optimization on, App install, App ID 1234567890123456789, Regular Campaign, no catalog, and confirm no special ad category. Show the card and do not create until I confirm.` | Render App card with App type, App ID, Campaign type; no AI labels. | Correct App card, App install, App ID, Regular Campaign, `$70/day`; OAuth gate; no write. Rendering took about 50 seconds. [Chat](https://chatgpt.com/c/6a5dbec1-28a4-83e8-8f8f-b36473d650cf) | PASS |
| WEB-PARTIAL | Web / partial | `I sell premium running shoes through my website. Use Education Coaching0315 and a USD 50/day test budget. I confirm that no special ad category applies. Recommend the missing Smart+ Campaign settings and show me the proposal before creating anything.` | Infer Web; preserve budget; label only proposed fields; exclude Ad Group settings. | Correct Web card and field-level `AI suggested` labels; no out-of-scope fields; OAuth gate. [Chat](https://chatgpt.com/c/6a5dbf26-94dc-83e8-8acb-cc78827db831) | PASS |
| LEAD-PARTIAL | Lead / partial | `I run an online tutoring business and want more prospective-student inquiries. Use Education Coaching0315 and keep the test near USD 60/day. I confirm no special ad category applies. Recommend the remaining Smart+ Campaign settings and show the review card before creating anything.` | Infer Lead; omit Sales destination; label proposed fields. | Correct Lead card, `$60/day`, AI labels, and no Sales destination or Ad Group fields. [Chat](https://chatgpt.com/c/6a5dbf60-7c9c-83e8-be47-87b1f411adc3) | PASS |
| APP-PARTIAL | App / partial | `I want more installs for my mobile app. Use Education Coaching0315, App ID 1234567890123456789, and a maximum test budget of USD 70/day. I confirm no special ad category applies. Recommend the remaining Smart+ Campaign settings and show the review card before creating anything.` | Infer App Promotion and App install; preserve App ID and budget; label proposed fields. | Correct App card and AI labels; user App ID and budget preserved; no Ad Group fields. [Chat](https://chatgpt.com/c/6a5dbf9c-cf94-83e8-a724-98ec67899400) | PASS |
| EXPLORATORY | Cross-objective discovery | `I want to advertise my new product on TikTok, but I am not sure how to set it up. Help me propose a campaign.` | Do not render a card; ask concise questions about outcome, destination, advertiser account, and budget. | No Hooray card, but ChatGPT routed to the expired **TT Progressive App** connection instead of completing Hooray discovery. [Chat](https://chatgpt.com/c/6a5dbfe3-23b8-83e8-b316-0cc4647c231e) | FAIL |
| MISSING-SPECIAL | Web / guardrail | `Prepare a Website Conversions Smart+ Campaign review for Education Coaching0315. Name it QA Missing Special Category, use USD 55 dynamic daily budget, Campaign Budget Optimization on, Website destination, and no catalog. Show the review before creating anything.` | Ask for Special ad category confirmation before rendering an actionable card. | Rendered a blocked card with `Special ad category: Not confirmed`, then explained the blocker. No write occurred, but the card appeared before sufficient information. [Chat](https://chatgpt.com/c/6a5dc03f-9070-83e8-9f1a-93e8e88fee8e) | FAIL |
| TRAFFIC-NEGATIVE | Unsupported objective | `Prepare a Smart+ Traffic Campaign review for Education Coaching0315 with a USD 40/day budget. Optimize for landing page views and show the campaign card before creating anything.` | Do not remap Traffic to Web Conversions; do not render or write. | Correctly explained that the connected review tool supports only Web, Lead, and App; no card and no write. [Chat](https://chatgpt.com/c/6a5dc083-2c74-83e8-8435-0140c24d45d0) | PASS |

## What is working

- The model selected the correct objective and objective-specific card fields for all six supported scenarios.
- User-confirmed values were preserved; model-completed fields used the green `AI suggested` source label.
- Campaign cards did not introduce Ad Group-level schedule, bid, attribution, audience, placement, optimization event, or creative settings.
- `Status after creation` is absent and the new Campaign-only delivery disclosure is present.
- The advertiser connection gate prevented all writes in this run.

## What needs improvement

1. **Exploratory routing:** Keep broad creation requests inside Hooray. The host model selected another TikTok plugin before the Hooray discovery interview could finish. A dedicated entry action or stronger plugin/tool routing is needed; description-only routing is not deterministic.
2. **Pre-card completeness:** Enforce `specialIndustriesConfirmed=true` before returning a card, rather than relying only on model instructions. The server should return a clarification result or the input schema should make explicit confirmation mandatory.
3. **Latency:** App Promotion complete-input rendering took roughly 50 seconds. Capture tool-call timing in the next QA round and set a target, such as card visible within 20 seconds.
4. **Live creation remains unverified:** After OAuth is restored, rerun one safe test per objective through Confirm, then verify the returned Campaign ID with TikTok Campaign read-back. Do not treat the current OAuth-gated cards as proof of successful TikTok creation.

## Supporting checks and sources

- Automated TypeScript, Campaign contract, widget interaction, and production MCP resource checks passed for `v7`.
- TikTok Upgraded Smart+ scope: [Smart+ Upgraded Experience](https://ads.tiktok.com/help/article/about-updates-to-smart-plus?lang=sl-SI).
- App objective detail: [About Smart+ App Campaigns](https://ads.tiktok.com/help/article/about-smart-plus-app-campaigns?lang=en).
- Separate Traffic capability: [Smart+ Traffic Campaigns](https://ads.tiktok.com/help/article/about-smart-plus-traffic-campaigns).
