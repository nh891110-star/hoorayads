# Hooray Campaign Review 正式 OAuth 配置

## 目标架构

这是正式的多用户授权，不是共享测试账号：

1. 每位同事第一次使用 Hooray 时，在 ChatGPT 内连接自己的 TikTok advertiser account。
2. ChatGPT 从 Hooray protected-resource metadata 发现 TikTok Ads Flat MCP OAuth。
3. ChatGPT 直接向 TikTok Dynamic Client Registration endpoint 注册本 connector 的官方 callback：`https://chatgpt.com/connector/oauth/{callback_id}`。
4. TikTok 完成 Authorization Code + PKCE 后回到该 ChatGPT callback；ChatGPT 保存该用户的 access token 和 refresh token。
5. ChatGPT 调用 `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` 时携带该用户 bearer token。
6. Hooray 将同一 bearer token 转发给 TikTok Ads Flat MCP，不把 token 写入 Render、GitHub 或本地文件。
7. TikTok 负责 advertiser 权限校验；用户只能读取和创建自己已授权的 advertiser account。

这条正式链路不经过 Render `/callback` 或 `/oauth/tiktok/callback`，因此 TikTok 看到的是 OpenAI 官方 callback，而不是 localhost、动态 IP、Cloudflare 或 Render 中转地址。

## ChatGPT Custom App

新建 app 时只需要提供 MCP URL，然后让 ChatGPT 自动发现 OAuth：

| ChatGPT field | Value |
|---|---|
| Name | `Hooray TikTok Ads` |
| Description | `Review, edit, and confirm one TikTok Smart+ Campaign before creation.` |
| MCP server URL | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Authentication | 自动识别为 `OAuth` |

不要在 ChatGPT 配置中填写 TikTok developer app 的 App ID 或 App Secret。TikTok Flat MCP 使用 DCR public client 和 PKCE，线上 metadata 声明 `token_endpoint_auth_methods_supported: ["none"]`。

如果 ChatGPT UI 展示只读的自动发现字段，预期值如下；不要手工改成 Render OAuth 地址：

| Discovered field | Expected value |
|---|---|
| Registration URL | `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat/oauth/register` |
| Authorization server base | `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat/oauth` |
| Resource | `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat` |
| Auth URL | `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat/oauth/authorize` |
| Token URL | `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat/oauth/token` |
| Token endpoint authentication | `None` / `Public client` |
| OAuth Client ID | 由 TikTok DCR 自动生成 |
| OAuth Client Secret | 留空 |
| Scope | `mcp:tt4b` |

点击 Connect 后，浏览器地址栏必须满足：

- Host 是 `business-api.tiktok.com`。
- `redirect_uri` 解码后以 `https://chatgpt.com/connector/oauth/` 开头。
- `resource` 是 `https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat`。
- URL 不应包含 `localhost`、EC2/IP、Cloudflare、Render `/callback` 或 `/oauth/tiktok/callback`。

若不满足以上条件，应删除该测试 app 并在最新部署后重新创建，避免 ChatGPT 复用旧 connector 的 OAuth metadata 和 DCR client。

## TikTok Developer App

Hooray ChatGPT 正式 OAuth 使用 TikTok Flat MCP 自身的 DCR，不使用用户另行申请的 developer app。因此：

- 不需要为这条链路修改 developer app 的 Advertiser redirect URL。
- 不需要把 ChatGPT callback 写入该 developer app。
- 不需要把 App ID 或 Secret 写入 ChatGPT。
- 已在聊天、截图或其他文本中暴露过的 Secret 仍应 rotate，但它不属于本 connector 的正式认证链路。

Render 中保留的旧 App ID、Secret 和 broker routes 仅用于兼容旧连接；新建 Hooray connector 不应发现或调用它们。

## 发布给同事

1. 先由 app owner 用真实 advertiser 完成一轮读取、编辑、Confirm 和 TikTok read-back QA。
2. 在 `Workspace settings > Apps > Drafts` 发布。
3. 配置允许使用的 workspace members/groups。
4. 对 `create_smartplus_campaign_from_review` 保持 write-action confirmation。
5. 每位同事第一次使用时必须独立 Connect，不共享 owner 的 advertiser authorization。

## 安全要求

- App Secret 不写入 GitHub、Lark、截图或 ChatGPT 配置。
- Hooray 不记录 `Authorization` header、authorization code、access token 或 refresh token。
- Hooray 必须把 bearer token 原样转发到 TikTok Flat MCP，并由 TikTok 校验 token 和 advertiser 权限。
- OAuth 诊断日志只记录阶段、correlation ID、callback 类型和上游 HTTP status，不记录 credential material。
- 旧 broker endpoints 暂时保留时不得通过 Hooray protected-resource metadata 对新 connector 广告。
