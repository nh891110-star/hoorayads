const root = document.getElementById("report-root") || document.getElementById("app-root");
const APP_INFO = { name: "Hooray TikTok Ads Reporting", version: "1.8.0" };
const PROTOCOL_VERSION = "2026-01-26";

let reportState = null;
let hostContext = {};
let initialized = false;
let initializeRequestId = null;
let requestCounter = 0;
let loading = false;
let localExpanded = false;
let searchQuery = "";
let trendMetric = "spend";
let reportRequestVersion = 0;
let latestInteractiveFilters = null;
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
  return {
    status: "needs_authorization",
    generatedAt: new Date().toISOString(),
    advertiser: null,
    accountOptions: [],
    filters: {
      startDate: formatDate(start),
      endDate: formatDate(end),
      level: "campaign",
      comparePreviousPeriod: true
    },
    totals: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0 },
    kpis: [],
    trend: [],
    rows: [],
    message: "Connect TikTok Ads to load reporting data."
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
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
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
  const colors = { spend: "#008f8c", clicks: "#e05b3f", impressions: "#2f6fbd" };
  const color = colors[key] || colors.spend;
  const gradientId = `report-area-${key}`;
  return `
    <svg class="trend-svg metric-${escapeHtml(key)}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(key)} trend">
      <defs><linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity=".02"/></linearGradient></defs>
      <line class="chart-grid" x1="${padding}" y1="${height * 0.34}" x2="${width - padding}" y2="${height * 0.34}"/>
      <line class="chart-grid" x1="${padding}" y1="${height * 0.67}" x2="${width - padding}" y2="${height * 0.67}"/>
      <polygon class="chart-area" points="${area}" fill="url(#${gradientId})"/>
      <polyline class="chart-line" points="${polyline}"/>
      <g class="chart-dots">${dots}</g>
    </svg>`;
}

function renderHeader() {
  const account = reportState?.advertiser?.name || "TikTok Ads performance report";
  return `
    <header class="report-header">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true"><b></b><i></i></span>
        <div><p class="eyebrow">HOORAY REPORTING</p><h1>${escapeHtml(account)}</h1></div>
      </div>
      <div class="header-meta">
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

function renderDiagnosisSuggestion(suggestion) {
  const values = suggestion.currentValue || suggestion.recommendedValue
    ? `<p class="diagnosis-values">${suggestion.currentValue ? `<span>Current <strong>${escapeHtml(suggestion.currentValue)}</strong></span>` : ""}${suggestion.recommendedValue ? `<span>Recommended <strong>${escapeHtml(suggestion.recommendedValue)}</strong></span>` : ""}</p>`
    : "";
  const details = suggestion.details?.length
    ? `<details><summary>View details</summary><ul>${suggestion.details.map((detail) => `<li>${escapeHtml(detail)}</li>`).join("")}</ul></details>`
    : "";
  return `<article class="diagnosis-item"><span class="diagnosis-category">${escapeHtml(String(suggestion.category || "recommendation").replaceAll("_", " & "))}</span><strong>${escapeHtml(suggestion.entityName || "TikTok Ads recommendation")}</strong><p>${escapeHtml(suggestion.message || "")}</p>${values}${suggestion.suggestionTime ? `<small>Diagnosed ${escapeHtml(suggestion.suggestionTime)}</small>` : ""}${details}</article>`;
}

function renderDiagnosis() {
  const diagnosis = reportState?.diagnosis;
  if (!diagnosis) return "";
  if (diagnosis.status === "clear") {
    return `<aside class="diagnosis-panel diagnosis-empty"><div class="panel-heading"><div><span class="section-kicker">TIKTOK DIAGNOSIS</span><strong>Looking good</strong></div></div><p>No current TikTok recommendations.</p></aside>`;
  }
  if (diagnosis.status === "no_ads") {
    return `<aside class="diagnosis-panel diagnosis-empty"><div class="panel-heading"><div><span class="section-kicker">TIKTOK DIAGNOSIS</span><strong>Nothing to diagnose yet</strong></div></div><p>No active ads found.</p></aside>`;
  }
  const suggestions = diagnosis.suggestions || [];
  return `<aside class="diagnosis-panel"><div class="panel-heading"><div><span class="section-kicker">TIKTOK DIAGNOSIS</span><strong>Issues & recommendations</strong></div></div><div class="diagnosis-list">${suggestions.slice(0, 2).map(renderDiagnosisSuggestion).join("")}</div>${suggestions.length > 2 ? `<details class="all-diagnoses"><summary>View all recommendations</summary><div class="diagnosis-list">${suggestions.slice(2).map(renderDiagnosisSuggestion).join("")}</div></details>` : ""}</aside>`;
}

function reportAccountOptions() {
  const selectedAdvertiserId = reportState?.advertiser?.id || "";
  const accountMap = new Map();
  for (const account of reportState?.accountOptions || []) {
    accountMap.set(account.advertiserId, account);
  }
  if (reportState?.advertiser && !accountMap.has(selectedAdvertiserId)) {
    accountMap.set(selectedAdvertiserId, {
      advertiserId: selectedAdvertiserId,
      advertiserName: reportState.advertiser.name,
      currency: reportState.advertiser.currency,
      timezone: reportState.advertiser.timezone
    });
  }
  return [...accountMap.values()];
}

function accountDisplayValue(account) {
  return [account?.advertiserName, account?.advertiserId, account?.currency].filter(Boolean).join(" · ");
}

function accountHelpText(hasOptions) {
  return hasOptions
    ? "Search by account name or advertiser ID, then choose a result. You can also enter an exact advertiser ID."
    : "Type an exact advertiser ID, or leave this empty and Apply to load your authorized accounts.";
}

function resolveAdvertiserId(input) {
  const typed = String(input?.value || "").trim();
  if (!typed) return { advertiserId: undefined };
  const options = reportAccountOptions();
  const selectedId = input?.dataset?.selectedAdvertiserId || "";
  const selected = options.find((account) => account.advertiserId === selectedId);
  if (selected && (typed === selected.advertiserId || typed === accountDisplayValue(selected))) {
    return { advertiserId: selected.advertiserId };
  }
  const normalized = typed.toLowerCase();
  const exact = options.find((account) =>
    [account.advertiserId, account.advertiserName, accountDisplayValue(account)]
      .some((value) => String(value || "").toLowerCase() === normalized)
  );
  if (exact) return { advertiserId: exact.advertiserId };
  const matches = options.filter((account) => accountDisplayValue(account).toLowerCase().includes(normalized));
  if (matches.length === 1) return { advertiserId: matches[0].advertiserId };
  if (/^(?:\d{5,}|adv[-_][a-z0-9_-]+)$/i.test(typed)) return { advertiserId: typed };
  return { error: "Choose a matching account, or enter the exact advertiser ID." };
}

function renderFilters() {
  const filters = reportState?.filters || {};
  const selectedAdvertiserId = reportState?.advertiser?.id || "";
  const accounts = reportAccountOptions();
  const selectedAccount = accounts.find((account) => account.advertiserId === selectedAdvertiserId);
  const accountValue = selectedAccount ? accountDisplayValue(selectedAccount) : selectedAdvertiserId;
  const liveOptions = accounts
    .map((account) => {
      const searchText = accountDisplayValue(account).toLowerCase();
      return `<button type="button" class="account-option" role="option" data-advertiser-option="${escapeHtml(account.advertiserId)}" data-account-label="${escapeHtml(accountDisplayValue(account))}" data-account-search="${escapeHtml(searchText)}"><strong>${escapeHtml(account.advertiserName)}</strong><span>${escapeHtml([account.advertiserId, account.currency].filter(Boolean).join(" · "))}</span></button>`;
    })
    .join("");
  const accountHelp = accountHelpText(accounts.length > 0);
  return `
    <section class="filter-bar">
      <div class="account-field">
        <span class="field-label">Advertiser Account</span>
        <div class="account-combobox" data-account-combobox>
          <input type="search" data-filter="advertiserId" role="combobox" aria-autocomplete="list" aria-controls="advertiser-account-list" aria-expanded="false" autocomplete="off" placeholder="Search account name or advertiser ID" value="${escapeHtml(accountValue)}" data-selected-advertiser-id="${escapeHtml(selectedAdvertiserId)}">
          <span class="account-chevron" aria-hidden="true">⌄</span>
          <div class="account-menu" id="advertiser-account-list" role="listbox" hidden>
            ${liveOptions || `<div class="account-empty">No loaded accounts yet. Enter an exact ID or Apply to connect TikTok Ads.</div>`}
          </div>
        </div>
        <small data-account-help>${escapeHtml(accountHelp)}</small>
      </div>
      <label>Level<select data-filter="level"><option value="campaign" ${filters.level === "campaign" ? "selected" : ""}>Campaign</option><option value="adgroup" ${filters.level === "adgroup" ? "selected" : ""}>Ad group</option><option value="ad" ${filters.level === "ad" ? "selected" : ""}>Ad</option></select></label>
      <label>Start<input type="date" data-filter="startDate" value="${escapeHtml(filters.startDate || "")}"></label>
      <label>End<input type="date" data-filter="endDate" value="${escapeHtml(filters.endDate || "")}"></label>
      <label class="check-label"><input type="checkbox" data-filter="compare" ${filters.comparePreviousPeriod ? "checked" : ""}>Compare previous period</label>
      <button class="secondary-button" data-action="apply">Apply</button>
    </section>`;
}

function breakdownColumns(level) {
  if (level === "adgroup") {
    return [
      { key: "name", label: "Name", value: (row) => row.name },
      { key: "status", label: "Status", value: (row) => row.status },
      { key: "adgroupId", label: "Ad group ID", value: (row) => row.details?.adgroupId || row.id || "--" },
      { key: "budget", label: "Budget", value: (row) => row.details?.budget || "--" },
      { key: "bid", label: "Bid", value: (row) => row.details?.bid || "--" },
      { key: "adScheduling", label: "Ad scheduling", value: (row) => row.details?.adScheduling || "--" },
      { key: "attributionSetting", label: "Attribution setting", value: (row) => row.details?.attributionSetting || "--" }
    ];
  }
  if (level === "ad") {
    return [
      { key: "name", label: "Name", value: (row) => row.name },
      { key: "status", label: "Status", value: (row) => row.status },
      { key: "source", label: "Source", value: (row) => row.details?.source || "--" },
      { key: "adgroupId", label: "Ad group ID", value: (row) => row.details?.adgroupId || "--" },
      { key: "adgroupName", label: "Ad group name", value: (row) => row.details?.adgroupName || "--" },
      { key: "adId", label: "Ad ID", value: (row) => row.details?.adId || row.id || "--" }
    ];
  }
  return [
    { key: "name", label: "Name", value: (row) => row.name },
    { key: "status", label: "Status", value: (row) => row.status },
    { key: "campaignBudget", label: "Campaign budget", value: (row) => row.details?.campaignBudget || "--" },
    { key: "spend", label: "Spend", numeric: true, value: (row) => formatMetric("spend", row.spend) },
    { key: "cpc", label: "CPC (destination)", numeric: true, value: (row) => formatMetric("cpc", row.cpc) },
    { key: "cpm", label: "CPM", numeric: true, value: (row) => formatMetric("cpm", row.cpm) },
    { key: "impressions", label: "Impressions", numeric: true, value: (row) => formatMetric("impressions", row.impressions) }
  ];
}

function renderBreakdownCell(row, column) {
  const value = column.value(row);
  const className = column.numeric ? "number-cell" : "";
  if (column.key === "name") {
    return `<td class="${className}"><strong>${escapeHtml(value)}</strong></td>`;
  }
  if (column.key === "status") {
    const statusClass = String(value).toLowerCase().replaceAll(" ", "-");
    return `<td class="${className}"><span class="status-pill ${statusClass}">${escapeHtml(value)}</span></td>`;
  }
  return `<td class="${className}">${escapeHtml(value)}</td>`;
}

function renderTable() {
  const rows = (reportState?.rows || []).filter((row) => row.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const level = reportState?.filters?.level || "campaign";
  const columns = breakdownColumns(level);
  return `
    <section class="table-panel">
      <div class="table-toolbar">
        <div><span class="section-kicker">BREAKDOWN</span><h2>${escapeHtml(level.replace("adgroup", "ad group"))} performance</h2></div>
        <div class="table-actions">
          <label class="search-box">⌕<input type="search" data-search placeholder="Search names" value="${escapeHtml(searchQuery)}"></label>
          <button class="secondary-button" data-action="export">Export CSV</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="breakdown-table level-${escapeHtml(level)}">
          <thead><tr>${columns.map((column) => `<th class="${column.numeric ? "number-cell" : ""}">${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
          <tbody>${rows
            .map((row) => `<tr>${columns.map((column) => renderBreakdownCell(row, column)).join("")}</tr>`)
            .join("") || `<tr><td colspan="${columns.length}" class="empty-cell">No rows match this search.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;
}

function renderReady() {
  const diagnosis = renderDiagnosis();
  return `
    <main class="report-shell ${isExpanded() ? "expanded" : "compact"}">
      ${renderHeader()}
      ${isExpanded() ? renderFilters() : ""}
      ${renderKpis()}
      <section class="overview-grid ${diagnosis ? "with-diagnosis" : "trend-only"}">${renderTrend()}${diagnosis}</section>
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
  const showReportControls = state.status === "needs_account" || (state.status === "empty" && Boolean(state.advertiser));
  return `
    <main class="report-shell status-shell">
      ${renderHeader()}
      <section class="status-panel">
        <div class="status-symbol">${state.status === "error" ? "!" : state.status === "empty" ? "0" : "↗"}</div>
        <p class="section-kicker">TIKTOK ADS REPORTING</p>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(state.message || "Your report will appear here when the required information is available.")}</p>
        ${state.authorizationUrl ? `<button class="primary-button" data-action="authorize">Connect TikTok Ads</button>` : ""}
        ${state.status === "empty" && !showReportControls ? `<button class="secondary-button" data-action="refresh">Refresh</button>` : ""}
        ${state.status === "error" ? `<div class="status-actions"><button class="primary-button" data-action="refresh">Retry report</button></div>` : ""}
        ${state.technicalDetail ? `<details><summary>Technical detail</summary><pre>${escapeHtml(state.technicalDetail)}</pre></details>` : ""}
      </section>
      ${showReportControls ? renderFilters() : ""}
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
    ...(reportState?.advertiser?.id ? { advertiserId: reportState.advertiser.id } : {}),
    startDate: reportState?.filters?.startDate,
    endDate: reportState?.filters?.endDate,
    level: reportState?.filters?.level || "campaign",
    comparePreviousPeriod: reportState?.filters?.comparePreviousPeriod !== false,
    ...overrides
  };
}

function requestedFilters(args) {
  return {
    startDate: args.startDate || reportState?.filters?.startDate,
    endDate: args.endDate || reportState?.filters?.endDate,
    level: args.level || reportState?.filters?.level || "campaign",
    comparePreviousPeriod: args.comparePreviousPeriod !== false
  };
}

function matchesRequestedFilters(state, expected = latestInteractiveFilters) {
  if (!expected) return true;
  const filters = state?.filters;
  return Boolean(
    filters &&
    filters.startDate === expected.startDate &&
    filters.endDate === expected.endDate &&
    filters.level === expected.level &&
    (filters.comparePreviousPeriod !== false) === expected.comparePreviousPeriod
  );
}

function applyHostReportState(next) {
  if (!next || !matchesRequestedFilters(next)) return false;
  reportState = next;
  return true;
}

async function callReportTool(args) {
  const requestVersion = ++reportRequestVersion;
  const expectedFilters = requestedFilters(args);
  latestInteractiveFilters = expectedFilters;
  if (reportState) {
    reportState = {
      ...reportState,
      filters: { ...reportState.filters, ...expectedFilters }
    };
  }
  loading = true;
  render();
  try {
    let result;
    const toolName = reportState?.requestTool === "get_ads_report_demo" ? "get_ads_report_demo" : "get_ads_report";
    if (initialized && hostContext?.capabilities?.serverTools !== false) {
      result = await rpc("tools/call", { name: toolName, arguments: args });
    } else if (window.openai?.callTool) {
      result = await window.openai.callTool(toolName, args);
    } else if (window.parent === window) {
      reportState = createPreviewState();
      reportState.filters = {
        startDate: args.startDate || reportState.filters.startDate,
        endDate: args.endDate || reportState.filters.endDate,
        level: args.level || reportState.filters.level,
        comparePreviousPeriod: args.comparePreviousPeriod !== false
      };
      return;
    } else {
      throw new Error("This host did not expose MCP tool calls to the report app.");
    }
    const next = extractReportState(result);
    if (!next) throw new Error("The report tool returned no report state.");
    if (!matchesRequestedFilters(next, expectedFilters)) {
      throw new Error(`The report tool returned ${next.filters?.level || "an unknown"} level instead of ${expectedFilters.level}.`);
    }
    if (requestVersion === reportRequestVersion) reportState = next;
  } catch (error) {
    if (requestVersion === reportRequestVersion) {
      reportState = {
        ...(reportState || createPreviewState()),
        status: "error",
        message: "The report could not be refreshed.",
        technicalDetail: error instanceof Error ? error.message : "Unknown host error"
      };
    }
  } finally {
    if (requestVersion === reportRequestVersion) {
      loading = false;
      render();
    }
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

function exportCsvFallback() {
  const rows = reportState?.rows || [];
  const columns = breakdownColumns(reportState?.filters?.level || "campaign");
  const header = columns.map((column) => column.label);
  const body = rows.map((row) => columns.map((column) => column.value(row)));
  const csv = [header, ...body].map((row) => row.map(csvValue).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tiktok-ads-report-${reportState?.filters?.startDate || "export"}.csv`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function openExternalUrl(url) {
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

async function exportCsv() {
  if (reportState?.exportUrl) {
    await openExternalUrl(reportState.exportUrl);
    return;
  }
  exportCsvFallback();
}

async function openAuthorization() {
  await openExternalUrl(reportState?.authorizationUrl);
}

function reportArgumentsFromControls(overrides = {}) {
  const accountInput = root.querySelector('[data-filter="advertiserId"]');
  const resolvedAccount = resolveAdvertiserId(accountInput);
  if (resolvedAccount.error) {
    return { error: resolvedAccount.error, accountInput };
  }
  return {
    accountInput,
    args: reportArguments({
      advertiserId: resolvedAccount.advertiserId,
      startDate: root.querySelector('[data-filter="startDate"]')?.value,
      endDate: root.querySelector('[data-filter="endDate"]')?.value,
      level: root.querySelector('[data-filter="level"]')?.value,
      comparePreviousPeriod: Boolean(root.querySelector('[data-filter="compare"]')?.checked),
      ...overrides
    })
  };
}

function showAccountError(message, accountInput) {
  const help = root.querySelector("[data-account-help]");
  if (help) {
    help.textContent = message;
    help.classList.add("error");
  }
  accountInput?.focus();
}

function bindInteractions() {
  root.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.getAttribute("data-action");
      if (action === "refresh") await callReportTool(reportArguments());
      if (action === "expand") await requestExpand();
      if (action === "export") await exportCsv();
      if (action === "authorize") await openAuthorization();
      if (action === "apply") {
        const request = reportArgumentsFromControls();
        if (request.error) {
          showAccountError(request.error, request.accountInput);
          return;
        }
        await callReportTool(request.args);
      }
    });
  });
  const accountFilter = root.querySelector('[data-filter="advertiserId"]');
  const accountMenu = root.querySelector("[data-account-combobox] .account-menu");
  const accountHelp = root.querySelector("[data-account-help]");
  const showAccountMenu = (query = "") => {
    if (!accountMenu) return;
    const normalized = query.trim().toLowerCase();
    accountMenu.querySelectorAll("[data-account-search]").forEach((option) => {
      option.hidden = Boolean(normalized) && !option.dataset.accountSearch.includes(normalized);
    });
    accountMenu.hidden = false;
    accountFilter?.setAttribute("aria-expanded", "true");
  };
  const hideAccountMenu = () => {
    if (accountMenu) accountMenu.hidden = true;
    accountFilter?.setAttribute("aria-expanded", "false");
  };
  accountFilter?.addEventListener("focus", () => {
    showAccountMenu(accountFilter.value);
  });
  accountFilter?.addEventListener("input", () => {
    accountFilter.dataset.selectedAdvertiserId = "";
    if (accountHelp) {
      accountHelp.textContent = accountHelpText(reportAccountOptions().length > 0);
      accountHelp.classList.remove("error");
    }
    showAccountMenu(accountFilter.value);
  });
  accountFilter?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideAccountMenu();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      accountMenu?.querySelector("[data-advertiser-option]:not([hidden])")?.focus();
    }
  });
  accountFilter?.addEventListener("blur", () => window.setTimeout(hideAccountMenu, 120));
  root.querySelectorAll("[data-advertiser-option]").forEach((option) => {
    option.addEventListener("click", () => {
      accountFilter.value = option.dataset.accountLabel || option.dataset.advertiserOption || "";
      accountFilter.dataset.selectedAdvertiserId = option.dataset.advertiserOption || "";
      if (accountHelp) {
        accountHelp.textContent = accountHelpText(true);
        accountHelp.classList.remove("error");
      }
      accountFilter.focus();
      hideAccountMenu();
    });
  });
  root.querySelectorAll("[data-trend]").forEach((button) => {
    button.addEventListener("click", () => {
      trendMetric = button.getAttribute("data-trend") || "spend";
      render();
    });
  });
  root.querySelector('[data-filter="level"]')?.addEventListener("change", async (event) => {
    const request = reportArgumentsFromControls({ level: event.target.value });
    if (request.error) {
      showAccountError(request.error, request.accountInput);
      return;
    }
    await callReportTool(request.args);
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
    if (applyHostReportState(next)) render();
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
  if (applyHostReportState(next)) {
    const mode = window.openai?.displayMode;
    if (mode) hostContext = { ...hostContext, displayMode: mode };
    render();
  }
});

reportState = readChatGptState() || window.__REPORT_PREVIEW_STATE__ || createPreviewState();
sendInitialize();
render();
