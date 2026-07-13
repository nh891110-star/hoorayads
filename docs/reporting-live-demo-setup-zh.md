# Hooray TikTok Ads Reporting 双端 Demo 运行手册

## 1. 最终架构

这不是两套不同的报表产品，而是一套共享实现：

- 一个工具：`get_ads_report`
- 一个数据协议：`ReportState`
- 一个 UI 资源：`ui://widget/tiktok-ads-report-v1.html`
- ChatGPT 入口：`/mcp/chatgpt`
- Claude 入口：`/mcp/claude`
- Progressive MCP：保留现有建广告流程
- Flat MCP：负责 reporting、campaign/ad group/ad metadata 查询

UI 优先使用 MCP Apps 标准 `_meta.ui.resourceUri`、`ui/initialize`、`ui/notifications/tool-result` 和 `tools/call`。`window.openai` 只作为 ChatGPT 兼容 fallback，所以不按 host 复制代码。

## 2. 上线地址

当前 Render 服务域名：

- Health：`https://tiktok-ads-agent-poc.onrender.com/health`
- ChatGPT MCP：`https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`
- Claude MCP：`https://tiktok-ads-agent-poc.onrender.com/mcp/claude`
- OAuth callback：`https://tiktok-ads-agent-poc.onrender.com/callback`
- 只读预览：`https://tiktok-ads-agent-poc.onrender.com/report-preview`

注意：这些新路径需要先把当前 workspace 版本部署到 Render。部署前，线上服务仍是旧版本。

## 3. ChatGPT 添加方式

ChatGPT custom MCP apps 当前适用于 Business、Enterprise 和 Edu 的 ChatGPT Web。需要 workspace admin/owner 或被授权的 developer 权限。

1. Business admin/owner 打开 `Settings > Apps > Advanced settings`，为自己启用 Developer mode；也可以从 `Workspace settings > Apps > Create` 开始。
2. Enterprise/Edu admin 先在 `Workspace settings > Permissions & Roles > Connected Data` 授权 Developer mode；被授权用户再到 `Settings > Apps > Advanced settings` 打开开关。
3. 从 `Settings > Apps > Create` 创建 app；admin/owner 也可以从 `Workspace settings > Apps > Create` 创建。
4. Name 填 `Hooray TikTok Ads Reporting`。
5. Description 填 `Generate interactive TikTok Ads performance reports from live Flat MCP data or demo data.`
6. MCP server URL 填 `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`。
7. App authentication 选择无认证；TikTok advertiser 授权由 `get_ads_report` 的 live flow 单独发起。
8. 点击 `Scan Tools`，确认工具列表包含 `get_ads_report`，然后点击 `Create`。
9. 新 app 会出现在 `Settings > Apps > Enabled Apps`，并带有 `Dev` 标签；在新 chat 的 tools menu 中选择它进行测试。

官方说明：<https://help.openai.com/en/articles/12584461>

## 4. Claude 添加方式

个人 Free / Pro / Max：

1. Claude 打开 `Customize > Connectors`。
2. 点击 Connectors 旁边的 `+`，选择 `Add custom connector`。
3. Name 填 `Hooray TikTok Ads Reporting`。
4. URL 填 `https://tiktok-ads-agent-poc.onrender.com/mcp/claude`。
5. Advanced settings 的 OAuth Client ID 和 Secret 留空，然后点击 `Add`。
6. 在 chat 的 `+ > Connectors` 中启用该 connector。

Team / Enterprise：

1. Owner 打开 `Organization settings > Connectors`。
2. 点击 `Add`，选择 `Custom > Web`。
3. 填入 `https://tiktok-ads-agent-poc.onrender.com/mcp/claude` 并添加。
4. 成员到 `Customize > Connectors` 找到带有 `Custom` 标签的 connector，点击 `Connect`。
5. 在具体 chat 的 `+ > Connectors` 中启用。

官方说明：<https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp>

## 5. 演示 Prompt

无需 TikTok 授权：

```text
Show a demo TikTok Ads report.
```

真实数据默认流程：

```text
Show my TikTok Ads report for the last 7 complete days.
```

更多例子：

```text
Compare campaign performance with the previous period.
Show ad group performance from 2026-07-01 to 2026-07-07.
Show the ad-level report and sort by spend.
```

默认值是 Live、最近 7 个完整自然日、Campaign level、对比上一周期。没有授权时卡片显示 Connect；有多个 advertiser account 时卡片显示账户选择；没有数据时显示 Empty state。

## 6. TikTok Reporting API 映射

实际调用工具：`report_integrated_get`，对应 `/open_api/v1.3/report/integrated/get/`。

MCP schema 标记的 required：

- `report_type`
- `dimensions`

Basic report 实际必须完整提供：

- `advertiser_id`：用户指定、环境默认值，或授权用户只有一个账户时自动选择
- `report_type: BASIC`
- `service_type: AUCTION`
- `data_level`：`AUCTION_CAMPAIGN`、`AUCTION_ADGROUP` 或 `AUCTION_AD`
- `dimensions`：ID dimension 加 `stat_time_day`
- `start_date`、`end_date`：`YYYY-MM-DD`，daily breakdown 最多 30 天
- `metrics`：显式请求 `spend`、`impressions`、`clicks`、`ctr`、`cpc`、`cpm`
- `page`、`page_size`：每页最多 1000，应用最多读取 20 页

随后按层级调用 `campaign_get`、`adgroup_get` 或 `ad_get`，把 ID 补成用户可读的名称和投放状态。

## 7. 环境变量

Render 必须配置：

```text
TIKTOK_APP_ENV=dev
TIKTOK_APP_ID=<TikTok app id>
TIKTOK_APP_SECRET=<TikTok app secret>
TIKTOK_REDIRECT_URI=https://tiktok-ads-agent-poc.onrender.com/callback
TIKTOK_ADVERTISER_AUTH_URL=<TikTok advertiser authorization URL>
TIKTOK_MCP_URL=https://ads.tiktok.com/mcp
TIKTOK_FLAT_MCP_URL=https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat
PUBLIC_BASE_URL=https://tiktok-ads-agent-poc.onrender.com
REPORTING_DEFAULT_ADVERTISER_ID=<optional>
```

TikTok developer portal 的 allowlisted redirect URI 必须与 `TIKTOK_REDIRECT_URI` 完全一致。原来的 `https://mcp.hoorayads.org/callback` 当前 DNS 不可用，不应继续作为 demo callback。

## 8. Demo 与生产边界

已适合真实产品演示：

- ChatGPT / Claude 共享 MCP Apps UI
- Live authorization state
- Flat report 查询和 pagination
- Previous-period comparison
- KPI、趋势、洞察、breakdown table
- Refresh、筛选、搜索、列预设、CSV export
- 320px responsive 和 500px inline height

公开给大量用户前仍需补：

- 把 `.local/*.json` OAuth token/state 迁移到按用户隔离的持久化存储
- 把当前进程内 session state 迁移到持久化 session store
- 为 MCP endpoint 增加调用方认证、rate limiting 和审计日志
- 明确同步报告超过 20,000 ads 时的分批策略

## 9. 本地验证

```bash
node --import tsx src/http-server.ts
node .local/qa-reporting-flow.mjs
```

验证项包括 ChatGPT/Claude 两个 endpoint、tools/list、resource read、demo report、live authorization state 和 UI resource metadata。
