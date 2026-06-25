const root = document.getElementById("app-root") || document.getElementById("app");
const APP_INFO = { name: "Hooray TikTok Ads Workspace", version: "0.2.1" };
const PROTOCOL_VERSION = "2025-11-21";

let initializeRequestId = null;
let initializedWithHost = false;
let currentState = null;
let isActionPending = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sentenceCase(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value || "";
  }
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function encodeAction(action) {
  return encodeURIComponent(JSON.stringify(action || {}));
}

function decodeAction(value) {
  try {
    return JSON.parse(decodeURIComponent(value || ""));
  } catch {
    return {};
  }
}

function getSelectedCandidate(state) {
  const candidates = state.storeDiscovery?.candidates || [];
  return candidates.find((candidate) => candidate.id === state.storeDiscovery?.selectedCandidateId) || candidates[0] || null;
}

function getSelectedStoryboardIndex(state) {
  const value = Number(state.uiSelection?.selectedStoryboardIndex ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function productActionArgs(state, feedback) {
  const product = state.product || {};
  const landingPageUrl = product.destination;

  if (!product.title || !isValidUrl(landingPageUrl)) return null;

  return {
    productTitle: product.title,
    productDescription:
      feedback ||
      product.creativeBriefHook ||
      product.creativeBriefTitle ||
      `Storyboard for ${product.title}`,
    landingPageUrl,
    ...(feedback ? { feedback } : {})
  };
}

function actionForPrimary(state) {
  if (state.storeDiscovery?.status === "loading") return null;
  if (state.storeDiscovery?.status === "ready") return { type: "use_store_candidate" };
  if (state.screen === "product" && !state.product) return { type: "ask_for_link" };
  if (state.screen === "product") return { type: "confirm_product" };
  if (state.screen === "creative") return { type: "approve_storyboard" };
  if (state.screen === "render" && !state.videoPreview) return { type: "check_render_status" };
  if (state.screen === "render") return { type: "approve_preview" };
  if (["onboarding", "accounts"].includes(state.screen || "")) return { type: "continue_account_setup" };
  if (["draft", "publish"].includes(state.screen || "")) return { type: "approve_launch_settings" };
  if (state.screen === "reporting") return { type: "save_reporting_plan" };
  return null;
}

function actionForSecondary(state) {
  if (state.storeDiscovery?.status === "ready") return { type: "rescan_store" };
  if (state.screen === "product" && state.product) return { type: "edit_product_details" };
  if (state.screen === "creative") return { type: "regenerate_storyboard" };
  if (state.screen === "render") return { type: "edit_storyboard" };
  if (["onboarding", "accounts"].includes(state.screen || "")) return { type: "change_account" };
  if (["draft", "publish"].includes(state.screen || "")) return { type: "edit_campaign_details" };
  return null;
}

function renderActionButton(action, label, kind = "primary") {
  const disabled = !action || isActionPending;
  return `<button class="btn ${escapeHtml(kind)}" type="button" ${disabled ? "disabled" : `data-action="${encodeAction(action)}"`}>${escapeHtml(label)}</button>`;
}

function getFlowState(state = {}) {
  const screen = state.screen || "product";
  const isAuth = state.auth?.status === "needs_authorization";
  const accountSkipped = Boolean(state.accountSetup?.skipped);

  let active = 0;
  if (["creative"].includes(screen)) active = 1;
  if (["render"].includes(screen)) active = 2;
  if (["onboarding", "accounts"].includes(screen) || isAuth) active = 3;
  if (["draft", "publish", "reporting"].includes(screen)) active = 4;

  const productCaption = state.storeDiscovery?.status === "loading" ? "Find products" : state.storeDiscovery?.status === "ready" ? "Pick product" : "Confirm item";

  const base = [
    { key: "Product", caption: productCaption },
    { key: "Storyboard", caption: "Pick direction" },
    { key: "Preview", caption: "See video" },
    { key: "Account setup", caption: accountSkipped ? "Already ready" : "Connect accounts" },
    { key: "Review", caption: "Approve spend" }
  ];

  return base.map((step, index) => ({
    ...step,
    index,
    status: index < active ? "done" : index === active ? "active" : "todo",
    skipped: index === 3 && accountSkipped
  }));
}

function renderRail(state) {
  const steps = getFlowState(state);
  return `
    <aside class="rail" aria-label="Launch path">
      <div class="rail-title">Launch path</div>
      <div class="steps">
        ${steps
          .map(
            (step) => `
              <div class="step ${escapeHtml(step.status)} ${step.skipped ? "skipped" : ""}">
                <div class="step-index">${step.status === "done" || step.skipped ? "✓" : step.index + 1}</div>
                <div>
                  <strong>${escapeHtml(step.key)}</strong>
                  <span>${escapeHtml(step.caption)}</span>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </aside>
  `;
}

function getCrumb(state) {
  const active = getFlowState(state).find((step) => step.status === "active") || getFlowState(state)[0];
  return `Step ${active.index + 1} of 5 · ${active.key}`;
}

function getNextNote(state) {
  if (state.storeDiscovery?.status === "loading") return "Next: choose one product to promote.";
  if (state.storeDiscovery?.status === "ready") return "Next: confirm the selected product page and images.";
  if (state.screen === "product" && !state.product) return "";
  if (state.screen === "product") return "Next: choose the story before account setup.";
  if (state.screen === "creative") return "Next: render a short preview from the selected story.";
  if (state.screen === "render" && !state.videoPreview) return "Next: check render status when the preview is ready.";
  if (state.screen === "render") return state.accountSetup?.skipped ? "Next: review campaign settings." : "Next: complete account setup before final review.";
  if (["onboarding", "accounts"].includes(state.screen || "") || state.auth?.status === "needs_authorization") return "Next: continue to review after accounts are ready.";
  if (["draft", "publish"].includes(state.screen || "")) return "Nothing goes live without this approval.";
  if (state.screen === "reporting") return "Reporting unlocks after publish.";
  return "";
}

function renderActions(state) {
  if (state.auth?.status === "needs_authorization" && state.auth.authorizationUrl) {
    return `
      <div class="panel-actions">
        <span class="next-note">${escapeHtml(getNextNote(state))}</span>
      </div>
    `;
  }

  const primary = state.primaryCta || "Continue";
  const secondary = state.secondaryCta || "";
  const primaryAction = actionForPrimary(state);
  const secondaryAction = actionForSecondary(state);

  return `
    <div class="panel-actions">
      <span class="next-note">${escapeHtml(getNextNote(state))}</span>
      <div class="button-row">
        ${secondary ? renderActionButton(secondaryAction, secondary, "secondary") : ""}
        ${renderActionButton(primaryAction, primary, "primary")}
      </div>
    </div>
  `;
}

function renderIntro() {
  return `
    <div class="intro-grid">
      <article class="choice-card selected">
        <div class="label">Product page</div>
        <h3>I have a product in mind</h3>
        <div class="input-block">
          <div class="label">Product URL</div>
          <strong>Paste a product link</strong>
        </div>
      </article>
      <article class="choice-card">
        <div class="label">Store</div>
        <h3>Help me choose a product</h3>
        <div class="input-block">
          <div class="label">Store URL</div>
          <strong>Paste your store link</strong>
        </div>
      </article>
    </div>
  `;
}

function renderStoreDiscovery(state) {
  const discovery = state.storeDiscovery;
  if (!discovery) return "";

  if (discovery.status === "loading") {
    return `
      <div class="store-loading-card">
        <div class="spinner" aria-hidden="true"></div>
        <div>
          <div class="label">Store URL</div>
          <div class="value">${escapeHtml(compactUrl(discovery.storeUrl))}</div>
          <div class="scan-list">
            <div class="scan-item"><span class="scan-dot"></span><span>Looking for featured, bestseller, and new arrival products.</span></div>
            <div class="scan-item"><span class="scan-dot"></span><span>Checking visual fit, offer clarity, and short-video potential.</span></div>
            <div class="scan-item"><span class="scan-dot"></span><span>Filtering out products that need risky claims or unclear landing pages.</span></div>
          </div>
          <div class="scan-preview-grid">
            <div class="scan-preview-card"></div>
            <div class="scan-preview-card"></div>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="product-pick-grid">
      ${(discovery.candidates || [])
        .map(
          (candidate) => `
            <article class="product-card ${candidate.id === discovery.selectedCandidateId ? "selected" : ""}" data-select-candidate="${escapeHtml(candidate.id)}">
              <div class="product-thumb" aria-hidden="true"></div>
              <div class="storyboard-top">
                <div>
                  <div class="label">${escapeHtml(candidate.recommendation)}</div>
                  <div class="storyboard-title">${escapeHtml(candidate.title)}</div>
                  <div class="meta">${escapeHtml(compactUrl(candidate.productUrl))}</div>
                </div>
                <span class="pill">${escapeHtml(candidate.confidence)}</span>
              </div>
              <ul class="reason-list">
                ${candidate.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
              </ul>
              <div class="hook-box">
                <div class="label">Best TikTok angle</div>
                <div class="value">${escapeHtml(candidate.angle)}</div>
              </div>
            </article>
          `
        )
        .join("")}
      <div class="chat-edit"><strong>Note:</strong> These are recommendations from your store page, not sales predictions.</div>
    </div>
  `;
}

function renderProductConfirm(state) {
  const product = state.product;
  if (!product) return renderIntro();

  return `
    <div class="summary-card">
      <div class="summary-row">
        <div>
          <div class="label">Product</div>
          <div class="value">${escapeHtml(product.title || "Promoted product")}</div>
        </div>
        ${product.imageCount !== undefined ? `<span class="pill">${escapeHtml(String(product.imageCount))} images found</span>` : ""}
      </div>
      <div class="summary-row">
        <div>
          <div class="label">Landing page</div>
          <div class="value link-value">${escapeHtml(compactUrl(product.destination))}</div>
        </div>
        <span class="meta">${escapeHtml(product.platform || "From product URL")}</span>
      </div>
      ${
        product.price && !String(product.price).toLowerCase().includes("pending")
          ? `<div class="summary-row">
              <div>
                <div class="label">Price</div>
                <div class="value">${escapeHtml(product.price)}</div>
              </div>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderStoryboard(state) {
  const selectedIndex = getSelectedStoryboardIndex(state);
  const angles = state.angles?.length
    ? state.angles.slice(0, 2)
    : [
        {
          title: state.product?.creativeBriefTitle || "Product demo",
          hook: state.product?.creativeBriefHook || "Show the product benefit quickly, then move into the CTA.",
          format: state.product?.creativeBriefFormat || "2-scene vertical ad",
          targetObjective: state.product?.creativeBriefObjective || "Website visits"
        },
        {
          title: "Creator testimonial",
          hook: "Open with a believable reason to care, then show the product in use.",
          format: "Creator-style short",
          targetObjective: "Landing page views"
        }
      ];

  return `
    <div class="storyboard-grid">
      ${angles
        .map(
          (angle, index) => `
            <article class="storyboard-card ${index === selectedIndex ? "selected" : ""}" data-select-storyboard="${index}">
              <div class="storyboard-top">
                <div>
                  <div class="label">Option ${index === 0 ? "A" : "B"}</div>
                  <div class="storyboard-title">${escapeHtml(angle.title)}</div>
                </div>
                ${index === 0 ? `<span class="pill">Recommended</span>` : `<span class="pill">Alternate</span>`}
              </div>
              <div class="hook-box">
                <div class="label">Hook</div>
                <div class="value">${escapeHtml(angle.hook)}</div>
              </div>
              <ul class="beat-list">
                <li><span class="time">0-2s</span><span>Open with the hook and product context.</span></li>
                <li><span class="time">2-7s</span><span>Show the product benefit with clear visuals.</span></li>
                <li><span class="time">7-12s</span><span>End with CTA and landing-page reason.</span></li>
              </ul>
              <div class="meta">Best for: ${escapeHtml(angle.targetObjective || "website visits")} · Format: ${escapeHtml(angle.format || "vertical video")}</div>
              <div class="story-actions">
                <button class="action-chip" type="button" data-action="${encodeAction({ type: "regenerate_storyboard", feedback: `Rewrite option ${index === 0 ? "A" : "B"} with a stronger first-two-second hook.` })}">Edit hook</button>
                <button class="action-chip" type="button" data-action="${encodeAction({ type: "edit_storyboard" })}">Swap image</button>
                <button class="action-chip" type="button" data-action="${encodeAction({ type: "regenerate_storyboard", feedback: `Change option ${index === 0 ? "A" : "B"} to use a clearer shop-now CTA.` })}">Change CTA</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
    <div class="chat-edit"><strong>Chat edit also works:</strong> “Make option B more premium,” “Use a stronger hook,” or “Replace scene 2 with the black bag image.”</div>
  `;
}

function renderRenderPending(state) {
  return `
    <div class="store-loading-card">
      <div class="spinner" aria-hidden="true"></div>
      <div>
        <div class="label">Video render</div>
        <div class="value">Rendering your preview...</div>
        <p class="body-note">We keep the selected storyboard and product context attached to this job. Nothing has been submitted to TikTok Ads.</p>
      </div>
    </div>
  `;
}

function renderVideoPreview(state) {
  const preview = state.videoPreview;
  if (!preview?.previewUrl) return renderRenderPending(state);

  return `
    <div class="summary-card preview-row preview-large">
      <div class="video-shell">
        <video class="video-player" controls playsinline preload="metadata" poster="${escapeHtml(preview.thumbnailUrl || "")}">
          <source src="${escapeHtml(preview.previewUrl)}" type="video/mp4">
          Your browser does not support video preview playback.
        </video>
      </div>
      <div class="inspector">
        <div class="label">Creative inspector</div>
        <div class="value">${escapeHtml(preview.durationSeconds || 12)}s vertical video · ${escapeHtml(state.product?.creativeBriefTitle || state.product?.title || "Generated preview")}</div>
        <div class="inspector-list">
          <div class="inspector-row"><span class="label">Hook</span><span>${escapeHtml(state.product?.creativeBriefHook || "Product benefit in the first seconds.")}</span></div>
          <div class="inspector-row"><span class="label">CTA</span><span>${escapeHtml(state.product?.creativeBriefObjective || "Shop now")}</span></div>
          <div class="inspector-row"><span class="label">Source</span><span>Product page images + approved storyboard</span></div>
          <div class="inspector-row"><span class="label">Status</span><span>Draft only · not live · no campaign created</span></div>
        </div>
        <div class="asset-actions">
          <button class="action-chip" type="button" data-action="${encodeAction({ type: "create_another_video" })}">Create another video</button>
        </div>
      </div>
    </div>
    <div class="chat-edit"><strong>Chat also works:</strong> “Create another version with a faster opening,” or “Make the video feel more premium.”</div>
  `;
}

function accountRowsFromState(state) {
  if (state.accountSetup?.requirements?.length) return state.accountSetup.requirements;

  return [
    { id: "tt4b", label: "TikTok for Business", status: state.auth?.status === "needs_authorization" ? "missing" : "ready" },
    { id: "business_center", label: "Business Center", status: state.accounts?.length ? "ready" : "missing" },
    { id: "advertiser_account", label: "Advertiser Account", status: state.accounts?.length ? "ready" : "missing" },
    { id: "tiktok_account", label: "TikTok Account", status: state.identities?.length ? "ready" : "missing" }
  ];
}

function renderAccountSetup(state) {
  if (state.auth?.status === "needs_authorization" && state.auth.authorizationUrl) {
    return `
      <div class="auth-panel">
        <div>
          <div class="label">TikTok authorization</div>
          <div class="value">Connect TikTok Ads before this app touches campaign setup.</div>
          <p class="body-note">Open the authorization flow, finish approval, then return to this same ChatGPT session.</p>
        </div>
        <a class="btn primary auth-link" href="${escapeHtml(state.auth.authorizationUrl)}" target="_blank" rel="noreferrer">Authorize TikTok Ads</a>
      </div>
    `;
  }

  return `
    <div class="status-list">
      ${accountRowsFromState(state)
        .map(
          (row) => `
            <div class="status-row">
              <div>
                <div class="status-name">${escapeHtml(row.label)}</div>
                <div class="status-detail">${escapeHtml(row.id === "tt4b" ? "TT4B business login for TikTok Ads" : row.id === "business_center" ? "Business Center manages assets and permissions" : row.id === "advertiser_account" ? "Ad account that owns campaign drafts" : "TikTok profile connected as the ad identity")}</div>
              </div>
              <span class="status-badge ${row.status === "missing" ? "warn" : ""}">${row.status === "ready" ? "Ready" : "Missing"}</span>
            </div>
          `
        )
        .join("")}
    </div>
    ${renderAdvertiserAccounts(state)}
  `;
}

function renderAdvertiserAccounts(state) {
  if (!state.accounts?.length) return "";

  return `
    <div class="account-list">
      ${state.accounts
        .slice(0, 3)
        .map(
          (account) => `
            <article class="account-card">
              <div class="storyboard-top">
                <div>
                  <div class="label">${escapeHtml(account.advertiserRole || "Advertiser")}</div>
                  <div class="storyboard-title">${escapeHtml(account.advertiserName)}</div>
                  <div class="meta">${escapeHtml(account.bcName)} · ${escapeHtml(account.country)} · ${escapeHtml(account.currency)}</div>
                </div>
                <span class="pill">${escapeHtml(account.status)}</span>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function readDraftField(state, label, fallback) {
  const field = state.draft?.fields?.find((item) => item.label.toLowerCase() === label.toLowerCase());
  return field?.value || fallback;
}

function renderReview(state) {
  const budget = readDraftField(state, "Daily budget", "$50/day");
  const country = readDraftField(state, "Country", "United States");
  const goal = readDraftField(state, "Optimization goal", "Website visits");
  const campaignType = state.draft?.objective || "Smart+ traffic";

  return `
    <div class="summary-card preview-row">
      <div class="phone-thumb" aria-hidden="true"></div>
      <div>
        <div class="label">Preview ready</div>
        <div class="value">${escapeHtml(state.product?.creativeBriefTitle || "12s vertical video")} · Smart+ draft attached</div>
        <p class="meta">Weekly report: spend, clicks, CPC, conversions, creative fatigue.</p>
        <div class="asset-actions">
          <button class="action-chip" type="button" data-action="${encodeAction({ type: "edit_storyboard" })}">Edit video</button>
          <button class="action-chip" type="button" data-action="${encodeAction({ type: "edit_campaign_details", field: "budget" })}">Change budget</button>
          <button class="action-chip" type="button" data-action="${encodeAction({ type: "edit_campaign_details", field: "report" })}">Edit report</button>
        </div>
      </div>
    </div>
    <div class="review-grid">
      <div class="mini-grid-card"><div class="label">Campaign type</div><div class="value">${escapeHtml(campaignType)}</div></div>
      <div class="mini-grid-card"><div class="label">Goal</div><div class="value">${escapeHtml(goal)}</div></div>
      <div class="mini-grid-card"><div class="label">Market</div><div class="value">${escapeHtml(country)}</div></div>
      <div class="mini-grid-card"><div class="label">Budget</div><div class="value">${escapeHtml(budget)}</div></div>
    </div>
    ${
      state.draft?.warnings?.length
        ? `<div class="chat-edit"><strong>Before publish:</strong> ${state.draft.warnings.map(escapeHtml).join(" ")}</div>`
        : `<div class="chat-edit"><strong>Chat edit also works:</strong> “Lower budget to $30/day,” “Pause reporting for now,” or “Make the video more luxury.”</div>`
    }
  `;
}

function renderReporting(state) {
  const metrics = state.reportPlan?.metrics || ["spend", "clicks", "CTR", "conversions"];
  return `
    <div class="summary-card">
      <div class="summary-row">
        <div>
          <div class="label">Reporting</div>
          <div class="value">${escapeHtml(state.reportPlan?.cadence || "Weekly")} ${escapeHtml(state.reportPlan?.delivery || "ChatGPT digest")}</div>
        </div>
        <span class="pill">${escapeHtml(state.reportPlan?.focus || "conversion")}</span>
      </div>
      <div class="summary-row">
        <div>
          <div class="label">Metrics</div>
          <div class="value">${metrics.map(escapeHtml).join(" · ")}</div>
        </div>
      </div>
    </div>
  `;
}

function renderBody(state) {
  if (!state || !state.headline) return renderIntro();
  if (state.storeDiscovery) return renderStoreDiscovery(state);
  if (state.screen === "creative") return renderStoryboard(state);
  if (state.screen === "render") return renderVideoPreview(state);
  if (["onboarding", "accounts"].includes(state.screen) || state.auth?.status === "needs_authorization") return renderAccountSetup(state);
  if (["draft", "publish"].includes(state.screen)) return renderReview(state);
  if (state.screen === "reporting") return renderReporting(state);
  return renderProductConfirm(state);
}

function renderStateToElement(target, state) {
  if (!target) return;

  const safeState =
    state || {
      screen: "product",
      phaseLabel: "Start here",
      headline: "What do you want to promote?",
      summary: "",
      primaryCta: "Confirm"
    };

  target.innerHTML = `
    <main class="app-shell">
      <section class="browser">
        <div class="topbar">
          <div class="brand"><span class="brand-mark"></span>Hooray TikTok Ads</div>
        </div>
        <div class="workspace">
          <article class="panel">
            <div class="panel-head">
              <div class="crumb"><span class="crumb-dot"></span>${escapeHtml(getCrumb(safeState))}</div>
              <h1>${escapeHtml(safeState.headline || "What do you want to promote?")}</h1>
              ${safeState.summary ? `<p>${escapeHtml(safeState.summary)}</p>` : ""}
            </div>
            <div class="panel-body">
              ${renderBody(safeState)}
            </div>
            ${renderActions(safeState)}
          </article>
          ${renderRail(safeState)}
        </div>
      </section>
    </main>
  `;

  bindInteractions(target, safeState);
}

function renderState(state) {
  const uiActionToken = state?.uiActionToken || currentState?.uiActionToken;
  const nextState = state && uiActionToken ? { ...state, uiActionToken } : state || null;
  currentState = nextState;
  try {
    window.openai?.setWidgetState?.(nextState || null);
  } catch {
    // Host persistence is best-effort; local previews do not provide window.openai.
  }
  renderStateToElement(root, nextState);
}

function extractWidgetState(toolResult) {
  const widgetState =
    toolResult?.structuredContent?.widgetState ||
    toolResult?.result?.structuredContent?.widgetState ||
    toolResult?.mcp_tool_result?.structuredContent?.widgetState ||
    toolResult?.toolResult?.structuredContent?.widgetState ||
    toolResult?.widgetState ||
    null;
  const uiActionToken =
    toolResult?._meta?.uiActionToken ||
    toolResult?.result?._meta?.uiActionToken ||
    toolResult?.mcp_tool_result?._meta?.uiActionToken ||
    currentState?.uiActionToken;

  if (!widgetState) return null;
  return uiActionToken ? { ...widgetState, uiActionToken } : widgetState;
}

function readHostWidgetState() {
  const host = window.openai || {};
  const metadataState = extractWidgetState(host.toolResponseMetadata);
  const outputState = extractWidgetState({
    structuredContent: host.toolOutput,
    _meta:
      host.toolResponseMetadata?.mcp_tool_result?._meta ||
      host.toolResponseMetadata?.result?._meta ||
      host.toolResponseMetadata?._meta ||
      host.toolResponseMetadata
  });
  const persistedState = host.widgetState && typeof host.widgetState === "object" ? host.widgetState : null;

  return metadataState || outputState || persistedState || window.__POC_PREVIEW_STATE__ || null;
}

function showLocalMessage(message) {
  const panel = root?.querySelector(".panel-body");
  if (!panel) return;
  const existing = panel.querySelector(".local-action-note");
  if (existing) existing.remove();
  panel.insertAdjacentHTML("beforeend", `<div class="chat-edit local-action-note"><strong>Action:</strong> ${escapeHtml(message)}</div>`);
}

async function sendChatPrompt(prompt) {
  if (window.openai?.sendFollowUpMessage) {
    await window.openai.sendFollowUpMessage({ prompt });
    return;
  }
  showLocalMessage(prompt);
}

async function callToolAndRender(name, args) {
  if (!window.openai?.callTool) {
    showLocalMessage(`This button will call ${name} in ChatGPT. Local preview cannot execute MCP tools.`);
    return null;
  }

  isActionPending = true;
  renderState(currentState);

  try {
    const actionMeta = {
      userAction: "ui_click",
      ...(currentState?.uiActionToken ? { interactionToken: currentState.uiActionToken } : {})
    };
    const result = await window.openai.callTool(name, {
      ...(args || {}),
      ...actionMeta
    });
    const widgetState = extractWidgetState(result);
    if (widgetState) {
      renderState(widgetState);
    } else {
      showLocalMessage(`${name} completed, but did not return a widget state.`);
    }
    return result;
  } catch (error) {
    showLocalMessage(error instanceof Error ? error.message : `Could not run ${name}.`);
    return null;
  } finally {
    isActionPending = false;
    if (currentState) renderState(currentState);
  }
}

function campaignIdFromState(state) {
  const campaignField = state.draft?.fields?.find((field) => field.label.toLowerCase() === "campaign id");
  const campaignId = campaignField?.value;
  return campaignId && !campaignId.toLowerCase().includes("pending") ? campaignId : "";
}

async function handleAction(action, state) {
  if (!action?.type) return;

  if (action.type === "ask_for_link") {
    await sendChatPrompt("Please ask me for either a product URL or a store URL before continuing.");
    return;
  }

  if (action.type === "use_store_candidate") {
    const candidate = getSelectedCandidate(state);
    if (!candidate) {
      showLocalMessage("Select a product first.");
      return;
    }
    await callToolAndRender("override_product_details", {
      title: candidate.title,
      productUrl: candidate.productUrl,
      platform: "Store URL scan",
      notes: `Recommended as ${candidate.confidence}. Best TikTok angle: ${candidate.angle}`
    });
    return;
  }

  if (action.type === "rescan_store") {
    await callToolAndRender("scan_store_products", {
      storeUrl: state.storeDiscovery?.storeUrl || "https://yourstore.com",
      resultMode: "results"
    });
    return;
  }

  if (action.type === "confirm_product" || action.type === "regenerate_storyboard") {
    const args = productActionArgs(state, action.feedback || (action.type === "regenerate_storyboard" ? "Generate two fresh storyboard options." : undefined));
    if (!args) {
      await sendChatPrompt("Please confirm or edit the product title and product URL before making storyboards.");
      return;
    }
    await callToolAndRender("generate_storyboard", args);
    return;
  }

  if (action.type === "approve_storyboard") {
    await callToolAndRender("approve_ad_inputs", {
      approvedStoryboardVersion: `v${getSelectedStoryboardIndex(state) + 1}`,
      approvedImageCount: Math.max(1, Math.min(3, Number(state.product?.imageCount || 1))),
      approvalNotes: `User selected storyboard option ${getSelectedStoryboardIndex(state) + 1}.`
    });
    return;
  }

  if (action.type === "check_render_status") {
    const jobId = state.renderJob?.jobId || state.videoPreview?.jobId;
    if (!jobId) {
      showLocalMessage("Render job is missing. Approve a storyboard again to start video generation.");
      return;
    }
    await callToolAndRender("get_video_status", { jobId });
    return;
  }

  if (action.type === "create_another_video") {
    const approvalId = state.renderJob?.approvalId;
    if (!approvalId) {
      await sendChatPrompt("Create another video version from the approved storyboard.");
      return;
    }
    await callToolAndRender("generate_video", {
      approvalId,
      renderingStyle: "product_demo"
    });
    return;
  }

  if (action.type === "approve_preview") {
    await callToolAndRender("get_ad_accounts", {});
    return;
  }

  if (action.type === "continue_account_setup") {
    await callToolAndRender("get_ad_accounts", {});
    return;
  }

  if (action.type === "approve_launch_settings") {
    const campaignId = campaignIdFromState(state);
    if (!campaignId) {
      await sendChatPrompt("Create a Smart+ draft before approving launch settings.");
      return;
    }
    await callToolAndRender("approve_campaign_parameters", { campaignId });
    return;
  }

  if (action.type === "save_reporting_plan") {
    await sendChatPrompt("Save this reporting plan for the campaign.");
    return;
  }

  if (action.type === "edit_product_details") {
    await sendChatPrompt("I want to edit the product details before storyboarding.");
    return;
  }

  if (action.type === "edit_storyboard") {
    await sendChatPrompt("I want to edit this storyboard/video before continuing.");
    return;
  }

  if (action.type === "change_account") {
    await sendChatPrompt("I want to choose a different TikTok advertiser account.");
    return;
  }

  if (action.type === "edit_campaign_details") {
    await sendChatPrompt(`I want to edit ${action.field || "campaign details"} before launch.`);
  }
}

function bindInteractions(target, state) {
  target.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", () => {
      handleAction(decodeAction(element.getAttribute("data-action")), currentState || state);
    });
  });

  target.querySelectorAll("[data-select-candidate]").forEach((element) => {
    element.addEventListener("click", () => {
      const candidateId = element.getAttribute("data-select-candidate");
      if (!candidateId || !currentState?.storeDiscovery) return;
      renderState({
        ...currentState,
        storeDiscovery: {
          ...currentState.storeDiscovery,
          selectedCandidateId: candidateId
        }
      });
    });
  });

  target.querySelectorAll("[data-select-storyboard]").forEach((element) => {
    element.addEventListener("click", () => {
      const selectedStoryboardIndex = Number(element.getAttribute("data-select-storyboard") || 0);
      renderState({
        ...(currentState || state),
        uiSelection: {
          ...((currentState || state).uiSelection || {}),
          selectedStoryboardIndex
        }
      });
    });
  });
}

function maybeReadToolResult(message) {
  if (!message || message.jsonrpc !== "2.0") return null;
  if (message.method !== "ui/notifications/tool-result") return null;
  const widgetState = message.params?.structuredContent?.widgetState || message.params?._meta?.widgetState || null;
  const uiActionToken = message.params?._meta?.uiActionToken || currentState?.uiActionToken;
  if (!widgetState) return null;
  return uiActionToken ? { ...widgetState, uiActionToken } : widgetState;
}

function postToHost(message) {
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ jsonrpc: "2.0", ...message }, "*");
}

function sendInitialize() {
  if (initializedWithHost || initializeRequestId || !window.parent || window.parent === window) return;

  initializeRequestId = `init-${Date.now()}-${Math.random().toString(16).slice(2)}`;

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

function maybeHandleInitializeResponse(message) {
  if (!message || message.jsonrpc !== "2.0") return false;
  if (!initializeRequestId || message.id !== initializeRequestId || !message.result) return false;

  initializedWithHost = true;
  initializeRequestId = null;

  postToHost({
    method: "ui/notifications/initialized",
    params: {}
  });

  return true;
}

function maybeHandleTeardownRequest(message) {
  if (!message || message.jsonrpc !== "2.0") return false;
  if (message.method !== "ui/resource-teardown" || message.id === undefined || message.id === null) return false;

  postToHost({
    id: message.id,
    result: {}
  });

  return true;
}

window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window.parent) return;
    if (maybeHandleInitializeResponse(event.data)) return;
    if (maybeHandleTeardownRequest(event.data)) return;
    const state = maybeReadToolResult(event.data);
    if (state) renderState(state);
  },
  { passive: true }
);

window.addEventListener(
  "openai:set_globals",
  () => {
    const state = readHostWidgetState();
    if (state) renderState(state);
  },
  { passive: true }
);

sendInitialize();
renderState(readHostWidgetState());
