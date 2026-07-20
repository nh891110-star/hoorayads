const root = document.getElementById("campaign-review-root") || document.getElementById("app-root");
const APP_INFO = { name: "TikTok Campaign Review", version: "1.0.0" };
const PROTOCOL_VERSION = "2026-01-26";

let reviewState = null;
let hostContext = {};
let initialized = false;
let initializeRequestId = null;
let requestCounter = 0;
let busy = false;
let editMode = false;
let editDraft = null;
let statusRefreshTimer = null;
const pendingRequests = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createPreviewState() {
  return {
    mode: "demo",
    actionTools: {
      revise: "revise_smartplus_campaign_review_demo",
      status: "get_smartplus_campaign_review_demo_status",
      submit: "submit_smartplus_campaign_review_demo"
    },
    proposalId: "preview-proposal",
    version: 1,
    status: "proposed",
    readyToCreate: true,
    isCurrentVersion: true,
    createdAt: new Date().toISOString(),
    validationErrors: [],
    account: {
      advertiserId: "7481826080479870993",
      maskedAdvertiserId: "7481…0993",
      advertiserName: "Education Coaching0315",
      currency: "USD",
      country: "US",
      status: "STATUS_ENABLE",
      timezone: "Etc/GMT+5"
    },
    campaign: {
      advertiserId: "7481826080479870993",
      campaignName: "MCP UI QA - Website Conversions",
      objectiveType: "WEB_CONVERSIONS",
      budget: 50,
      budgetMode: "BUDGET_MODE_DYNAMIC_DAILY_BUDGET",
      budgetOptimizeOn: true,
      salesDestination: "WEBSITE",
      catalogEnabled: false,
      specialIndustries: [],
      specialIndustriesConfirmed: true,
      campaignType: "REGULAR_CAMPAIGN",
      aiSuggestedFields: ["campaignName", "objectiveType", "budget", "budgetMode", "budgetOptimizeOn", "salesDestination", "catalogEnabled"],
      operationStatus: "ENABLE"
    }
  };
}

function extractReviewState(value) {
  return (
    value?.structuredContent?.campaignReviewState ||
    value?.result?.structuredContent?.campaignReviewState ||
    value?.mcp_tool_result?.structuredContent?.campaignReviewState ||
    value?.toolResult?.structuredContent?.campaignReviewState ||
    value?.campaignReviewState ||
    null
  );
}

function readChatGptState() {
  const host = window.openai || {};
  return (
    extractReviewState(host.toolOutput) ||
    extractReviewState(host.toolResponseMetadata) ||
    extractReviewState(host.widgetState) ||
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
  const id = `campaign-review-${Date.now()}-${++requestCounter}`;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`${method} timed out.`));
    }, 30000);
    pendingRequests.set(id, { resolve, reject, timer });
    postToHost({ id, method, params });
  });
}

function sendInitialize() {
  if (initialized || initializeRequestId || !window.parent || window.parent === window) return;
  initializeRequestId = `campaign-init-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  postToHost({
    id: initializeRequestId,
    method: "ui/initialize",
    params: {
      appInfo: APP_INFO,
      appCapabilities: {},
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

async function callTool(name, args) {
  if (initialized) return rpc("tools/call", { name, arguments: args });
  if (window.openai?.callTool) return window.openai.callTool(name, args);
  throw new Error("This host does not support interactive Campaign Review actions.");
}

function isSameReviewState(next) {
  if (!reviewState || !next) return false;
  return (
    reviewState.proposalId === next.proposalId &&
    reviewState.version === next.version &&
    reviewState.status === next.status &&
    JSON.stringify(reviewState.campaign) === JSON.stringify(next.campaign) &&
    JSON.stringify(reviewState.validationErrors || []) === JSON.stringify(next.validationErrors || []) &&
    JSON.stringify(reviewState.execution || null) === JSON.stringify(next.execution || null)
  );
}

function applyState(next) {
  if (!next || isSameReviewState(next)) return false;
  reviewState = next;
  editMode = false;
  editDraft = null;
  return true;
}

function isDemo() {
  return reviewState?.mode === "demo";
}

function actionTool(action) {
  const liveDefaults = {
    revise: "revise_smartplus_campaign_review",
    status: "get_smartplus_campaign_review_status",
    submit: "create_smartplus_campaign_from_review"
  };
  return reviewState?.actionTools?.[action] || liveDefaults[action];
}

function labelForObjective(value) {
  return {
    WEB_CONVERSIONS: "Website conversions",
    LEAD_GENERATION: "Lead generation",
    APP_PROMOTION: "App promotion"
  }[value] || value;
}

function labelForBudgetMode(value) {
  return {
    BUDGET_MODE_DYNAMIC_DAILY_BUDGET: "Dynamic daily budget",
    BUDGET_MODE_TOTAL: "Total budget",
    BUDGET_MODE_INFINITE: "Unlimited",
    BUDGET_MODE_DAY: "Daily budget"
  }[value] || value;
}

function labelForSalesDestination(value) {
  return { WEBSITE: "Website", APP: "App", WEB_AND_APP: "Website and app" }[value] || value;
}

function labelForAppPromotionType(value) {
  return {
    APP_INSTALL: "App install",
    APP_RETARGETING: "App retargeting",
    MINIS: "Minis"
  }[value] || value;
}

function labelForCatalog(value, catalogType) {
  if (!value) return "Not used";
  return {
    ECOMMERCE: "E-commerce catalog",
    TRAVEL_ENTERTAINMENT: "Travel and entertainment catalog",
    MINI_SERIES: "Mini Series catalog"
  }[catalogType] || "Used";
}

function labelForSpecialIndustries(campaign) {
  if (!campaign.specialIndustriesConfirmed) return "Not confirmed";
  if (!campaign.specialIndustries?.length) return "None selected";
  return campaign.specialIndustries
    .map((value) => ({ HOUSING: "Housing", EMPLOYMENT: "Employment", CREDIT: "Credit" })[value] || value)
    .join(", ");
}

function formatCurrency(value) {
  if (value === undefined || value === null) return "Not set";
  const currency = reviewState?.account?.currency || "USD";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, minimumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${Number(value).toFixed(2)}`;
  }
}

function budgetSummary(campaign) {
  if (campaign.budgetMode === "BUDGET_MODE_INFINITE") return "Unlimited";
  const suffix = ["BUDGET_MODE_DYNAMIC_DAILY_BUDGET", "BUDGET_MODE_DAY"].includes(campaign.budgetMode)
    ? "/day"
    : " total";
  return `${formatCurrency(campaign.budget)}${suffix} · ${labelForBudgetMode(campaign.budgetMode)}`;
}

function verifiedReadback(state = reviewState) {
  if (state?.mode === "demo" || state?.status !== "created") return null;
  return state?.execution?.verifiedCampaign || null;
}

function displayCampaign(state) {
  const campaign = state.campaign;
  const verified = verifiedReadback(state);
  if (!verified) return campaign;
  return {
    ...campaign,
    campaignName: verified.campaignName ?? campaign.campaignName,
    objectiveType: verified.objectiveType ?? campaign.objectiveType,
    budget: verified.budget ?? campaign.budget,
    budgetMode: verified.budgetMode ?? campaign.budgetMode,
    budgetOptimizeOn: verified.budgetOptimizeOn ?? campaign.budgetOptimizeOn,
    salesDestination: verified.salesDestination ?? campaign.salesDestination,
    catalogEnabled: verified.catalogEnabled ?? campaign.catalogEnabled,
    catalogType: verified.catalogType ?? campaign.catalogType,
    specialIndustries: verified.specialIndustries ?? campaign.specialIndustries,
    specialIndustriesConfirmed: verified.specialIndustries !== undefined ? true : campaign.specialIndustriesConfirmed,
    operationStatus: verified.operationStatus ?? campaign.operationStatus
  };
}

function sourceBadge(field) {
  if (reviewState?.status === "created" && !isDemo()) {
    const verified = verifiedReadback();
    const keys = {
      campaignName: ["campaignName"],
      objectiveType: ["objectiveType"],
      budget: ["budget"],
      budgetMode: ["budgetMode"],
      budgetOptimizeOn: ["budgetOptimizeOn"],
      salesDestination: ["salesDestination"],
      catalogEnabled: ["catalogEnabled", "catalogType"],
      specialIndustries: ["specialIndustries"],
      operationStatus: ["operationStatus"]
    }[field] || [];
    const isVerified = verified && keys.some((key) => Object.prototype.hasOwnProperty.call(verified, key));
    return isVerified
      ? '<span class="source-badge source-badge-verified">TikTok verified</span>'
      : '<span class="source-badge source-badge-proposal">Proposal</span>';
  }
  const recommendedKeys = {
    budget: ["budget", "budgetMode"],
    catalogEnabled: ["catalogEnabled", "catalogType"]
  }[field] || [field];
  if (!recommendedKeys.some((key) => reviewState?.campaign?.aiSuggestedFields?.includes(key))) return "";
  return '<span class="source-badge">AI suggested</span>';
}

function operationStatusSummary() {
  if (reviewState?.status === "outcome_unknown") {
    const returned = reviewState?.execution?.verifiedCampaign?.operationStatus;
    return `<span class="status-value"><span class="status-dot"></span>Unconfirmed${returned ? ` · TikTok returned ${escapeHtml(returned)}` : ""}</span>`;
  }
  return `<span class="status-value"><span class="status-dot status-dot-active"></span>Active${isDemo() ? " · simulated" : ""}</span> ${sourceBadge("operationStatus")}`;
}

function reviewRows(campaign) {
  const rows = [
    ["Campaign budget", `${escapeHtml(budgetSummary(campaign))} ${sourceBadge("budget")}`],
    ["Campaign objective", `${escapeHtml(labelForObjective(campaign.objectiveType))} ${sourceBadge("objectiveType")}`]
  ];
  if (campaign.objectiveType === "WEB_CONVERSIONS") {
    rows.push(["Sales destination", `${escapeHtml(labelForSalesDestination(campaign.salesDestination))} ${sourceBadge("salesDestination")}`]);
  }
  if (campaign.objectiveType === "APP_PROMOTION") {
    rows.push(["App promotion type", `${escapeHtml(labelForAppPromotionType(campaign.appPromotionType || "Not set"))} ${sourceBadge("appPromotionType")}`]);
    if (campaign.appId) rows.push(["App ID", `${escapeHtml(campaign.appId)} ${sourceBadge("appId")}`]);
    rows.push(["Campaign type", `${campaign.campaignType === "IOS14_CAMPAIGN" ? "iOS 14 Dedicated Campaign" : "Regular Campaign"} ${sourceBadge("campaignType")}`]);
  }
  rows.push(
    ["Campaign budget optimization", `${campaign.budgetOptimizeOn ? "On" : "Off"} ${sourceBadge("budgetOptimizeOn")}`],
    ["Catalog", `${escapeHtml(labelForCatalog(campaign.catalogEnabled, campaign.catalogType))} ${sourceBadge("catalogEnabled")}`],
    ["Special ad category", `${escapeHtml(labelForSpecialIndustries(campaign))} ${sourceBadge("specialIndustries")}`],
    ["Status after creation", operationStatusSummary()]
  );
  return rows;
}

function statusTag(state) {
  if (state.status === "outdated") return '<span class="tag tag-muted">Inactive</span>';
  if (state.status === "created") return `<span class="tag tag-success">${state.mode === "demo" ? "Demo · " : ""}Submitted successfully</span>`;
  if (["creating", "checking"].includes(state.status)) return `<span class="tag tag-progress">${state.mode === "demo" ? "Demo · " : ""}Submitting…</span>`;
  if (["error", "outcome_unknown"].includes(state.status)) return '<span class="tag tag-error">Needs attention</span>';
  return `<span class="tag tag-muted">${state.mode === "demo" ? "Demo · " : ""}Proposed campaign</span>`;
}

function renderNotice(state) {
  if (state.status === "outdated") {
    return '<div class="notice notice-neutral" role="status">A newer version of this campaign is available below. This proposal can no longer be used.</div>';
  }
  if (state.status === "created") {
    const created = state.execution || {};
    return `<div class="receipt" role="status">
      <span><strong>${state.mode === "demo" ? "Demo receipt" : "Campaign ID"}</strong> ${escapeHtml(created.campaignId || "Pending")}</span>
      <span><strong>Status</strong> ${state.mode === "demo" ? "Active · simulated" : "Active"}</span>
      <span><strong>${state.mode === "demo" ? "Completed" : "Verified"}</strong> ${escapeHtml(created.verifiedAt ? new Date(created.verifiedAt).toLocaleString() : "Pending")}</span>
      <span><strong>Source</strong> ${state.mode === "demo" ? "Simulation" : "TikTok Campaign read-back"}</span>
    </div>`;
  }
  if (["creating", "checking"].includes(state.status)) {
    const progress = state.mode === "demo"
      ? "Simulating submission and receipt verification…"
      : state.status === "checking"
        ? "TikTok accepted the request. Verifying the Campaign ID and Active status…"
        : "Creating one Active TikTok Campaign…";
    return `<div class="notice notice-progress" role="status" aria-live="polite"><span class="spinner"></span>${progress}</div>`;
  }
  if (["error", "outcome_unknown"].includes(state.status)) {
    const message = state.execution?.errorMessage || state.validationErrors?.[0] || "Campaign creation could not be completed.";
    const connect = state.execution?.authorizationUrl
      ? `<button class="button button-link" data-action="connect" data-url="${escapeHtml(state.execution.authorizationUrl)}">Connect advertiser account</button>`
      : "";
    return `<div class="notice notice-error" role="alert"><strong>${state.status === "outcome_unknown" ? "Creation status is not yet confirmed." : "Campaign was not created."}</strong><span>${escapeHtml(message)}</span>${connect}</div>`;
  }
  if (state.validationErrors?.length) {
    return `<div class="notice notice-error" role="alert"><strong>Review required</strong><span>${escapeHtml(state.validationErrors.join(" "))}</span></div>`;
  }
  return "";
}

function renderReview() {
  const state = reviewState;
  const campaign = displayCampaign(state);
  const locked = busy || !state.proposalId || !state.isCurrentVersion || ["creating", "checking", "created", "outdated"].includes(state.status);
  const createDisabled = locked || !state.readyToCreate;
  const rows = reviewRows(campaign)
    .map(([label, value]) => `<div class="review-row"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`)
    .join("");
  const actions = state.status === "created" || state.status === "outdated" || !state.proposalId
    ? ""
    : state.status === "outcome_unknown"
      ? `<div class="actions"><button class="button button-primary" data-action="check-status" ${busy ? "disabled" : ""}>Check status</button></div>`
    : `<div class="actions">
        <button class="button button-secondary" data-action="edit" ${locked ? "disabled" : ""}>Edit</button>
        <button class="button button-primary" data-action="create" ${createDisabled ? "disabled" : ""}>Confirm</button>
      </div>`;
  const consequence = state.status === "created"
    ? isDemo()
      ? "Interaction test completed. No TikTok API was called and no TikTok object was created."
      : "Fields marked TikTok verified were returned by Campaign read-back. Fields marked Proposal were not returned and remain the approved values. No Ad Group, Ad, creative, or delivery was created."
    : state.status === "outcome_unknown"
      ? "TikTok read-back is not verified. Check status before taking another action; do not submit this proposal again."
    : isDemo()
      ? "Confirming simulates an Active Campaign submission. It does not call TikTok APIs or create any TikTok object."
      : "Proposal values only. Nothing exists in TikTok yet. Confirming creates one Active TikTok Smart+ Campaign; it cannot deliver or spend until eligible Ad Group and Ad objects are added.";

  root.innerHTML = `<article class="campaign-card ${state.status === "outdated" ? "is-outdated" : ""} ${state.status === "created" ? "is-submitted" : ""}">
    <header class="card-header">
      <div>
        <p class="eyebrow">TIKTOK AD CAMPAIGN · ${state.account.status === "UNKNOWN" ? `Requested advertiser · ${escapeHtml(state.account.advertiserName)}` : `${escapeHtml(state.account.advertiserName)} · ${escapeHtml(state.account.maskedAdvertiserId)}`}</p>
        <h1>${escapeHtml(campaign.campaignName)} ${sourceBadge("campaignName")}</h1>
      </div>
      ${statusTag(state)}
    </header>
    ${isDemo() ? '<div class="demo-banner" role="note"><strong>Interaction demo</strong><span>Uses sample account context. No data is sent to TikTok.</span></div>' : ""}
    ${renderNotice(state)}
    <dl class="review-grid">${rows}</dl>
    <footer class="card-footer">
      <p>${escapeHtml(consequence)}</p>
      ${actions}
    </footer>
  </article>`;
  bindInteractions();
  notifySize();
}

function option(value, label, current) {
  return `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function renderEdit() {
  const campaign = editDraft || { ...reviewState.campaign };
  const budgetRequired = campaign.budgetMode !== "BUDGET_MODE_INFINITE";
  const objectiveFields = campaign.objectiveType === "WEB_CONVERSIONS"
    ? `<label class="field"><span>Sales destination</span><select data-field="salesDestination">
        ${option("WEBSITE", "Website", campaign.salesDestination)}
        ${option("APP", "App", campaign.salesDestination)}
        ${option("WEB_AND_APP", "Website and app", campaign.salesDestination)}
      </select></label>`
    : campaign.objectiveType === "APP_PROMOTION"
      ? `<label class="field"><span>App promotion type</span><select data-field="appPromotionType">
          ${option("APP_INSTALL", "App install", campaign.appPromotionType)}
          ${option("APP_RETARGETING", "App retargeting", campaign.appPromotionType)}
          ${option("MINIS", "Minis", campaign.appPromotionType)}
        </select></label>
        <label class="field"><span>App ID</span><input data-field="appId" value="${escapeHtml(campaign.appId || "")}" placeholder="Required for iOS 14 Campaign"></label>
        <label class="field"><span>Campaign type</span><select data-field="campaignType">
          ${option("REGULAR_CAMPAIGN", "Regular Campaign", campaign.campaignType)}
          ${option("IOS14_CAMPAIGN", "iOS 14 Dedicated Campaign", campaign.campaignType)}
        </select></label>`
      : "";
  const catalogType = campaign.catalogEnabled
    ? `<label class="field"><span>Catalog type</span><select data-field="catalogType">
        ${option("ECOMMERCE", "E-commerce", campaign.catalogType)}
        ${option("TRAVEL_ENTERTAINMENT", "Travel and entertainment", campaign.catalogType)}
        ${option("MINI_SERIES", "Mini Series (allowlist only)", campaign.catalogType)}
      </select></label>`
    : "";
  const specialValue = !campaign.specialIndustriesConfirmed
    ? "NOT_CONFIRMED"
    : campaign.specialIndustries?.[0] || "NONE";

  root.innerHTML = `<article class="campaign-card edit-card">
    <header class="card-header">
      <div>
        <p class="eyebrow">TIKTOK AD CAMPAIGN · ${escapeHtml(reviewState.account.advertiserName)} · ${escapeHtml(reviewState.account.maskedAdvertiserId)}</p>
        <h1>Edit campaign proposal</h1>
      </div>
      <span class="tag tag-muted">Proposal v${reviewState.version}</span>
    </header>
    ${isDemo() ? '<div class="demo-banner" role="note"><strong>Interaction demo</strong><span>Edits create a new demo version only. No data is sent to TikTok.</span></div>' : ""}
    <form class="edit-form" data-edit-form>
      <label class="field field-wide"><span>Campaign name</span><input data-field="campaignName" value="${escapeHtml(campaign.campaignName)}" maxlength="512" required></label>
      <label class="field"><span>Campaign objective</span><select data-field="objectiveType" data-rerender>
        ${option("WEB_CONVERSIONS", "Website conversions", campaign.objectiveType)}
        ${option("LEAD_GENERATION", "Lead generation", campaign.objectiveType)}
        ${option("APP_PROMOTION", "App promotion", campaign.objectiveType)}
      </select></label>
      <label class="field"><span>Campaign budget optimization</span><select data-field="budgetOptimizeOn" data-rerender>
        ${option("true", "On", String(campaign.budgetOptimizeOn))}
        ${option("false", "Off", String(campaign.budgetOptimizeOn))}
      </select></label>
      <label class="field"><span>Budget type</span><select data-field="budgetMode" data-rerender>
        ${option("BUDGET_MODE_DYNAMIC_DAILY_BUDGET", "Dynamic daily budget", campaign.budgetMode)}
        ${option("BUDGET_MODE_TOTAL", "Total budget", campaign.budgetMode)}
        ${option("BUDGET_MODE_DAY", "Daily budget", campaign.budgetMode)}
        ${option("BUDGET_MODE_INFINITE", "Unlimited", campaign.budgetMode)}
      </select></label>
      <label class="field"><span>Campaign budget (${escapeHtml(reviewState.account.currency)})</span><input data-field="budget" type="number" min="0.01" step="0.01" value="${campaign.budget ?? ""}" ${budgetRequired ? "required" : "disabled"}></label>
      ${objectiveFields}
      <label class="field"><span>Catalog</span><select data-field="catalogEnabled" data-rerender>
        ${option("false", "Not used", String(campaign.catalogEnabled))}
        ${option("true", "Used", String(campaign.catalogEnabled))}
      </select></label>
      ${catalogType}
      <label class="field"><span>Special ad category</span><select data-field="specialIndustry">
        ${option("NOT_CONFIRMED", "Not confirmed", specialValue)}
        ${option("NONE", "None selected", specialValue)}
        ${option("HOUSING", "Housing", specialValue)}
        ${option("EMPLOYMENT", "Employment", specialValue)}
        ${option("CREDIT", "Credit", specialValue)}
      </select></label>
      <div class="fixed-status"><span>Status after creation</span><strong><span class="status-dot status-dot-active"></span>Active${isDemo() ? " · simulated" : ""}</strong><small>${isDemo() ? "Interaction demo only. No TikTok object will be created." : "This card creates the Campaign only. Delivery requires an eligible Ad Group and Ad."}</small></div>
    </form>
    <footer class="card-footer edit-footer">
      <p>${isDemo() ? "Applying changes creates a new demo proposal version. Confirm simulates submission only." : "Applying changes creates a new proposal version. Nothing is created in TikTok until you select Confirm."}</p>
      <div class="actions">
        <button class="button button-secondary" data-action="cancel" ${busy ? "disabled" : ""}>Cancel</button>
        <button class="button button-primary" data-action="apply" ${busy ? "disabled" : ""}>Apply changes</button>
      </div>
    </footer>
  </article>`;
  bindInteractions();
  notifySize();
}

function collectEditDraft() {
  const value = (name) => root.querySelector(`[data-field="${name}"]`)?.value;
  const specialIndustry = value("specialIndustry");
  return {
    campaignName: value("campaignName")?.trim() || "",
    objectiveType: value("objectiveType"),
    budget: value("budget") ? Number(value("budget")) : undefined,
    budgetMode: value("budgetMode"),
    budgetOptimizeOn: value("budgetOptimizeOn") === "true",
    salesDestination: value("objectiveType") === "WEB_CONVERSIONS" ? value("salesDestination") : undefined,
    catalogEnabled: value("catalogEnabled") === "true",
    catalogType: value("catalogEnabled") === "true" ? value("catalogType") : undefined,
    specialIndustries: specialIndustry && !["NONE", "NOT_CONFIRMED"].includes(specialIndustry) ? [specialIndustry] : [],
    specialIndustriesConfirmed: specialIndustry !== "NOT_CONFIRMED",
    appPromotionType: value("objectiveType") === "APP_PROMOTION" ? value("appPromotionType") : undefined,
    appId: value("objectiveType") === "APP_PROMOTION" ? value("appId")?.trim() || undefined : undefined,
    campaignType: value("objectiveType") === "APP_PROMOTION" ? value("campaignType") : "REGULAR_CAMPAIGN",
    aiSuggestedFields: []
  };
}

async function invoke(name, args) {
  busy = true;
  render();
  try {
    const result = await callTool(name, args);
    const next = extractReviewState(result);
    if (!next) throw new Error("Campaign Review returned no state.");
    applyState(next);
  } catch (error) {
    reviewState = {
      ...reviewState,
      status: "error",
      readyToCreate: false,
      execution: {
        ...(reviewState.execution || {}),
        status: "failed",
        errorCode: "HOST_TOOL_CALL_FAILED",
        errorMessage: error instanceof Error ? error.message : "Campaign Review action failed."
      }
    };
    editMode = false;
  } finally {
    busy = false;
    render();
  }
}

async function refreshStatus() {
  if (!reviewState?.proposalId || busy || editMode || ["created", "outdated"].includes(reviewState.status)) return;
  try {
    const result = await callTool(actionTool("status"), {
      proposalId: reviewState.proposalId,
      expectedVersion: reviewState.version
    });
    const next = extractReviewState(result);
    if (next && JSON.stringify(next) !== JSON.stringify(reviewState)) {
      applyState(next);
      render();
    }
  } catch {
    // Stale-state refresh is best-effort; every write is still checked by the server.
  }
}

function scheduleStatusRefresh() {
  if (statusRefreshTimer) window.clearTimeout(statusRefreshTimer);
  statusRefreshTimer = null;
  const delay = ["creating", "checking"].includes(reviewState?.status)
    ? 500
    : ["proposed", "error", "outcome_unknown"].includes(reviewState?.status)
      ? 3000
      : undefined;
  if (!delay) return;
  statusRefreshTimer = window.setTimeout(async () => {
    await refreshStatus();
    scheduleStatusRefresh();
  }, delay);
}

function bindInteractions() {
  root.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
    editMode = true;
    editDraft = { ...reviewState.campaign };
    render();
    root.querySelector('[data-field="campaignName"]')?.focus();
  });
  root.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
    editMode = false;
    editDraft = null;
    render();
  });
  root.querySelector('[data-action="apply"]')?.addEventListener("click", async () => {
    const form = root.querySelector("[data-edit-form]");
    if (!form?.reportValidity()) return;
    await invoke(actionTool("revise"), {
      proposalId: reviewState.proposalId,
      expectedVersion: reviewState.version,
      ...collectEditDraft()
    });
  });
  root.querySelector('[data-action="create"]')?.addEventListener("click", async () => {
    await invoke(actionTool("submit"), {
      proposalId: reviewState.proposalId,
      expectedVersion: reviewState.version,
      confirmed: true
    });
  });
  root.querySelector('[data-action="check-status"]')?.addEventListener("click", async () => {
    await invoke(actionTool("status"), {
      proposalId: reviewState.proposalId,
      expectedVersion: reviewState.version
    });
  });
  root.querySelector('[data-action="connect"]')?.addEventListener("click", async (event) => {
    const url = event.currentTarget?.dataset?.url;
    if (!url) return;
    try {
      if (initialized) await rpc("ui/open-link", { url });
      else if (window.openai?.openExternal) await window.openai.openExternal({ href: url });
    } catch {
      // The authorization URL remains in tool state so the host can expose it as a fallback.
    }
  });
  root.querySelectorAll("[data-rerender]").forEach((control) => {
    control.addEventListener("change", () => {
      editDraft = collectEditDraft();
      render();
    });
  });
}

function render() {
  if (!reviewState) return;
  if (editMode) renderEdit();
  else renderReview();
  scheduleStatusRefresh();
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
    const next = extractReviewState(message.params);
    if (applyState(next)) render();
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
  if (applyState(next)) render();
});
window.addEventListener("focus", refreshStatus);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshStatus();
});

reviewState = readChatGptState() || window.__CAMPAIGN_REVIEW_PREVIEW_STATE__ || createPreviewState();
sendInitialize();
render();
