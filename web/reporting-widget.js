const root = document.getElementById("report-root") || document.getElementById("app-root");
const APP_INFO = { name: "Hooray TikTok Ads Reporting", version: "1.1.0" };
const PROTOCOL_VERSION = "2026-01-26";

let reportState = null;
let hostContext = {};
let initialized = false;
let initializeRequestId = null;
let requestCounter = 0;
let loading = false;
let localExpanded = false;
let searchQuery = "";
let columnPreset = "basic";
let trendMetric = "spend";
const pendingRequests = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function createPreviewState() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const rows = [
    ["Summer Sale | Prospecting", "Active", 1842.6, 284100, 4688],
    ["Always-on Retargeting", "Active", 1260.4, 146220, 3224],
    ["Creator Spark Test", "Active", 922.15, 121800, 2777],
    ["Catalog Best Sellers", "Active", 714.8, 103700, 1984],
    ["App Install | US", "Paused", 466.25, 89700, 1421]
  ].map(([name, status, spend, impressions, clicks], index) => ({
    id: `demo-${index + 1}`,
    name,
    status,
    spend,
    impressions,
    clicks,
    ctr: (clicks / impressions) * 100,
    cpc: spend / clicks,
    cpm: (spend / impressions) * 1000
  }));
  const totals = completeMetrics(rows.reduce(
    (sum, row) => ({
      spend: sum.spend + row.spend,
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks
    }),
    { spend: 0, impressions: 0, clicks: 0 }
  ));
  const weights = [0.11, 0.13, 0.12, 0.15, 0.14, 0.17, 0.18];
  const trend = weights.map((weight, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return {
      date: formatDate(date),
      spend: totals.spend * weight,
      impressions: Math.round(totals.impressions * weight),
      clicks: Math.round(totals.clicks * weight)
    };
  });
  return {
    status: "ready",
    source: "demo",
    generatedAt: new Date().toISOString(),
    advertiser: {
      id: "demo-advertiser-001",
      name: "Hooray Demo Account",
      currency: "USD",
      timezone: "America/Los_Angeles"
    },
    filters: {
      startDate: formatDate(start),
      endDate: formatDate(end),
      level: "campaign",
      comparePreviousPeriod: true
    },
    totals,
    kpis: [
      { key: "spend", label: "Spend", value: totals.spend, deltaPercent: 12.4 },
      { key: "impressions", label: "Impressions", value: totals.impressions, deltaPercent: 8.6 },
      { key: "clicks", label: "Clicks", value: totals.clicks, deltaPercent: 15.8 },
      { key: "ctr", label: "CTR", value: totals.ctr, deltaPercent: 6.7 }
    ],
    trend,
    rows,
    insights: [
      "Summer Sale | Prospecting drove 35% of spend in this period.",
      "Creator Spark Test had the strongest CTR at 2.28%."
    ]
  };
}

function completeMetrics(metrics) {
  return {
    ...metrics,
    ctr: metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) * 100 : 0,
    cpc: metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0,
    cpm: metrics.impressions > 0 ? (metrics.spend / metrics.impressions) * 1000 : 0
  };
}

function extractReportState(value) {
  return (
    value?.structuredContent?.reportState ||
    value?.result?.structuredContent?.reportState ||
    value?.mcp_tool_result?.structuredContent?.reportState ||
    value?.toolResult?.structuredContent?.reportState ||
    value?.reportState ||
    null
  );
}

function readChatGptState() {
  const host = window.openai || {};
  return (
    extractReportState(host.toolOutput) ||
    extractReportState(host.toolResponseMetadata) ||
    extractReportState(host.widgetState) ||
    null
  );
}

function postToHost(message) {
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
}

function rpc(method, params = {}) {
  if (!window.parent || window.parent === window) {
    return Promise.reject(new Error("No MCP Apps host is connected."));
  }
  const id = `report-${Date.now()}-${++requestCounter}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`${method} timed out.`));
    }, 20000);
    pendingRequests.set(id, { resolve, reject, timer });
    postToHost({ id, method, params });
  });
}

function sendInitialize() {
  if (initialized || initializeRequestId || !window.parent || window.parent === window) return;
  initializeRequestId = `init-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  postToHost({
    id: initializeRequestId,
    method: "ui/initialize",
    params: {
      appInfo: APP_INFO,
      appCapabilities: { availableDisplayModes: ["inline", "fullscreen"] },
      protocolVersion: PROTOCOL_VERSION
    }
  });
}

function notifySize() {
  const width = Math.ceil(document.documentElement.scrollWidth);
  const height = Math.ceil(document.documentElement.scrollHeight);
  postToHost({ method: "ui/notifications/size-changed", params: { width, height } });
  try {
    window.openai?.notifyIntrinsicHeight?.(height);
  } catch {
    // Height notification is best-effort across hosts.
  }
}

function currencyCode() {
  const value = reportState?.advertiser?.currency;
  return value && value !== "--" ? value : "USD";
}

function formatMetric(key, value) {
  const numeric = Number(value || 0);
  if (key === "spend" || key === "cpc" || key === "cpm") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode(),
        maximumFractionDigits: key === "spend" ? 0 : 2
      }).format(numeric);
    } catch {
      return `${numeric.toFixed(key === "spend" ? 0 : 2)} ${currencyCode()}`;
    }
  }
  if (key === "ctr") return `${numeric.toFixed(2)}%`;
  return new Intl.NumberFormat(undefined, { notation: numeric > 9999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(numeric);
}

function formatDelta(value) {
  if (value === null || value === undefined) return "No prior baseline";
  const numeric = Number(value);
  const arrow = numeric > 0 ? "↑" : numeric < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(numeric).toFixed(1)}% vs prior`;
}

function humanDateRange(filters) {
  if (!filters?.startDate || !filters?.endDate) return "Last 7 days";
  const start = new Date(`${filters.startDate}T00:00:00Z`);
  const end = new Date(`${filters.endDate}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function sparkline(points, key) {
  const width = 640;
  const height = isExpanded() ? 190 : 118;
  const padding = 12;
  if (!points?.length) {
    return `<div class="chart-empty">No trend data</div>`;
  }
  const values = points.map((point) => Number(point[key] || 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const coords = values.map((value, index) => {
    const x = padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y, value, date: points[index].date };
  });
  const polyline = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `${padding},${height - padding} ${polyline} ${width - padding},${height - padding}`;
  const dots = coords
    .map(
      (point) =>
        `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5"><title>${escapeHtml(point.date)}: ${escapeHtml(formatMetric(key, point.value))}</title></circle>`
    )
    .join("");
  return `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(key)} trend">
      <defs><linearGradient id="report-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#00a6a6" stop-opacity=".28"/><stop offset="100%" stop-color="#00a6a6" stop-opacity=".02"/></linearGradient></defs>
      <line class="chart-grid" x1="${padding}" y1="${height * 0.34}" x2="${width - padding}" y2="${height * 0.34}"/>
      <line class="chart-grid" x1="${padding}" y1="${height * 0.67}" x2="${width - padding}" y2="${height * 0.67}"/>
      <polygon class="chart-area" points="${area}"/>
      <polyline class="chart-line" points="${polyline}"/>
      <g class="chart-dots">${dots}</g>
    </svg>`;
}

function sourceBadge() {
  const demo = reportState?.source === "demo";
  return `<span class="source-badge ${demo ? "demo" : "live"}"><i></i>${demo ? "Demo data" : "Live TikTok data"}</span>`;
}

function renderHeader() {
  const account = reportState?.advertiser?.name || "TikTok Ads report";
  return `
    <header class="report-header">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true"><b></b><i></i></span>
        <div><p class="eyebrow">HOORAY REPORTING</p><h1>${escapeHtml(account)}</h1></div>
      </div>
      <div class="header-meta">
        ${sourceBadge()}
        <span class="date-chip">${escapeHtml(humanDateRange(reportState?.filters))}</span>
        <button class="icon-button" data-action="refresh" aria-label="Refresh report" title="Refresh report">↻</button>
        <button class="primary-button" data-action="expand">${isExpanded() ? "Compact view" : "Expand report"}</button>
      </div>
    </header>`;
}

function renderKpis() {
  const kpis = reportState?.kpis || [];
  return `<section class="kpi-grid">${kpis
    .map(
      (kpi) => `
        <article class="kpi-card">
          <span>${escapeHtml(kpi.label)}</span>
          <strong>${escapeHtml(formatMetric(kpi.key, kpi.value))}</strong>
          <small class="${Number(kpi.deltaPercent) >= 0 ? "up" : "down"}">${escapeHtml(formatDelta(kpi.deltaPercent))}</small>
        </article>`
    )
    .join("")}</section>`;
}

function renderTrend() {
  const choices = [
    ["spend", "Spend"],
    ["clicks", "Clicks"],
    ["impressions", "Impressions"]
  ];
  return `
    <article class="trend-panel">
      <div class="panel-heading">
        <div><span class="section-kicker">PERFORMANCE TREND</span><strong>${escapeHtml(choices.find(([key]) => key === trendMetric)?.[1] || "Spend")}</strong></div>
        <div class="metric-tabs">${choices.map(([key, label]) => `<button class="${key === trendMetric ? "active" : ""}" data-trend="${key}">${label}</button>`).join("")}</div>
      </div>
      ${sparkline(reportState?.trend || [], trendMetric)}
      <div class="chart-axis"><span>${escapeHtml(reportState?.trend?.[0]?.date || "")}</span><span>${escapeHtml(reportState?.trend?.at(-1)?.date || "")}</span></div>
    </article>`;
}

function renderInsights() {
  const insights = reportState?.insights || [];
  return `
    <aside class="insights-panel">
      <div class="panel-heading"><div><span class="section-kicker">WHAT CHANGED</span><strong>Quick read</strong></div></div>
      <div class="insight-list">${insights
        .slice(0, 2)
        .map((insight, index) => `<div class="insight"><span>${index + 1}</span><p>${escapeHtml(insight)}</p></div>`)
        .join("") || `<p class="muted">Insights appear when delivery data is available.</p>`}</div>
      <button class="text-button" data-action="export">Export current view as CSV</button>
    </aside>`;
}

function renderMobileInsight() {
  const insight = reportState?.insights?.[0];
  return insight ? `<div class="mobile-insight"><span>INSIGHT</span><p>${escapeHtml(insight)}</p></div>` : "";
}

function renderFilters() {
  const filters = reportState?.filters || {};
  return `
    <section class="filter-bar">
      <label>Level<select data-filter="level"><option value="campaign" ${filters.level === "campaign" ? "selected" : ""}>Campaign</option><option value="adgroup" ${filters.level === "adgroup" ? "selected" : ""}>Ad group</option><option value="ad" ${filters.level === "ad" ? "selected" : ""}>Ad</option></select></label>
      <label>Start<input type="date" data-filter="startDate" value="${escapeHtml(filters.startDate || "")}"></label>
      <label>End<input type="date" data-filter="endDate" value="${escapeHtml(filters.endDate || "")}"></label>
      <label>Data<select data-filter="mode"><option value="live" ${reportState?.source !== "demo" ? "selected" : ""}>Live</option><option value="demo" ${reportState?.source === "demo" ? "selected" : ""}>Demo</option></select></label>
      <label class="check-label"><input type="checkbox" data-filter="compare" ${filters.comparePreviousPeriod ? "checked" : ""}>Compare previous period</label>
      <button class="secondary-button" data-action="apply">Apply</button>
    </section>`;
}

function renderTable() {
  const rows = (reportState?.rows || []).filter((row) => row.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const costColumns = columnPreset === "efficiency";
  return `
    <section class="table-panel">
      <div class="table-toolbar">
        <div><span class="section-kicker">BREAKDOWN</span><h2>${escapeHtml((reportState?.filters?.level || "campaign").replace("adgroup", "ad group"))} performance</h2></div>
        <div class="table-actions">
          <label class="search-box">⌕<input type="search" data-search placeholder="Search names" value="${escapeHtml(searchQuery)}"></label>
          <select data-columns aria-label="Column preset"><option value="basic" ${!costColumns ? "selected" : ""}>Basic columns</option><option value="efficiency" ${costColumns ? "selected" : ""}>Cost efficiency</option></select>
          <button class="secondary-button" data-action="export">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Status</th><th>Spend</th>${costColumns ? "<th>CPC</th><th>CPM</th>" : "<th>Impressions</th><th>Clicks</th><th>CTR</th>"}</tr></thead>
          <tbody>${rows
            .map(
              (row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.id)}</small></td><td><span class="status-pill ${String(row.status).toLowerCase().replaceAll(" ", "-")}">${escapeHtml(row.status)}</span></td><td>${escapeHtml(formatMetric("spend", row.spend))}</td>${
                costColumns
                  ? `<td>${escapeHtml(formatMetric("cpc", row.cpc))}</td><td>${escapeHtml(formatMetric("cpm", row.cpm))}</td>`
                  : `<td>${escapeHtml(formatMetric("impressions", row.impressions))}</td><td>${escapeHtml(formatMetric("clicks", row.clicks))}</td><td>${escapeHtml(formatMetric("ctr", row.ctr))}</td>`
              }</tr>`
            )
            .join("") || `<tr><td colspan="7" class="empty-cell">No rows match this search.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
}

function renderReady() {
  return `
    <main class="report-shell ${isExpanded() ? "expanded" : "compact"}">
      ${renderHeader()}
      ${isExpanded() ? renderFilters() : ""}
      ${renderKpis()}
      <section class="overview-grid">${renderTrend()}${renderInsights()}</section>
      ${renderMobileInsight()}
      ${isExpanded() ? renderTable() : ""}
      <footer><span>Generated ${escapeHtml(new Date(reportState.generatedAt || Date.now()).toLocaleString())}</span><span>Powered by TikTok Ads Flat MCP</span></footer>
      ${loading ? `<div class="loading-cover"><span></span><p>Refreshing TikTok Ads data…</p></div>` : ""}
    </main>`;
}

function renderStatus() {
  const state = reportState || {};
  const title = {
    needs_authorization: "Connect TikTok Ads",
    needs_account: "Choose an advertiser account",
    empty: "No delivery data yet",
    error: "Report unavailable"
  }[state.status] || "Preparing report";
  const accounts = state.accountOptions || [];
  return `
    <main class="report-shell status-shell">
      ${renderHeader()}
      <section class="status-panel">
        <div class="status-symbol">${state.status === "error" ? "!" : state.status === "empty" ? "0" : "↗"}</div>
        <p class="section-kicker">TIKTOK ADS REPORTING</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(state.message || "Your report will appear here when the required information is available.")}</p>
        ${accounts.length ? `<div class="account-options">${accounts.map((account) => `<button data-account="${escapeHtml(account.advertiserId)}"><strong>${escapeHtml(account.advertiserName)}</strong><span>${escapeHtml(account.currency)} · ${escapeHtml(account.timezone)}</span></button>`).join("")}</div>` : ""}
        ${state.authorizationUrl ? `<button class="primary-button" data-action="authorize">Connect TikTok Ads</button>` : ""}
        ${state.status === "empty" ? `<button class="secondary-button" data-action="refresh">Refresh</button>` : ""}
        ${state.status === "error" ? `<div class="status-actions"><button class="primary-button" data-action="refresh">Retry live report</button><button class="secondary-button" data-action="demo">Open demo data</button></div>` : ""}
        ${state.technicalDetail ? `<details><summary>Technical detail</summary><pre>${escapeHtml(state.technicalDetail)}</pre></details>` : ""}
      </section>
      ${loading ? `<div class="loading-cover"><span></span><p>Loading report…</p></div>` : ""}
    </main>`;
}

function isExpanded() {
  return hostContext.displayMode === "fullscreen" || localExpanded;
}

function render() {
  if (!root) return;
  root.innerHTML = reportState?.status === "ready" ? renderReady() : renderStatus();
  bindInteractions();
  requestAnimationFrame(notifySize);
}

function reportArguments(overrides = {}) {
  return {
    ...(reportState?.advertiser?.id && !String(reportState.advertiser.id).startsWith("demo-") ? { advertiserId: reportState.advertiser.id } : {}),
    startDate: reportState?.filters?.startDate,
    endDate: reportState?.filters?.endDate,
    level: reportState?.filters?.level || "campaign",
    mode: reportState?.source || "live",
    comparePreviousPeriod: reportState?.filters?.comparePreviousPeriod !== false,
    ...overrides
  };
}

async function callReportTool(args) {
  loading = true;
  render();
  try {
    let result;
    if (initialized && hostContext?.capabilities?.serverTools !== false) {
      result = await rpc("tools/call", { name: "get_ads_report", arguments: args });
    } else if (window.openai?.callTool) {
      result = await window.openai.callTool("get_ads_report", args);
    } else if (window.parent === window) {
      reportState = createPreviewState();
      reportState.source = args.mode || "demo";
      return;
    } else {
      throw new Error("This host did not expose MCP tool calls to the report app.");
    }
    const next = extractReportState(result);
    if (!next) throw new Error("The report tool returned no report state.");
    reportState = next;
  } catch (error) {
    reportState = {
      ...(reportState || createPreviewState()),
      status: "error",
      message: "The report could not be refreshed.",
      technicalDetail: error instanceof Error ? error.message : "Unknown host error"
    };
  } finally {
    loading = false;
    render();
  }
}

async function requestExpand() {
  if (isExpanded()) {
    localExpanded = false;
    if (hostContext.displayMode === "fullscreen") {
      try {
        await rpc("ui/request-display-mode", { mode: "inline" });
      } catch {
        try { await window.openai?.requestDisplayMode?.({ mode: "inline" }); } catch { /* Host may keep fullscreen. */ }
      }
    }
    render();
    return;
  }

  if (window.parent === window) {
    localExpanded = true;
    render();
    return;
  }

  try {
    const result = initialized
      ? await rpc("ui/request-display-mode", { mode: "fullscreen" })
      : await window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
    hostContext = { ...hostContext, ...(result?.hostContext || {}), displayMode: result?.displayMode || "fullscreen" };
    render();
  } catch {
    try {
      await window.openai?.requestDisplayMode?.({ mode: "fullscreen" });
      hostContext = { ...hostContext, displayMode: "fullscreen" };
      render();
    } catch {
      const maxHeight = Number(hostContext?.viewport?.maxHeight || 0);
      if (!maxHeight || maxHeight > 700) {
        localExpanded = true;
        render();
      }
    }
  }
}

function csvValue(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = reportState?.rows || [];
  const header = ["ID", "Name", "Status", "Spend", "Impressions", "Clicks", "CTR", "CPC", "CPM"];
  const body = rows.map((row) => [row.id, row.name, row.status, row.spend, row.impressions, row.clicks, row.ctr, row.cpc, row.cpm]);
  const csv = [header, ...body].map((row) => row.map(csvValue).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tiktok-ads-report-${reportState?.filters?.startDate || "export"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function openAuthorization() {
  const url = reportState?.authorizationUrl;
  if (!url) return;
  try {
    if (initialized) {
      await rpc("ui/open-link", { url });
    } else if (window.openai?.openExternal) {
      await window.openai.openExternal({ href: url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function bindInteractions() {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-action");
      if (action === "refresh") await callReportTool(reportArguments());
      if (action === "expand") await requestExpand();
      if (action === "export") exportCsv();
      if (action === "authorize") await openAuthorization();
      if (action === "demo") await callReportTool(reportArguments({ mode: "demo", advertiserId: undefined }));
      if (action === "apply") {
        const startDate = root.querySelector('[data-filter="startDate"]')?.value;
        const endDate = root.querySelector('[data-filter="endDate"]')?.value;
        const level = root.querySelector('[data-filter="level"]')?.value;
        const mode = root.querySelector('[data-filter="mode"]')?.value;
        const comparePreviousPeriod = Boolean(root.querySelector('[data-filter="compare"]')?.checked);
        await callReportTool(reportArguments({ startDate, endDate, level, mode, comparePreviousPeriod }));
      }
    });
  });
  root.querySelectorAll("[data-account]").forEach((button) => {
    button.addEventListener("click", () => callReportTool(reportArguments({ advertiserId: button.getAttribute("data-account"), mode: "live" })));
  });
  root.querySelectorAll("[data-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      trendMetric = button.getAttribute("data-trend") || "spend";
      render();
    });
  });
  const search = root.querySelector("[data-search]");
  search?.addEventListener("input", () => {
    searchQuery = search.value;
    const cursor = search.selectionStart;
    render();
    const next = root.querySelector("[data-search]");
    next?.focus();
    next?.setSelectionRange(cursor, cursor);
  });
  root.querySelector("[data-columns]")?.addEventListener("change", (event) => {
    columnPreset = event.target.value;
    render();
  });
}

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  const message = event.data;
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.id === initializeRequestId && message.result) {
    initialized = true;
    initializeRequestId = null;
    hostContext = { ...(message.result.hostContext || {}), capabilities: message.result.hostCapabilities || {} };
    postToHost({ method: "ui/notifications/initialized", params: {} });
    render();
    return;
  }

  const pending = pendingRequests.get(message.id);
  if (pending) {
    window.clearTimeout(pending.timer);
    pendingRequests.delete(message.id);
    if (message.error) pending.reject(new Error(message.error.message || "Host request failed."));
    else pending.resolve(message.result);
    return;
  }

  if (message.method === "ui/notifications/tool-result") {
    const next = extractReportState(message.params);
    if (next) {
      reportState = next;
      render();
    }
    return;
  }

  if (message.method === "ui/notifications/host-context-changed") {
    hostContext = { ...hostContext, ...(message.params || {}) };
    render();
    return;
  }

  if (message.method === "ui/resource-teardown" && message.id !== undefined) {
    postToHost({ id: message.id, result: {} });
  }
});

window.addEventListener("openai:set_globals", () => {
  const next = readChatGptState();
  if (next) {
    reportState = next;
    const mode = window.openai?.displayMode;
    if (mode) hostContext = { ...hostContext, displayMode: mode };
    render();
  }
});

reportState = readChatGptState() || window.__REPORT_PREVIEW_STATE__ || createPreviewState();
sendInitialize();
render();
