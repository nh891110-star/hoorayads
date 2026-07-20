# Hooray Campaign Review 正式 OAuth 配置

## 目标架构

这是正式的多用户授权，不是共享测试账号：

1. 每位同事第一次使用 Hooray 时，在 ChatGPT 内连接自己的 TikTok advertiser account。
2. ChatGPT 保存该用户的 access token 和 refresh token。
3. ChatGPT 调用 `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` 时携带该用户 bearer token。
4. Hooray 将 bearer token 转发给 TikTok Ads Flat MCP，不把 token 写入 Render、GitHub 或 `.local` 文件。
5. TikTok 仍负责账号权限校验；用户只能读取和创建自己已授权的 advertiser account。

## TikTok Developer Portal

使用已审批的 TikTok developer app：

| Field | Value |
|---|---|
| Advertiser redirect URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/tiktok/callback` |
| TikTok account holder redirect URL | 本次 Campaign-level P0 不使用；保留现有值即可 |

不要继续使用旧的 `/callback` 或临时 Cloudflare URL。redirect URL 必须逐字符一致，包括 `https`、path 和是否有尾部 `/`。

## ChatGPT Custom App

在 `Workspace settings > Apps > Create`（或 draft app 的配置页）填写：

| ChatGPT field | Value |
|---|---|
| Name | `Hooray TikTok Ads` |
| Description | `Review, edit, and confirm one TikTok Smart+ Campaign before creation.` |
| MCP server URL | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Authentication | `OAuth` |
| OAuth Client ID | 已审批 TikTok app 的 App ID |
| OAuth Client Secret | 留空 |

OAuth Client Secret 必须留空的原因：TikTok Flat MCP 的线上 OAuth discovery 明确返回 `token_endpoint_auth_methods_supported: ["none"]`。它是通过 Authorization Code + PKCE 保护的 public client；向 token endpoint 发送 App Secret 不符合该接口契约。

点击 `Scan Tools` 后，预期流程为：

1. ChatGPT 读取 Hooray protected-resource metadata。
2. Hooray 跳转 TikTok advertiser authorization。
3. TikTok 回到 Hooray 的 `/oauth/tiktok/callback`。
4. Hooray 把一次性 code 返回 ChatGPT。
5. ChatGPT 通过 PKCE 换取并保存该用户 token。
6. Scan Tools 成功后显示 Campaign Review tools。

## 发布给同事

1. 先保持 Draft，由 app owner 完成真实 advertiser QA。
2. 在 `Workspace settings > Apps > Drafts` 发布。
3. 配置允许使用的 workspace members/groups。
4. 对 `create_smartplus_campaign_from_review` 保持 write-action confirmation。
5. 每位同事第一次使用时都必须独立 Connect，不共享 owner 的 advertiser authorization。

## 安全要求

- App Secret 不写入 GitHub、Lark、截图、日志或 Render。
- 已经在聊天或其他文本中暴露过的 Secret，在正式发布前应 rotate。
- Hooray 不记录 `Authorization` header、authorization code、access token 或 refresh token。
- 生产扩容到多个 Render instance 前，需要把短期 OAuth authorization transaction 存储迁移到共享、加密、带 TTL 的 store；单 instance 当前可用。
