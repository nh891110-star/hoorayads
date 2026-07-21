# Campaign Review ChatGPT End-to-End QA

**Date:** July 21, 2026  
**Environment:** Signed-in ChatGPT production environment  
**Connector:** `Hooray TikTok Ads Campaign Review v10`  
**MCP endpoint:** `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`  
**Explicitly selected advertiser account:** `Education Coaching0315`

## Executive summary

The complete Campaign Review interaction flow is working in the signed-in ChatGPT environment:

- Complete inputs render one review card without `AI suggested` labels.
- Partial inputs render one review card and label only model-proposed values `AI suggested`.
- An edit made inside the card updates that card in place after **Apply changes**; it does not add another card.
- A change requested in chat produces a new card and makes the previous card visibly `Inactive`.
- Approval from the card and approval from chat both reach the real TikTok Campaign-only write path.
- A combined change-and-create request is split into a revised review card followed by a separate approval, preventing an unreviewed write.
- The live advertiser-account discovery tool returns the current user's authorized accounts without selecting one.
- A prompt-driven advertiser switch renders a replacement card for the selected account and makes the prior account's card `Inactive`.
- Advertiser status metadata does not disable Edit or Confirm on the replacement card; TikTok Campaign creation is the authoritative write check.
- Website Conversions and Lead Generation were exercised through the live card flow. App Promotion passed UI and contract QA without inventing an App ID.

TikTok rejected every real creation attempt for this advertiser with official API error `40002: Complete payment to continue.` The UI correctly showed `Needs attention` and `Campaign was not created`. Therefore, the product interaction and write routing pass, but a real Campaign ID and TikTok read-back remain blocked by advertiser billing readiness. No Campaign ID was fabricated.

## BRD acceptance matrix

| ID | Requirement | Test intention | Actual result | Verdict |
| --- | --- | --- | --- | --- |
| CR-01 | Full user inputs | Preserve every user-confirmed Campaign-level value and render before writing. | One Website Conversions card rendered with the exact account, name, objective, destination, `$30.00/day`, Dynamic daily budget, CBO On, Catalog not used, and no special ad category. No visible field had an `AI suggested` label. No write occurred. | PASS |
| CR-02 | Partial inputs and model completion | Allow the model to fill supported missing settings while preserving user facts and making provenance visible. | One Website Conversions card rendered. The proposed name, objective, destination, budget, budget mode, CBO, and Catalog values were labeled `AI suggested`. The user-selected advertiser and explicit special-category answer were not labeled. | PASS |
| CR-03 | In-card edit | Edit an existing proposal in place and apply without adding a second card. | **Edit** changed the objective from Website Conversions to Lead Generation. **Apply changes** kept the iframe count at one and updated the same card. The Website-only Sales destination row was removed. No TikTok write occurred. | PASS |
| CR-04 | Prompt-based edit | Treat a conversational change as a new immutable proposal. | The prompt changed the current proposal back to Website Conversions with Website destination. A new card appeared; the previous card became grey, displayed `Inactive`, and lost Edit/Confirm actions. | PASS |
| CR-05 | Approval with card Confirm | Require explicit human confirmation, invoke the real TikTok write, and transition to a terminal state. | **Confirm** showed a submitting state and reached TikTok. TikTok returned `40002: Complete payment to continue.` The card transitioned to `Needs attention` and stated that the Campaign was not created. No Campaign ID was returned. | FLOW PASS; ACCOUNT BLOCKED |
| CR-06 | Approval with chat prompt | Support an explicit natural-language approval without rebuilding the proposal first. | `Create this current Campaign proposal now.` called the model-facing approval tool and reached the same real TikTok write path. TikTok returned the same payment error. The host rendered a terminal result card and made the prior proposal inactive. No duplicate write or ID occurred. | ROUTING PASS; ACCOUNT BLOCKED |
| CR-07 | Exploratory request | Avoid an actionable card until consequential inputs are known. | No card rendered. ChatGPT asked for goal, destination, advertiser-account selection, budget, and special-ad-category confirmation, then waited. | PASS |
| CR-08 | App Promotion with missing App ID | Validate objective-specific UI/contract behavior without inventing required identifiers. | One App Promotion card rendered for UI/contract review. App install was shown; missing supported settings were labeled `AI suggested`; no App ID was invented; no write occurred. | PASS |
| CR-09 | Combined change and approval | Prevent a write when the proposal has changed since the last review. | `Change ... to USD 40/day and create it now.` rendered a revised `$40/day` card, made the old card inactive, and required a separate approval instead of writing immediately. | PASS |
| CR-10 | Objective-dependent fields | Ensure each objective displays only API-backed Campaign-level fields. | Lead Generation omitted Sales destination. Website Conversions showed Website destination. App Promotion showed App install and Campaign type without Web-only fields. | PASS |
| CR-11 | Single actionable proposal | Ensure only the latest proposal in the conversation can be edited or approved. | After both in-card and chat revisions, only the latest card retained actions; prior cards were visibly inactive. | PASS |
| CR-12 | Successful real creation and read-back | Return a real TikTok Campaign ID and verify it with TikTok data. | TikTok rejected creation before an object was created because advertiser payment setup is incomplete. | BLOCKED BY ACCOUNT |
| CR-13 | Authorized advertiser discovery | Show real accounts available to this OAuth connection without auto-selecting one. | ChatGPT returned five exact TikTok advertiser names and IDs and explicitly stated that no account, proposal, or Campaign was selected or changed. | PASS |
| CR-14 | Prompt-driven advertiser switch | Replace an Education Coaching proposal with a user-selected Little Shop H proposal while preserving Campaign settings. | A new `Little Shop H` card rendered with the same name, objective, destination, budget, CBO, Catalog, and special-category values. The `Education Coaching0315` card became `Inactive` and lost its actions. | PASS |
| CR-15 | Replacement-card actions | Keep the selected replacement card editable and confirmable; do not use advertiser status metadata as a client-side write gate. | P0 regression was identified and fixed: `STATUS_DISABLE` is informational in Campaign Review. Contract and widget QA now require the replacement card to remain ready for Edit/Confirm. TikTok create remains authoritative. | PASS IN CODE; PRODUCTION RECHECK AFTER DEPLOY |

## Exact signed-in ChatGPT prompts

### CR-01: Complete Website Conversions input

```text
Use Hooray TikTok Ads Campaign Review v10. I explicitly select advertiser account Education Coaching0315. Prepare exactly one Website conversions Upgraded Smart+ Campaign named QA Full Input 2026-07-21. Use Website destination, USD 30/day Dynamic daily budget, Campaign Budget Optimization On, Catalog not used, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Render the live Campaign Review card and do not submit.
```

Conversation: `https://chatgpt.com/c/6a5f016a-f2e4-83e8-af04-c8adf514500d`

### CR-02: Partial input with AI suggestions

```text
Use Hooray TikTok Ads Campaign Review v10. I explicitly select advertiser account Education Coaching0315. I sell premium running shoes through my website and want one sensible Smart+ test Campaign. I explicitly confirm no Housing, Employment, or Credit special ad category applies. Recommend all other missing supported Campaign-level settings, including a conservative USD test budget, render the live Campaign Review card, label every value you propose as AI suggested, and do not submit.
```

Conversation: `https://chatgpt.com/c/6a5f0214-861c-83e8-a90d-54c41d1cc90b`

### CR-04: Prompt-based proposal update

```text
Change the current Campaign proposal to Website conversions with Website destination. Keep the existing advertiser, name, USD 30/day dynamic daily budget, CBO On, Catalog not used, and no special ad category. Render a new Campaign Review card and do not create or submit it.
```

This was run in the CR-02 conversation after the in-card objective edit.

### CR-06: Chat approval

```text
Create this current Campaign proposal now.
```

Conversations used for approval routing:

- `https://chatgpt.com/c/6a5f1186-8274-83e8-beb1-09ffb90a5902`
- `https://chatgpt.com/c/6a5f1965-1488-83e8-ace0-a0c6420b4317`

### CR-07: Exploratory request

```text
Use Hooray TikTok Ads Campaign Review v10. Help me create a TikTok Campaign for my business.
```

Conversation: `https://chatgpt.com/c/6a5f1a2e-a018-83e8-b3a9-a097ac224289`

### CR-08: App Promotion UI and contract review

```text
Use Hooray TikTok Ads Campaign Review v10. I explicitly select advertiser account Education Coaching0315. I run an iOS education app and want one Smart+ App Promotion test Campaign for app installs. I explicitly confirm no Housing, Employment, or Credit special ad category applies. I do not have the TikTok App ID available yet. Recommend the missing supported Campaign-level settings, including a conservative USD budget and Campaign type, label every proposed field AI suggested, render the live Campaign Review card for UI and contract review, and do not submit.
```

Conversation: `https://chatgpt.com/c/6a5f1a7f-4ba4-83e8-b88a-493b96d4167a`

### CR-09: Change-and-create guard

```text
Change this current proposal's budget from USD 30/day to USD 40/day and create it now.
```

This was run in the App Promotion conversation. ChatGPT rendered the revised proposal but did not write without a separate approval.

### CR-13: List authorized advertisers

```text
Use Hooray TikTok Ads Campaign Review v10. Show all TikTok advertiser accounts authorized for this connection, including each exact account name and advertiser ID. Do not select an account, do not change any proposal, and do not create anything.
```

### CR-14: Switch advertiser by prompt

Baseline card:

```text
Use Hooray TikTok Ads Campaign Review v10. I explicitly select advertiser account Education Coaching0315, advertiser ID 7481826080479870993. Prepare a proposed Smart+ Website Conversions campaign review card only; do not submit it. Campaign name: Account Switch QA Baseline. Daily budget: USD 55. Use Website as the sales destination, campaign budget optimization on, no catalog, and no special ad category.
```

Switch request:

```text
Switch this proposal to the authorized advertiser account Little Shop H, advertiser ID 7636300171701239824. Keep every other campaign setting unchanged, render a replacement review card, mark the previous review card inactive, and do not submit or create anything.
```

Conversation: `https://chatgpt.com/c/6a5f222e-7c10-83e8-b647-117c4b2d9f25`

## Data and write integrity

- The card contains Campaign-level fields accepted by the current Upgraded Smart+ Campaign contract. It does not display or send audience, schedule, bid, placement, attribution, Ad Group, Ad, or creative fields.
- The advertiser account is accepted only after explicit user selection and authorization validation. The server does not auto-select the only authorized account.
- Advertiser status returned by the account-info endpoint is displayed/retained as metadata but does not disable Campaign Review actions. A real write is attempted only after explicit confirmation, and TikTok's create response is authoritative.
- Special ad category must be explicitly confirmed by the user. The model does not infer it.
- The Campaign create payload uses `operation_status=ENABLE`; the card does not expose a separate status-after-creation field.
- Objective-specific fields are omitted rather than filled with invented placeholders.
- App ID is never invented. App Promotion remains non-writable when the selected Campaign type requires missing app data.
- Card Confirm is app-only. Natural-language approval uses `approve_smartplus_campaign_review_from_chat`, a separate model-facing tool that reuses the same current-proposal and idempotency checks.
- Creation performs TikTok read-back before presenting a successful receipt. A Campaign ID is shown only when TikTok returns and verifies it.

## Automated verification

| Suite | Coverage | Result |
| --- | --- | --- |
| TypeScript | Static type and implementation checks | PASS |
| Campaign contract | Web, Lead, App, API enum/field omission, AI provenance, explicit advertiser selection, Active Campaign-only payload, read-back, idempotency, auth isolation, error classification | PASS |
| Widget interaction | Proposed, Edit, Cancel, Apply in place, objective-specific fields, revision, inactive state, single actionable card, Confirm, receipt/error, host remount and reload recovery | PASS |
| Local MCP | Tool discovery, UI resource, review/action/status contracts, approval-follow-up routing | PASS |
| Production MCP | Production endpoint exposes the same reviewed tool and resource contracts | PASS |

Commands:

```bash
node node_modules/typescript/bin/tsc --noEmit
node --import tsx scripts/qa-campaign-review-contract.mjs
node scripts/qa-campaign-review-widget.mjs
node scripts/qa-campaign-review-mcp.mjs
MCP_ENDPOINT=https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt node scripts/qa-campaign-review-mcp.mjs
```

## Known host behavior

For approval entered as a chat prompt, ChatGPT may render a new terminal result viewport and mark the prior proposal card inactive, even though the approval tool itself has no UI resource. This is ChatGPT host orchestration behavior. It does not cause a duplicate TikTok write, and only the latest terminal state remains current. Card-button approval continues within the existing interactive card.

## Remaining release gate

1. Complete the payment/billing setup for `Education Coaching0315`, or explicitly select another authorized advertiser account that is ready to create Campaigns.
2. Repeat both approval paths: card **Confirm** and the separate chat approval prompt.
3. Require `Submitted successfully`, one real TikTok Campaign ID, and matching TikTok Campaign read-back.
4. Confirm retry/idempotency behavior using that successful Campaign ID.
5. Only after Website Conversions succeeds, repeat live creation for Lead Generation. Test App Promotion live only with a real user-selected App ID when the chosen Campaign type requires it.
