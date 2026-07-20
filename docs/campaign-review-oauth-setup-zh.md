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

推荐使用 Dynamic Client Registration，让 ChatGPT 自动登记它生成的 callback，而不是手工复制 TikTok App ID：

| ChatGPT field | Value |
|---|---|
| Name | `Hooray TikTok Ads` |
| Description | `Review, edit, and confirm one TikTok Smart+ Campaign before creation.` |
| MCP server URL | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Authentication | `OAuth` |
| Registration URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/register` |
| Authorization server base | `https://tiktok-ads-agent-poc.onrender.com/oauth` |
| Resource | `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt` |
| Auth URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/authorize` |
| Token URL | `https://tiktok-ads-agent-poc.onrender.com/oauth/token` |
| Token endpoint authentication | `None` / `Public client` |
| OAuth Client ID | DCR 模式由 ChatGPT 自动生成，不手工填写 |
| OAuth Client Secret | 留空 |
| Scope | `mcp:tt4b` |

OAuth Client Secret 必须留空。Hooray 和 TikTok Flat MCP 都声明 `token_endpoint_auth_methods_supported: ["none"]`，并使用 Authorization Code + PKCE。误填 Secret 会收到明确的 `invalid_client`，不会把 Secret 转发给 TikTok。

Hooray DCR 只接受 `https://chatgpt.com/connector/oauth/*` 和兼容的 OpenAI callback。注册时的完整 callback 会与签名 client ID 绑定；authorization 和 token exchange 会逐字符复核。localhost、动态端口、IP、EC2 动态域名、非 HTTPS、查询参数和未注册 callback 均被拒绝。

旧的静态 Client ID 配置仍向后兼容：可以把 TikTok App ID 作为 Client ID，Registration URL 留空，Secret 仍必须留空。但新建 Connector 应优先使用 DCR。

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

- App Secret 不写入 GitHub、Lark、截图或 ChatGPT 配置。
- 已经在聊天或其他文本中暴露过的 Secret，在正式发布前应 rotate。
- Hooray 不记录 `Authorization` header、authorization code、access token 或 refresh token。
- Render 应设置独立的 `OAUTH_REGISTRATION_SIGNING_KEY`。当前兼容逻辑可暂时使用已有 App Secret 派生 DCR 签名，但正式发布前应切换到独立随机值；切换后需要重新连接已注册的 ChatGPT App。
- OAuth 诊断日志只记录阶段、correlation ID、client/callback 哈希、可信 callback 类型和上游 HTTP status，不记录 credential material。
- 生产扩容到多个 Render instance 前，需要把短期 OAuth authorization transaction 存储迁移到共享、加密、带 TTL 的 store；单 instance 当前可用。
