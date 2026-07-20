# Campaign Review BRD QA Matrix

## Current scope

Exactly one Upgraded Smart+ Campaign is reviewed and created. The flow is Campaign-level only and does not create an Ad Group, Ad, creative, delivery, or spend.

| BRD behavior | Expected result | Automated coverage | Status |
|---|---|---|---|
| Complete request | Preserve user-confirmed values and render the review card | Tool-description and contract assertions | Pass |
| Partial request | Preserve confirmed values; label only model-filled visible fields `AI suggested` | Contract and widget provenance assertions | Pass |
| Exploratory request | Ask a short business interview; do not render an actionable card yet | Tool-description MCP assertion | Pass; model golden-prompt QA still required |
| Advertiser account | Resolve only from the user's delegated TikTok authorization | MCP auth gate and account resolver | Pass locally; production OAuth required |
| Special ad category | Require explicit user confirmation, including `none` | Schema and contract tests | Pass |
| Objective support | Accept Website Conversions, Lead Generation, and App Promotion only | Contract, MCP schema, and widget tests | Pass |
| Campaign-only fields | Omit schedule, audience, bid, attribution, placement, creative, and generic industry | Payload and widget tests | Pass |
| Edit | Open an editable current proposal without writing to TikTok | Browser test | Pass |
| Cancel edit | Discard local changes and make no tool call | Browser test | Pass |
| Apply changes | Create a new immutable proposal version | Store and browser tests | Pass |
| Old card after update | Keep it in chat history, grey the whole card, show `Inactive`, remove Edit/Confirm | Two-page chat-history browser test | Pass |
| Unsaved edit conflict | Do not merge silently; exit edit and explain that a newer proposal is current | Browser polling/conflict test | Pass |
| Single actionable card | Only the latest proposal remains actionable | Store, MCP demo, and browser tests | Pass |
| Explicit Confirm | No Campaign write before card confirmation | Tool routing and destructive annotation tests | Pass |
| Double Confirm | Reuse in-flight/completed operation; never create twice | State-machine demo test | Pass |
| Timeout/unknown outcome | Lock writes, reconcile status, never retry blindly | State-machine demo test | Pass |
| Auth error | Preserve advertiser name, Campaign inputs, and special-category confirmation | MCP test | Pass |
| Successful creation | Create `operation_status=ENABLE`, then read Campaign back | Contract test | Pass with mocked Flat MCP; production OAuth required |
| Verified receipt | Mark only read-back fields `TikTok verified`; mismatch blocks success | Contract and widget tests | Pass |
| No Ad Group/Ad delivery claim | Explain that delivery starts only after Ad Group and Ad are added | Resource-content assertion | Pass |

## Required production acceptance

These checks cannot be claimed complete until OAuth is connected to a real authorized advertiser:

1. Connect two different workspace users and confirm advertiser-account isolation.
2. Create one Website Conversions Campaign and verify its Campaign ID in TikTok Ads Manager.
3. Create one Lead Generation Campaign and verify its Campaign ID and objective read-back.
4. Create one App Promotion Campaign only when a valid App ID is available; otherwise keep this to UI/contract QA.
5. Confirm a repeated click or retried ChatGPT turn does not produce a second Campaign ID.
6. Change a proposal through chat or Edit, confirm the old card becomes Inactive, and create only the latest version.
7. Revoke TikTok authorization and confirm the card asks the user to reconnect the advertiser account while preserving inputs.
