# Hooray TikTok Ads: ChatGPT Coworker Installation

## Goal

Give each teammate the same Campaign Review experience while keeping advertiser authorization isolated per user. Teammates must connect their own TikTok account; they do not share the app owner's advertiser access token.

## Choose the correct test rollout

This app is still under development. Publishing a draft to a company workspace is **not** the same as publishing to the public ChatGPT/App Directory, but it can still freeze or broaden access to a tool snapshot. Use one of these two modes:

| Mode | Recommended when | Setup |
| --- | --- | --- |
| Private Developer Mode testing | Tools and schemas are still changing frequently; only a few colleagues need access. | Give the selected colleagues Developer Mode permission. Each tester creates their own `Dev` app from the same MCP URL and connects their own TikTok account. Refresh/recreate after tool changes. |
| Restricted workspace pilot | The tool contract is stable enough for a controlled internal pilot. | Admin publishes the draft internally, then limits User access to a test group or role and keeps write-action confirmation enabled. This is not a public directory release. |

For the current stage, use **Private Developer Mode testing**. Move to a restricted workspace pilot only after advertiser switching and successful Campaign creation/read-back pass acceptance.

## Release recommendation

| Stage | Audience | Publish action | Exit gate |
| --- | --- | --- | --- |
| Development now | Named PM, Design, and Engineering testers | Do not publish publicly. Give named testers Developer Mode access; each creates a private Dev app from the MCP URL. | Tool scan, OAuth, account discovery, review/edit/switch, and stale-card QA pass. |
| Restricted internal pilot | A controlled company test group | Publish the draft internally and restrict User access to the pilot group. Keep all write confirmations enabled. | At least one real Campaign create/read-back succeeds; multi-user OAuth isolation passes. |
| Broader internal release | Approved workspace users | Expand the internal app access group. | Security/privacy review, operational support, monitoring, and rollback plan are approved. |
| Public directory | External customers | Separate launch decision; not part of this development rollout. | TikTok and OpenAI production-review requirements are complete. |

Do not move directly from a changing Dev app to broad workspace or public availability.

## Option A: private Developer Mode testing now

### Workspace admin

1. Enable Developer Mode / custom MCP connectors in workspace permissions.
2. For Enterprise/Edu, grant Developer Mode through RBAC only to the named testers.
3. Do not publish the draft to all workspace members.

### Each authorized tester

1. Enable Developer Mode for their own account under **Settings > Apps > Advanced Settings** when the workspace requires it.
2. Open **Settings > Apps > Create**.
3. Create a `Dev` app using the App configuration and OAuth values below.
4. Select **Scan tools**, complete their own TikTok OAuth, then select **Create**.
5. The app appears under **Settings > Apps > Enabled Apps** with a `Dev` label.
6. After a server tool/schema update, select **Refresh**. If the OAuth/tool snapshot remains stale, delete and recreate the Dev app.

## Option B: restricted workspace pilot later

### Workspace admin or owner

1. In ChatGPT, open **Workspace settings > Apps > Create**. Depending on the current UI, the same entry may be labeled **Create app** or **Developer mode**.
2. Enter the configuration below and select **Scan tools**.
3. Complete OAuth once for owner QA.
4. Confirm that the scan includes the Campaign Review tools listed below.
5. Create the draft and review write-action permissions.
6. Publish it **internally** and limit User access to the designated test group or role. Do not expose it workspace-wide.
7. If the workspace supports it, enable **Self-service setup** so each allowed tester can connect independently from **Settings > Apps**.

### Each teammate

1. Open **Settings > Apps** and locate the published `Hooray TikTok Ads Campaign Review` app.
2. Select **Connect**.
3. Complete TikTok authorization using their own account.
4. Return to ChatGPT and start a new chat.
5. Mention/select the app and run the read-only validation prompt below before creating anything.

ChatGPT's current custom-app flow is documented in [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta) and [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in).

## Shared app configuration

| ChatGPT field | Value |
| --- | --- |
| Name | `Hooray TikTok Ads Campaign Review` |
| Description | `Review, edit, and explicitly confirm one TikTok Smart+ Campaign before creation.` |
| MCP server URL | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Authentication | `OAuth` discovered automatically from the MCP server |

Select **Scan tools** after entering the MCP URL. Do not choose `No authentication`.

## OAuth fields

ChatGPT should discover these values automatically. If the UI exposes them as read-only fields, verify them. If it requires manual entry, use exactly these values:

| OAuth field | Value |
| --- | --- |
| Registration URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/register` |
| Authorization server base | `https://tiktok-ads-agent-poc.onrender.com/oauth` |
| Resource | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Authorization URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/authorize` |
| Token URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/token` |
| Scope | `mcp:tt4b` |
| Client type | Public client / PKCE |
| Token endpoint authentication | `None` |
| Client ID | Leave for Dynamic Client Registration; ChatGPT/Hooray obtains it automatically |
| Client Secret | **Leave blank** |

### Do not enter these values

- Do not enter a TikTok developer App ID as the ChatGPT OAuth Client ID.
- Do not enter a TikTok developer App Secret in ChatGPT.
- Do not paste an owner access token, refresh token, authorization code, or Render environment secret.
- Do not replace the generated callback with localhost, Cloudflare, Render `/callback`, an EC2 address, or another custom redirect.

The expected callback is generated by ChatGPT and begins with:

```text
https://chatgpt.com/connector/oauth/
```

Hooray forwards that official callback through TikTok Flat MCP Dynamic Client Registration. A teammate does not need to register the callback in a separate TikTok developer app for this connector.

## Expected tool scan

| Tool | User-facing purpose |
| --- | --- |
| `list_authorized_tiktok_advertiser_accounts` | List the current user's real authorized advertiser accounts before selection or switching. |
| `review_smartplus_campaign` | Render a Campaign Review card without creating anything. |
| `approve_smartplus_campaign_review_from_chat` | Approve the current reviewed proposal from an explicit later chat instruction. |
| `revise_smartplus_campaign_review` | App-only in-card edit action. |
| `get_smartplus_campaign_review_status` | App-only reconciliation and inactive-card status action. |
| `create_smartplus_campaign_from_review` | App-only destructive action behind **Confirm**. |

Keep write-action confirmation enabled for both create/approval tools.

## Coworker smoke test

### 1. Verify independent authorization

```text
Use Hooray TikTok Ads Campaign Review. Show my authorized TikTok advertiser accounts. Do not create or change anything.
```

Expected: ChatGPT lists only that teammate's authorized accounts, including account name and advertiser ID. No Campaign card appears.

### 2. Explicitly select an account

```text
Use advertiser account <EXACT ACCOUNT NAME OR ID>. Prepare one Website Conversions Smart+ Campaign review named Coworker QA. Use Website destination, USD 30/day Dynamic daily budget, Campaign Budget Optimization On, Catalog not used, and I explicitly confirm no Housing, Employment, or Credit special ad category applies. Render the card and do not submit.
```

Expected: One proposed card shows the selected account and no write occurs.

### 3. Switch accounts smoothly

```text
Show the other advertiser accounts authorized for this connection. Do not change the current proposal yet.
```

After choosing one from the real list:

```text
Switch this proposal to advertiser account <EXACT NEW ACCOUNT NAME OR ID>. Keep all other Campaign settings unchanged, render a replacement review card, and do not submit.
```

Expected: the new card shows the selected advertiser; the prior card becomes grey and `Inactive`; only the new card has Edit and Confirm.

### 4. Optional write QA

Select **Confirm** only on a designated QA advertiser that has billing and Campaign permissions ready. Success requires a real Campaign ID and TikTok read-back. If TikTok returns a billing, permission, or validation error, the card must show `Needs attention` and must not fabricate an ID.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Connector fails before TikTok login | Delete the stale draft and recreate it from the MCP URL so OAuth metadata and DCR are rediscovered. |
| Authorization URL contains Render `/callback`, localhost, Cloudflare, or an IP | The connector is using the wrong OAuth flow. Recreate it; the decoded redirect must start with `https://chatgpt.com/connector/oauth/`. |
| ChatGPT asks for Client Secret | Verify that Registration URL and Authorization server base are the Hooray URLs above and token authentication is `None`. Do not enter the TikTok secret. |
| No advertiser accounts appear | Confirm the teammate authorized the correct TikTok user and that the user has access to advertiser assets. Reconnect if the grant is stale. |
| Account is listed but review fails | The account may be disabled or not authorized for the selected TikTok connection. Use another explicitly selected account or fix its permissions. |
| Confirm returns `Complete payment to continue` | Campaign creation reached TikTok, but the selected advertiser's billing readiness blocks creation. Resolve billing or select another ready advertiser. |
| A selected advertiser reports a non-enabled status | The replacement proposal must still allow Edit and Confirm. Treat account status as informational; display the real TikTok create error if submission is rejected. |

## Security and ownership

- Each teammate receives a separate delegated TikTok authorization.
- Hooray forwards the user's bearer token to TikTok Flat MCP and does not share the owner's token.
- Credentials must not be placed in GitHub, Lark, screenshots, prompts, or this app configuration.
- Revoke a teammate's access through workspace app controls and TikTok authorization controls when needed.
