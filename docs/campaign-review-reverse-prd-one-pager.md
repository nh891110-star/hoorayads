# Campaign Review Reverse PRD

## 1. Product definition

**User job:** Review and explicitly approve exactly one TikTok Upgraded Smart+ Campaign before it is created.

**Scope:** Campaign level only. A successful confirmation creates one Active Campaign. It does not create an Ad Group, Ad, creative, delivery, or spend.

**Supported objectives:**

- `WEB_CONVERSIONS`
- `LEAD_GENERATION`
- `APP_PROMOTION`

**Out of scope:** Reach, Traffic, Video Views, Brand Awareness, audience, schedule, bid, placement, attribution, optimization event, Ad Group, Ad, and creative settings.

## 2. End-to-end user flow

1. **Discover advertiser accounts:** When the user asks what is connected, the model returns the real authorized advertiser list and waits. It never selects an account automatically.
2. **Explore:** If the request lacks consequential information, the model asks a short business-language interview. No actionable card is rendered.
3. **Propose:** When enough Campaign-level information exists and the user has explicitly selected an advertiser, the model calls `review_smartplus_campaign`. User-confirmed values are preserved; model-proposed values are labeled `AI suggested`.
4. **Review:** The user reviews one deterministic Campaign card. Nothing has been created yet.
5. **Edit:** Card edits update the current card in place. Chat edits create a new card and make the old card `Inactive`.
6. **Switch advertiser:** A chat request to use another authorized advertiser creates a replacement card with the new advertiser and unchanged Campaign settings. The old card becomes `Inactive`; the replacement remains editable and confirmable.
7. **Approve:** The user either selects **Confirm** or gives an unambiguous later chat instruction to create the current proposal.
8. **Create and verify:** The server revalidates authorization and proposal version, creates one Active Campaign with an idempotent request ID, and calls TikTok read-back.
9. **Receipt or recovery:** Only verified creation shows a Campaign ID. Confirmed API rejection shows `Needs attention`; ambiguous transport outcomes are locked for reconciliation and are not retried blindly.

### Advertiser-switch acceptance contract

| Event | Required product behavior |
| --- | --- |
| User asks which accounts are available | Call the read-only account-list tool. Show exact account names and IDs. Do not select, revise, or create. |
| User explicitly selects another authorized account | Call `review_smartplus_campaign` with the selected advertiser and the complete current Campaign settings. Do not use the in-card revise action to change advertiser. |
| Replacement card renders | Show the selected advertiser, preserve all other reviewed settings, and keep **Edit** and **Confirm** available. |
| Prior card reconciles | Display `Inactive`, remove Edit/Confirm, and reject any stale write request. |
| Account metadata reports a non-enabled status | Treat it as informational in Campaign Review. Do not pre-disable Edit or Confirm. TikTok's create response is the authoritative permission/readiness result. |
| User edits the replacement card | Apply changes to that card in place; do not create another card. |
| User edits through chat after the switch | Render another replacement card and make the previous card `Inactive`. |
| User confirms | Revalidate that the advertiser is still authorized, submit exactly one Campaign, and show only a TikTok-verified ID as success. |

## 3. MCP tools

### Production tools

| Tool | Visibility | Purpose and routing description | Input | Output |
| --- | --- | --- | --- | --- |
| `list_authorized_tiktok_advertiser_accounts` | Model only | Read-only discovery for “which accounts are connected?” and account-switch requests that do not name an exact account. Returns real authorized accounts and waits for explicit user selection. | No input fields. Uses the current user's delegated TikTok authorization. | Account count plus account name, full advertiser ID, country, currency, status, and timezone. No widget. |
| `review_smartplus_campaign` | Model + app | Required for an initial create, propose, recommend, or review request once enough information exists. Handles complete, partial, and exploratory starting states. Enforces explicit advertiser selection, explicit special-category confirmation, Campaign-only scope, and `AI suggested` provenance. Never writes to TikTok. | Campaign review fields listed in Section 5. | `campaignReviewState` plus widget resource `ui://widget/tiktok-smartplus-campaign-review-v19.html`. |
| `revise_smartplus_campaign_review` | App only | Applies in-card edits as a new immutable proposal version. Never creates or updates a TikTok object. | `proposalId`, `expectedVersion`, and the complete revised Campaign field set. | Updated `campaignReviewState`; existing card reconciles in place. |
| `get_smartplus_campaign_review_status` | App only | Polls current state, marks stale cards `Inactive`, and reconciles uncertain submission outcomes. Never retries creation. | `proposalId`, `expectedVersion`. | Current `campaignReviewState`. |
| `create_smartplus_campaign_from_review` | App only | Destructive action used only by the card's **Confirm** button. Creates exactly one Active Campaign, rechecks authorization, applies idempotency, then reads it back. | `proposalId`, `expectedVersion`, `confirmed: true`. | `campaignReviewState` containing created, error, or outcome-unknown execution state. |
| `approve_smartplus_campaign_review_from_chat` | Model only | Destructive approval for an unambiguous later chat instruction such as “create this current campaign now.” A turn that also changes a setting must render a revised proposal and wait for separate approval. | `proposalId`, `expectedVersion`, `confirmed: true`. | Plain text status only; no UI template or structured widget output. The current card polls server state. |

### Upstream TikTok tools used

| Tool | Use |
| --- | --- |
| `smart_plus_campaign_create` | Creates the approved Campaign-only payload. |
| `smart_plus_campaign_get` | Reads the created Campaign back and verifies ID, name, objective, Active status, and any returned settings. |
| Advertiser account discovery/info tools | Validate that the user's explicitly selected account is authorized and supplies currency/country/timezone/status metadata. Advertiser status is informational in Campaign Review; TikTok Campaign creation remains the authoritative write check. |

### Demo tools

The reporting endpoint also exposes `review_smartplus_campaign_demo` and app-only demo revise/status/submit tools. They are used only when a user explicitly requests a preview, demo, QA, or simulation. They never call TikTok or create an object. The Hooray production Campaign Review endpoint does not advertise demo tools.

## 4. Output state contract

`campaignReviewState` includes:

- `proposalId`, `version`, `supersedesProposalId`
- `status`: proposed, outdated, creating, checking, created, error, or outcome unknown
- `readyToCreate`, `isCurrentVersion`, `validationErrors`
- Authorized account metadata and masked advertiser ID
- Normalized Campaign fields and field-level `aiSuggestedFields`
- Action-tool names for revise, status, and submit
- Execution result: Campaign ID, timestamps, official status, error code/message, and verified TikTok read-back fields when available

Only TikTok-verified success may display `Submitted successfully` and a real Campaign ID.

## 5. Field contract and default policy

### A. Required before an actionable review

| Product field | API mapping | Policy |
| --- | --- | --- |
| Advertiser account | `advertiser_id` | Must come from explicit user selection and pass authorization validation. Never auto-select, even if only one account is available. The user may provide exact account name or ID. |
| Campaign name | `campaign_name` | Required. The model may propose a concise name only when the user asks it to recommend missing settings; then label it `AI suggested`. |
| Campaign objective | `objective_type` | Required and limited to the three supported enums. The model may recommend it from a clear user outcome, but must label it `AI suggested`. Do not silently remap unsupported objectives. |
| Special ad category confirmation | `special_industries` when non-empty | Product-required legal confirmation. User must explicitly choose Housing, Employment, Credit, or none. The model must never infer or default the confirmation. |

The server also always supplies `request_id` for idempotency and `operation_status=ENABLE`; neither is a user-editable card field.

### B. Conditionally required

| Field | Allowed values | Required when | Default policy |
| --- | --- | --- | --- |
| Campaign budget | Positive number | Budget mode is Dynamic daily, Total, or Daily. | Do not silently default money. Use a user amount or an explicitly model-proposed conservative test amount, show it in the card, and label it `AI suggested`. |
| Budget mode | Dynamic daily, Total, Unlimited, Daily | Always normalized before create. | If omitted: Dynamic daily when CBO is On; Unlimited when CBO is Off. Label the default `AI suggested`. |
| Campaign Budget Optimization | On or Off | Always normalized before create. | Defaults to On and is labeled `AI suggested` when omitted. |
| Sales destination | Website, App, Web and App | Website Conversions. | Do not assume when destination is ambiguous. For a clearly stated website/app outcome, the model may propose and label it `AI suggested`. Omit for Lead Generation and App Promotion. |
| Catalog enabled | Boolean | Applicable to Website Conversions and Lead Generation in this experience. | Defaults to Off and is labeled `AI suggested` when omitted. Omit from App Promotion. |
| Catalog type | E-commerce, Travel and entertainment, Mini series | Catalog is enabled; currently strictly required for Website Conversions. | Never guess. Retrieve from connected business data or ask the user. Omit when Catalog is Off. |
| App promotion type | App install, App retargeting, Minis | App Promotion. | Recommend only when the user intent is clear; otherwise ask. Label model selection `AI suggested`. |
| App ID | TikTok App ID string | Required for iOS 14 Dedicated Campaign; may also be needed by downstream app setup. | Never invent. Retrieve from authorized TikTok data or require user selection. |
| Campaign type | Regular Campaign, iOS 14 Campaign | App Promotion. | Defaults to Regular Campaign and is labeled `AI suggested` when omitted. iOS 14 requires a real App ID. |

### C. Optional values with safe omission

- `specialIndustries` is omitted from the TikTok payload when the user explicitly confirms none.
- `budget` is omitted only for Unlimited budget mode.
- `catalogType` is omitted when Catalog is Off.
- App fields are omitted for non-App objectives.
- Objective-incompatible fields are removed during validation rather than forwarded as placeholders.

### D. Fields intentionally not collected at Campaign level

Schedule, audience, location, age, bid strategy, bid amount, placement, optimization event, attribution, pixel/event configuration, identity, product URL, Ad Group budget, Ad text, CTA, video, and creative data must not be defaulted into this card or sent to Campaign create. They belong to later Ad Group/Ad steps and should be collected only when those experiences are designed.

## 6. Recommendation and provenance policy

- The model can recommend only values present in the tool schema and supported by user intent or retrieved business context.
- Every model-proposed visible field must be included in `aiSuggestedFields`.
- User-provided or user-confirmed fields must not be labeled `AI suggested`.
- System defaults are also suggestions and are automatically labeled.
- Recommendation rationale appears as normal model text outside the card, not as TikTok official guidance.
- Legal confirmations, advertiser selection, App ID, and catalog identity are never model-invented.

## 7. Skill and control architecture

**No product runtime Skill is required.** The implementation does not depend on a ChatGPT or Claude Skill to force a structured answer.

The control layers are:

1. **MCP server instructions:** High-level routing for complete, partial, exploratory, edit, and approval intents.
2. **Tool descriptions:** Tell the model when each tool is eligible and when it must not be called.
3. **JSON/Zod schemas:** Constrain accepted fields and enums.
4. **Server validation and state machine:** Enforce conditional requirements, proposal versioning, inactive cards, authorization, idempotency, write guards, and error states.
5. **Deterministic HTML/CSS/JS widget:** Renders only structured server state and owns in-card interactions.
6. **TikTok read-back:** Prevents an unverified or fabricated success receipt.

The model may still choose tools probabilistically, so critical safety cannot rely only on descriptions. All destructive and legal boundaries are repeated in deterministic server code. The browser-control skill was used during development to QA the signed-in ChatGPT experience; it is not shipped with or required by the product.

## 8. Current release status

- UI, revision, inactive-card, approval routing, idempotency, and TikTok error handling are implemented and tested.
- Live advertiser discovery and prompt-driven account switching are implemented. A replacement card remains editable and confirmable even when account status metadata is not `STATUS_ENABLE`.
- Real creation reaches TikTok, but `Education Coaching0315` currently returns `40002: Complete payment to continue.`
- Other authorized advertisers may be used for QA after explicit user selection. Release completion still requires one successful create plus `smart_plus_campaign_get` read-back of a real Campaign ID.
