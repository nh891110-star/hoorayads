# Campaign Review API Field Mapping

This document is the contract between ChatGPT, the Campaign Review card, and TikTok Ads Flat MCP. The card is a human-readable review of a real `smart_plus_campaign_create` request. It must not display a submit-relevant setting that cannot be serialized to that tool.

## Source of truth

- Create tool: `smart_plus_campaign_create`, backed by `/open_api/v1.3/smart_plus/campaign/create/`.
- Read-back tool: `smart_plus_campaign_get`, backed by `/open_api/v1.3/smart_plus/campaign/get/`.
- Supported objectives: `WEB_CONVERSIONS`, `LEAD_GENERATION`, `APP_PROMOTION`.
- The MCP tool schema, not model vocabulary or UI copy, defines accepted API fields and enums.
- Unknown concepts such as a generic `industry` field are not in the tool schema and must never be shown as a Campaign setting or sent in the create payload.

## Card-to-API mapping

| Card label | Tool input | Accepted API value | Display mapping | Condition | When absent |
| --- | --- | --- | --- | --- | --- |
| Advertiser account | `advertiser_id` | Authorized advertiser ID string | Authorized account name plus masked ID | Always; resolved from the user's Flat MCP authorization | Block review; never invent an ID |
| Campaign name | `campaign_name` | String, 1-512 characters in the Hooray contract | User/model text | Always | Block review |
| Campaign objective | `objective_type` | `WEB_CONVERSIONS`, `LEAD_GENERATION`, `APP_PROMOTION` | Website conversions, Lead generation, App promotion | Always | Block review; never remap unsupported objectives |
| Campaign budget | `budget` | Positive number in the advertiser account currency | Currency-formatted amount; `/day` for daily modes, `total` for total mode | Required for Dynamic daily, Daily, and Total modes | Omit only for Unlimited |
| Budget type | `budget_mode` | `BUDGET_MODE_DYNAMIC_DAILY_BUDGET`, `BUDGET_MODE_TOTAL`, `BUDGET_MODE_INFINITE`, `BUDGET_MODE_DAY` | Dynamic daily, Total, Unlimited, Daily | Always after user selection or an `AI suggested` proposal | Block invalid CBO/mode combinations |
| Campaign budget optimization | `budget_optimize_on` | Boolean | On or Off | Always | Model may propose; mark `AI suggested` |
| Sales destination | `sales_destination` | `WEBSITE`, `APP`, `WEB_AND_APP` | Website, App, Website and app | `WEB_CONVERSIONS` only | Omit for Lead and App Promotion |
| Catalog | `catalog_enabled` | Boolean | Used or Not used | Website Conversions or Lead Generation only | Omit for App Promotion |
| Catalog type | `catalog_type` | `ECOMMERCE`, `TRAVEL_ENTERTAINMENT`, `MINI_SERIES` | E-commerce, Travel and entertainment, Mini Series | Only when `catalog_enabled=true`; Mini Series is allowlist-only | Omit when Catalog is not used |
| Special ad category | `special_industries` | Array of `HOUSING`, `EMPLOYMENT`, `CREDIT` | Housing, Employment, Credit; or None selected | Explicit user confirmation required before the live card; non-empty values require an eligible US/CA advertiser | Empty selection serializes by omitting `special_industries` |
| App promotion type | `app_promotion_type` | `APP_INSTALL`, `APP_RETARGETING`, `MINIS` | App install, App retargeting, Minis | App Promotion only | Block App Promotion review if unresolved |
| App ID | `app_id` | TikTok App ID string | Exact ID from user or TikTok app-list data | App Promotion only; required by the API only in applicable App/iOS flows | Omit when not applicable; never invent |
| Campaign type | `campaign_type` | `REGULAR_CAMPAIGN`, `IOS14_CAMPAIGN` | Regular Campaign, iOS 14 Dedicated Campaign | App Promotion only; iOS 14 requires a valid App ID and platform eligibility | Omit for Web and Lead |
| Active on creation | `operation_status` | `ENABLE` | Not shown as an editable card row | Server-owned constant after Confirm | Never model-generated |
| Idempotency key | `request_id` | Numeric string | Not shown | Server-generated for each approved proposal | Block create if unavailable |

## UI-only metadata

These values control review behavior but are never forwarded to TikTok:

| Field | Purpose |
| --- | --- |
| `advertiserName` | User-readable label for the authorized advertiser selection |
| `specialIndustriesConfirmed` | Legal/eligibility guard proving the user explicitly answered the category question; the live initial-review schema requires `true` |
| `aiSuggestedFields` | Field-level provenance used only for the green `AI suggested` badge |
| `proposalId`, `version` | Immutable review/versioning and stale-card protection |
| `confirmed` | Explicit card approval boundary before the destructive create tool runs |

## Objective-specific payload shapes

### Website Conversions

Required review concepts: advertiser, name, objective, budget strategy, Sales destination, Catalog on/off, and explicit Special ad category confirmation.

The server may send `catalog_enabled=false`. It sends `catalog_type` only when Catalog is used. It never sends App fields.

### Lead Generation

Required review concepts: advertiser, name, objective, budget strategy, Catalog on/off, and explicit Special ad category confirmation.

The server omits `sales_destination` and all App fields.

### App Promotion

Required review concepts: advertiser, name, objective, budget strategy, App promotion type, Campaign type, and explicit Special ad category confirmation. App ID is passed only when supplied by the user or retrieved from TikTok.

The server omits `sales_destination`, `catalog_enabled`, and `catalog_type`. The card therefore does not display a Catalog row for App Promotion.

## Mapping rules for ChatGPT

1. Map user language only to an enum supported by the tool schema. If the intent is ambiguous or unsupported, ask rather than normalize silently.
2. Preserve exact user-confirmed values. Put only model-selected values in `aiSuggestedFields`.
3. Never infer advertiser ID, App ID, or Special ad category confirmation.
4. Do not put a generic industry, audience, schedule, bid, attribution, placement, optimization event, pixel, or creative setting in this Campaign-level card.
5. Before Confirm, validate all cross-field conditions. After Confirm, build the API payload from the server-owned proposal, not from editable browser state.
6. After create, require `smart_plus_campaign_get` read-back of Campaign ID, name, objective, and `operation_status=ENABLE`. Prefer read-back values in the success card; mark API-omitted values as Proposal rather than TikTok verified.
7. If an API enum is allowlist-only or account-dependent, do not claim availability from the prompt alone. Let TikTok capability checks/API validation decide and show a recoverable error if rejected.

## Serialization examples

User-facing `None selected` for Special ad category means the user explicitly confirmed that none applies; the API payload omits `special_industries`. User-facing `Not used` for Catalog means `catalog_enabled=false` for Website/Lead, but Catalog fields are entirely absent for App Promotion.

This distinction prevents UI labels from being mistaken for literal API enum values.
