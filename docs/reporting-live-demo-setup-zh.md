# Hooray TikTok Ads Reporting 双端 Demo 运行手册

## 1. 最终架构

这不是两套不同的报表产品，而是一套共享实现：

- 两个明确隔离的入口：`get_ads_report` 只取真实数据，`get_ads_report_demo` 只用于无 OAuth 的 UI 测试
- 一个数据协议：`ReportState`
- 一个当前 UI 资源：`ui://widget/tiktok-ads-report-v10.html`，并保留旧版本资源别名用于宿主缓存兼容
- ChatGPT 入口：`/mcp/chatgpt`
- Claude 入口：`/mcp/claude`
- Progressive MCP：保留现有建广告流程
- Flat MCP：负责 reporting、campaign/ad group/ad metadata 与官方 Ad Diagnosis 查询

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
5. Description 填 `Generate interactive TikTok Ads performance reports from the TikTok Ads Flat MCP.`
6. MCP server URL 填 `https://tiktok-ads-agent-poc.onrender.com/mcp/chatgpt`。
7. App authentication 选择无认证；TikTok advertiser 授权由 `get_ads_report` 的 live flow 单独发起。
8. 点击 `Scan Tools`，确认工具列表包含 `get_ads_report` 和 `get_ads_report_demo`，然后点击 `Create`。
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

## 5. 测试 Prompt

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

OAuth 暂不可用时，可明确要求测试数据：

```text
Use get_ads_report_demo to show a TikTok Ads demo report from 2026-07-06 to 2026-07-12 at campaign level.
```

默认值是最近 7 个完整自然日、Campaign level、对比上一周期。`get_ads_report` 本身不提供 Demo mode：没有授权时卡片只显示 Connect；有多个 advertiser account 时卡片显示账户选择；没有数据时显示 Empty state。只有用户明确要求 demo/sample/preview/UI test 时才使用独立的 `get_ads_report_demo`。

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

Diagnosis 区域调用 `tool_diagnosis_get`，对应 `/open_api/v1.3/tool/diagnosis/get/`：

- 必填：`advertiser_id`
- 可选：`filtering.adgroup_ids`，最多 20 个；当前默认不传，以免只展示局部账户建议
- 可选：`filtering.issue_category`，支持 `CREATIVE`、`BID_AND_BUDGET`、`EVENT_TRACK`
- 返回：active ad groups 的 TikTok 官方 suggestions；没有 suggestion 的 ad group 不会出现在结果中
- API 不返回 severity，因此 UI 不显示自定义 High、Medium 或 Low
- 空 suggestions 时再调用 `adgroup_get` 读取未删除 ad groups 的 `operation_status`：存在 `ENABLE` 时显示 `Looking good`，没有则显示 `Nothing to diagnose yet`

该诊断与所选 reporting date range 无关，展示的是 TikTok API 返回的最新诊断时间。诊断调用失败不会阻断主报表，也不会退化为本地 CTR、CPC 或 spend 规则。

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

## 8. 当前能力与生产边界

已适合真实产品演示：

- ChatGPT / Claude 共享 MCP Apps UI
- Live authorization state
- Flat report 查询和 pagination
- Previous-period comparison
- KPI、不同指标趋势、TikTok 官方诊断占位契约、breakdown table
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
pnpm run qa:reporting-api-contract
pnpm run qa:report-export
```

验证项包括 ChatGPT/Claude 两个 endpoint、tools/list、resource read、三个 report level 的真实 API 参数映射、live authorization state、独立 demo 工具、页面内层级切换和 UI resource metadata。生产 `get_ads_report` 没有 Demo input、环境开关或示例数据回退；`get_ads_report_demo` 不调用 TikTok API，也不会被当作 live fallback。
