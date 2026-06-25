const root = document.getElementById("app-root") || document.getElementById("app");
const APP_INFO = { name: "Hooray TikTok Ads Workspace", version: "0.2.3" };
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

function getSelectedAccount(state) {
  const accounts = state.accounts || [];
  return accounts.find((account) => account.advertiserId === state.uiSelection?.selectedAdvertiserId) || accounts[0] || null;
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

function draftInputState(state = {}) {
  const draft = state.uiDraft || {};
  const mode = draft.mode === "store" ? "store" : "product";
  return {
    mode,
    productUrl: draft.productUrl || "",
    storeUrl: draft.storeUrl || ""
  };
}

function readDraftFromDom(state = {}) {
  const draft = draftInputState(state);
  const selectedMode =
    root?.querySelector(".choice-card.selected[data-start-mode]")?.getAttribute("data-start-mode") ||
    draft.mode;

  root?.querySelectorAll("[data-draft-url]").forEach((input) => {
    const key = input.getAttribute("data-draft-url");
    if (key === "product") draft.productUrl = input.value.trim();
    if (key === "store") draft.storeUrl = input.value.trim();
  });

  return {
    ...draft,
    mode: selectedMode === "store" ? "store" : "product"
  };
}

function readProductFromDom(state = {}) {
  const product = { ...(state.product || {}) };
  root?.querySelectorAll("[data-product-field]").forEach((input) => {
    const field = input.getAttribute("data-product-field");
    const value = input.value.trim();
    if (field === "title") product.title = value;
    if (field === "destination") product.destination = value;
    if (field === "price") product.price = value;
  });
  return product;
}

function readStoryboardFromDom(state = {}) {
  const angles = (state.angles || []).map((angle) => ({ ...angle }));
  root?.querySelectorAll("[data-storyboard-field]").forEach((input) => {
    const index = Number(input.getAttribute("data-storyboard-index") || 0);
    const field = input.getAttribute("data-storyboard-field");
    if (!angles[index] || !field) return;
    angles[index][field] = input.value.trim();
  });
  return angles;
}

function readPreviewEditsFromDom(state = {}) {
  const product = { ...(state.product || {}) };
  root?.querySelectorAll("[data-preview-field]").forEach((input) => {
    const field = input.getAttribute("data-preview-field");
    const value = input.value.trim();
    if (field === "creativeBriefTitle") product.creativeBriefTitle = value;
    if (field === "creativeBriefHook") product.creativeBriefHook = value;
    if (field === "creativeBriefObjective") product.creativeBriefObjective = value;
  });
  return product;
}

function makeDraftFromReviewDom(state = {}) {
  const productTitle = state.product?.title || "Product";
  return {
    name: `${productTitle} | Smart+`,
    objective: "Smart+ traffic",
    fields: [
      { label: "Daily budget", value: "$50", editable: true },
      { label: "Country", value: "US", editable: true },
      { label: "Optimization goal", value: "Clicks", editable: true },
      { label: "Bidding strategy", value: "Maximum delivery", editable: true }
    ],
    warnings: []
  };
}

function readReviewDraftFromDom(state = {}) {
  const hasReviewInputs = Boolean(root?.querySelector("[data-review-field], [data-review-campaign-name]"));
  const draft = state.draft
    ? {
        ...state.draft,
        fields: (state.draft.fields || []).map((field) => ({ ...field }))
      }
    : hasReviewInputs
      ? makeDraftFromReviewDom(state)
      : null;
  if (!draft) return draft;

  root?.querySelectorAll("[data-review-field]").forEach((input) => {
    const label = input.getAttribute("data-review-field");
    let field = draft.fields.find((item) => item.label === label);
    if (!field && label) {
      field = { label, value: "", editable: true };
      draft.fields.push(field);
    }
    if (field) field.value = input.value.trim();
  });

  const nameInput = root?.querySelector("[data-review-campaign-name]");
  if (nameInput) draft.name = nameInput.value.trim();
  return draft;
}

function hydrateEditableState(state = {}) {
  const nextState = { ...(state || {}) };
  nextState.uiDraft = readDraftFromDom(nextState);
  if (nextState.product) nextState.product = readProductFromDom(nextState);
  if (nextState.angles?.length) nextState.angles = readStoryboardFromDom(nextState);
  if (nextState.screen === "render" && nextState.product) nextState.product = readPreviewEditsFromDom(nextState);
  const reviewDraft = readReviewDraftFromDom(nextState);
  if (reviewDraft) nextState.draft = reviewDraft;
  return nextState;
}

function persistStateWithoutRender(nextState) {
  currentState = nextState;
  try {
    window.openai?.setWidgetState?.(nextState || null);
  } catch {
    // Host persistence is best-effort.
  }
}

function actionForPrimary(state) {
  if (state.storeDiscovery?.status === "loading") return null;
  if (state.storeDiscovery?.status === "ready") return { type: "use_store_candidate" };
  if (state.screen === "product" && !state.product) return { type: "confirm_start_input" };
  if (state.screen === "product") return { type: "confirm_product" };
  if (state.screen === "creative") return { type: "approve_storyboard" };
  if (state.screen === "render" && !state.videoPreview) return { type: "check_render_status" };
  if (state.screen === "render") return { type: "approve_preview" };
  if (["onboarding", "accounts"].includes(state.screen || "")) {
    if (state.accounts?.length) return { type: "verify_selected_account" };
    return { type: "continue_account_setup" };
  }
  if (state.screen === "draft") {
    if (state.publish?.approvalId || state.uiSelection?.campaignApprovalId) return { type: "publish_campaign" };
    if (state.primaryCta === "Create Smart+ draft" || !campaignIdFromState(state)) return { type: "create_smartplus_draft" };
    return { type: "approve_launch_settings" };
  }
  if (state.screen === "publish") return { type: "save_reporting_plan" };
  if (state.screen === "reporting") return { type: "save_reporting_plan" };
  return null;
}

function actionForSecondary(state) {
  if (state.storeDiscovery?.status === "ready") return { type: "rescan_store" };
  if (state.screen === "creative") return { type: "regenerate_storyboard" };
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
        ${secondary && secondaryAction ? renderActionButton(secondaryAction, secondary, "secondary") : ""}
        ${renderActionButton(primaryAction, primary, "primary")}
      </div>
    </div>
  `;
}

function renderIntro(state = {}) {
  const draft = draftInputState(state);
  return `
    <div class="intro-grid">
      <article class="choice-card ${draft.mode === "product" ? "selected" : ""}" data-start-mode="product">
        <div class="label">Product page</div>
        <h3>I have a product in mind</h3>
        <div class="input-block">
          <label class="field-label" for="product-url-input">Product URL</label>
          <input id="product-url-input" class="url-input" data-draft-url="product" type="url" inputmode="url" placeholder="https://example.com/product" value="${escapeHtml(draft.productUrl)}">
        </div>
      </article>
      <article class="choice-card ${draft.mode === "store" ? "selected" : ""}" data-start-mode="store">
        <div class="label">Store</div>
        <h3>Help me choose a product</h3>
        <div class="input-block">
          <label class="field-label" for="store-url-input">Store URL</label>
          <input id="store-url-input" class="url-input" data-draft-url="store" type="url" inputmode="url" placeholder="https://example.com" value="${escapeHtml(draft.storeUrl)}">
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
  if (!product) return renderIntro(state);

  return `
    <div class="summary-card">
      <div class="summary-row">
        <div>
          <label class="field-label" for="product-title-field">Product</label>
          <input id="product-title-field" class="text-input product-edit-input" data-product-field="title" type="text" value="${escapeHtml(product.title || "Promoted product")}">
        </div>
        ${product.imageCount !== undefined ? `<span class="pill">${escapeHtml(String(product.imageCount))} images found</span>` : ""}
      </div>
      <div class="summary-row">
        <div>
          <label class="field-label" for="product-url-field">Landing page</label>
          <input id="product-url-field" class="text-input product-edit-input" data-product-field="destination" type="url" inputmode="url" value="${escapeHtml(product.destination || "")}">
        </div>
        <span class="meta">${escapeHtml(product.platform || "From product URL")}</span>
      </div>
      <div class="summary-row">
        <div>
          <label class="field-label" for="product-price-field">Price</label>
          <input id="product-price-field" class="text-input product-edit-input" data-product-field="price" type="text" placeholder="Optional" value="${escapeHtml(product.price && !String(product.price).toLowerCase().includes("pending") ? product.price : "")}">
        </div>
      </div>
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
                  <input class="text-input storyboard-edit-input" data-storyboard-index="${index}" data-storyboard-field="title" type="text" value="${escapeHtml(angle.title)}" aria-label="Storyboard option ${index === 0 ? "A" : "B"} title">
                </div>
                ${index === 0 ? `<span class="pill">Recommended</span>` : `<span class="pill">Alternate</span>`}
              </div>
              <div class="hook-box">
                <label class="field-label">Hook</label>
                <textarea class="textarea-input storyboard-edit-input" data-storyboard-index="${index}" data-storyboard-field="hook" rows="3">${escapeHtml(angle.hook)}</textarea>
              </div>
              <ul class="beat-list">
                <li><span class="time">0-2s</span><span>Open with the hook and product context.</span></li>
                <li><span class="time">2-7s</span><span>Show the product benefit with clear visuals.</span></li>
                <li><span class="time">7-12s</span><span>End with CTA and landing-page reason.</span></li>
              </ul>
              <div class="inline-fields">
                <label>
                  <span class="field-label">CTA / goal</span>
                  <input class="text-input compact-input storyboard-edit-input" data-storyboard-index="${index}" data-storyboard-field="targetObjective" type="text" value="${escapeHtml(angle.targetObjective || "Website visits")}">
                </label>
                <label>
                  <span class="field-label">Format</span>
                  <input class="text-input compact-input storyboard-edit-input" data-storyboard-index="${index}" data-storyboard-field="format" type="text" value="${escapeHtml(angle.format || "vertical video")}">
                </label>
              </div>
              <div class="story-actions">
                <button class="action-chip" type="button" data-action="${encodeAction({ type: "regenerate_storyboard", feedback: `Rewrite option ${index === 0 ? "A" : "B"} with a stronger first-two-second hook.` })}">Edit hook</button>
                <button class="action-chip" type="button" data-action="${encodeAction({ type: "regenerate_storyboard", feedback: `Change option ${index === 0 ? "A" : "B"} to use a clearer shop-now CTA.` })}">Change CTA</button>
              </div>
            </article>
          `
        )
        .join("")}
    </div>
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
        <label class="field-label" for="preview-title-field">Video title</label>
        <input id="preview-title-field" class="text-input product-edit-input" data-preview-field="creativeBriefTitle" type="text" value="${escapeHtml(state.product?.creativeBriefTitle || state.product?.title || "Generated preview")}">
        <div class="inspector-list">
          <div class="inspector-row inspector-edit-row">
            <label class="field-label" for="preview-hook-field">Hook</label>
            <textarea id="preview-hook-field" class="textarea-input compact-textarea" data-preview-field="creativeBriefHook" rows="3">${escapeHtml(state.product?.creativeBriefHook || "Product benefit in the first seconds.")}</textarea>
          </div>
          <div class="inspector-row inspector-edit-row">
            <label class="field-label" for="preview-cta-field">CTA</label>
            <input id="preview-cta-field" class="text-input compact-input" data-preview-field="creativeBriefObjective" type="text" value="${escapeHtml(state.product?.creativeBriefObjective || "Shop now")}">
          </div>
          <div class="inspector-row"><span class="label">Length</span><span>${escapeHtml(preview.durationSeconds || 12)}s vertical video</span></div>
          <div class="inspector-row"><span class="label">Source</span><span>Product page images + approved storyboard</span></div>
          <div class="inspector-row"><span class="label">Status</span><span>Draft only · not live · no campaign created</span></div>
        </div>
        <div class="asset-actions">
          <button class="action-chip" type="button" data-action="${encodeAction({ type: "create_another_video" })}">Create another video</button>
        </div>
      </div>
    </div>
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
          (account, index) => `
            <article class="account-card ${account.advertiserId === state.uiSelection?.selectedAdvertiserId || (!state.uiSelection?.selectedAdvertiserId && index === 0) ? "selected" : ""}" data-select-account="${escapeHtml(account.advertiserId)}">
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
  const campaignName = state.draft?.name || `${state.product?.title || "Product"} | Smart+`;

  return `
    <div class="summary-card preview-row">
      <div class="phone-thumb" aria-hidden="true"></div>
      <div>
        <div class="label">Preview ready</div>
        <div class="value">${escapeHtml(state.product?.creativeBriefTitle || "12s vertical video")} · Smart+ draft attached</div>
        <p class="meta">Review the campaign details below before any spend starts.</p>
      </div>
    </div>
    <div class="review-grid">
      <label class="mini-grid-card editable-mini-card">
        <span class="field-label">Campaign name</span>
        <input class="text-input compact-input" data-review-campaign-name type="text" value="${escapeHtml(campaignName)}">
      </label>
      <div class="mini-grid-card"><div class="label">Campaign type</div><div class="value">${escapeHtml(campaignType)}</div></div>
      <label class="mini-grid-card editable-mini-card">
        <span class="field-label">Landing page</span>
        <input class="text-input compact-input" data-product-field="destination" type="url" inputmode="url" value="${escapeHtml(state.product?.destination || "")}">
      </label>
      <label class="mini-grid-card editable-mini-card">
        <span class="field-label">Goal</span>
        <input class="text-input compact-input" data-review-field="Optimization goal" type="text" value="${escapeHtml(goal)}">
      </label>
      <label class="mini-grid-card editable-mini-card">
        <span class="field-label">Market</span>
        <input class="text-input compact-input" data-review-field="Country" type="text" value="${escapeHtml(country)}">
      </label>
      <label class="mini-grid-card editable-mini-card">
        <span class="field-label">Budget</span>
        <input class="text-input compact-input" data-review-field="Daily budget" type="text" value="${escapeHtml(budget)}">
      </label>
    </div>
    ${
      state.draft?.warnings?.length
        ? `<div class="chat-edit"><strong>Before publish:</strong> ${state.draft.warnings.map(escapeHtml).join(" ")}</div>`
        : ""
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
  notifyHostHeight();
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

function notifyHostHeight() {
  if (!window.openai?.notifyIntrinsicHeight) return;
  const run = () => {
    const height = Math.ceil(
      root?.getBoundingClientRect?.().height ||
        document.documentElement?.scrollHeight ||
        document.body?.scrollHeight ||
        0
    );
    try {
      window.openai.notifyIntrinsicHeight({ height });
    } catch {
      // Some hosts expose a no-argument notifier instead.
    }
    try {
      window.openai.notifyIntrinsicHeight();
    } catch {
      // Height reporting is best-effort.
    }
  };

  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

function campaignIdFromState(state) {
  const campaignField = state.draft?.fields?.find((field) => field.label.toLowerCase() === "campaign id");
  const campaignId = campaignField?.value;
  return campaignId && !campaignId.toLowerCase().includes("pending") ? campaignId : "";
}

function draftFieldValue(state, label, fallback = "") {
  const field = state.draft?.fields?.find((item) => item.label.toLowerCase() === label.toLowerCase());
  return field?.value || fallback;
}

function parseBudget(value) {
  const amount = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 50;
}

function normalizeCountryCode(value) {
  const trimmed = String(value || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  if (trimmed.includes("UNITED STATES") || trimmed === "USA") return "US";
  if (trimmed.includes("CANADA")) return "CA";
  return "US";
}

function createSmartPlusArgsFromState(state) {
  const selectedAccount = getSelectedAccount(state);
  const advertiserId = state.accountSetup?.selectedAdvertiserId || selectedAccount?.advertiserId;
  const productUrl = state.product?.destination;
  const generatedVideoJobId = state.renderJob?.jobId || state.videoPreview?.jobId;
  const campaignName = state.draft?.name || `${state.product?.title || "Product"} | Smart+`;
  const goal = draftFieldValue(state, "Optimization goal", "Clicks");
  const bidding = draftFieldValue(state, "Bidding strategy", "Maximum delivery");

  if (!advertiserId || !productUrl || !generatedVideoJobId) return null;

  return {
    advertiserId,
    productUrl,
    generatedVideoJobId,
    campaignName,
    targetCountryCode: normalizeCountryCode(draftFieldValue(state, "Country", "US")),
    adgroupDailyBudget: parseBudget(draftFieldValue(state, "Daily budget", "$50")),
    optimizationGoal: /landing/i.test(goal) ? "landing_page_views" : "clicks",
    biddingStrategy: /cost/i.test(bidding) ? "cost_cap" : "maximum_delivery",
    ...(state.accountSetup?.selectedIdentityId ? { identityId: state.accountSetup.selectedIdentityId } : {}),
    ...(state.videoPreview?.tiktokVideoId ? { videoId: state.videoPreview.tiktokVideoId } : {}),
    adText: state.product?.creativeBriefHook || `Shop ${state.product?.title || "this product"}`,
    callToAction: "SHOP_NOW"
  };
}

async function handleAction(action, state) {
  if (!action?.type) return;
  const liveState = hydrateEditableState(state || currentState || {});

  if (action.type === "confirm_start_input") {
    const draft = liveState.uiDraft || draftInputState(liveState);
    const productUrlIsValid = isValidUrl(draft.productUrl);
    const storeUrlIsValid = isValidUrl(draft.storeUrl);
    const mode = draft.mode === "store" || (!productUrlIsValid && storeUrlIsValid) ? "store" : "product";
    const selectedUrl = mode === "store" ? draft.storeUrl : draft.productUrl;
    if (!isValidUrl(selectedUrl)) {
      showLocalMessage("Paste a valid product URL or store URL before confirming.");
      return;
    }

    if (mode === "store") {
      await callToolAndRender("scan_store_products", {
        storeUrl: selectedUrl,
        resultMode: "results"
      });
      return;
    }

    await callToolAndRender("scrape_product", {
      url: selectedUrl
    });
    return;
  }

  if (action.type === "use_store_candidate") {
    const candidate = getSelectedCandidate(liveState);
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
      storeUrl: liveState.storeDiscovery?.storeUrl || liveState.uiDraft?.storeUrl || "https://yourstore.com",
      resultMode: "results"
    });
    return;
  }

  if (action.type === "confirm_product" || action.type === "regenerate_storyboard") {
    const args = productActionArgs(liveState, action.feedback || (action.type === "regenerate_storyboard" ? "Generate two fresh storyboard options." : undefined));
    if (!args) {
      await sendChatPrompt("Please confirm or edit the product title and product URL before making storyboards.");
      return;
    }
    await callToolAndRender("generate_storyboard", args);
    return;
  }

  if (action.type === "approve_storyboard") {
    const selectedIndex = getSelectedStoryboardIndex(liveState);
    const selectedAngle = liveState.angles?.[selectedIndex] || {};
    await callToolAndRender("approve_ad_inputs", {
      approvedStoryboardVersion: `v${selectedIndex + 1}`,
      approvedImageCount: Math.max(1, Math.min(3, Number(liveState.product?.imageCount || 1))),
      approvedStoryboardTitle: selectedAngle.title,
      approvedStoryboardHook: selectedAngle.hook,
      approvedStoryboardObjective: selectedAngle.targetObjective,
      approvalNotes: `User selected storyboard option ${selectedIndex + 1}: ${selectedAngle.title || "Untitled storyboard"}. Hook: ${selectedAngle.hook || "Not provided"}.`
    });
    return;
  }

  if (action.type === "check_render_status") {
    const jobId = liveState.renderJob?.jobId || liveState.videoPreview?.jobId;
    if (!jobId) {
      showLocalMessage("Render job is missing. Approve a storyboard again to start video generation.");
      return;
    }
    await callToolAndRender("get_video_status", { jobId });
    return;
  }

  if (action.type === "create_another_video") {
    const approvalId = liveState.renderJob?.approvalId;
    if (!approvalId) {
      await sendChatPrompt("Create another video version from the approved storyboard.");
      return;
    }
    await callToolAndRender("generate_video", {
      approvalId,
      renderingStyle: "product_demo",
      creativeBriefTitle: liveState.product?.creativeBriefTitle,
      creativeBriefHook: liveState.product?.creativeBriefHook,
      creativeBriefObjective: liveState.product?.creativeBriefObjective
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

  if (action.type === "verify_selected_account") {
    const account = getSelectedAccount(liveState);
    if (!account?.advertiserId) {
      showLocalMessage("Choose an advertiser account before continuing.");
      return;
    }
    await callToolAndRender("verify_or_connect_tiktok_identity", {
      advertiserId: account.advertiserId
    });
    return;
  }

  if (action.type === "create_smartplus_draft") {
    const args = createSmartPlusArgsFromState(liveState);
    if (!args) {
      showLocalMessage("Approve the preview and finish account setup before creating a Smart+ draft.");
      return;
    }
    await callToolAndRender("create_smartplus_campaign", args);
    return;
  }

  if (action.type === "approve_launch_settings") {
    const campaignId = campaignIdFromState(liveState);
    if (!campaignId) {
      await sendChatPrompt("Create a Smart+ draft before approving launch settings.");
      return;
    }
    await callToolAndRender("approve_campaign_parameters", {
      campaignId,
      campaignName: liveState.draft?.name,
      targetCountryCode: normalizeCountryCode(draftFieldValue(liveState, "Country", "US")),
      adgroupDailyBudget: parseBudget(draftFieldValue(liveState, "Daily budget", "$50")),
      optimizationGoal: draftFieldValue(liveState, "Optimization goal", "Clicks"),
      biddingStrategy: draftFieldValue(liveState, "Bidding strategy", "Maximum delivery")
    });
    return;
  }

  if (action.type === "publish_campaign") {
    const campaignId = campaignIdFromState(liveState);
    const approvalId = liveState.uiSelection?.campaignApprovalId || liveState.publish?.approvalId;
    if (!campaignId || !approvalId) {
      showLocalMessage("Approve launch settings before publishing.");
      return;
    }
    await callToolAndRender("publish_campaign", { campaignId, approvalId });
    return;
  }

  if (action.type === "save_reporting_plan") {
    const advertiserId =
      liveState.accountSetup?.selectedAdvertiserId ||
      getSelectedAccount(liveState)?.advertiserId ||
      "selected_advertiser";
    await callToolAndRender("setup_reporting_digest", {
      advertiserId,
      cadence: "weekly",
      deliveryMode: "chatgpt_digest",
      focus: "conversion"
    });
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

  target.querySelectorAll("[data-start-mode]").forEach((element) => {
    element.addEventListener("click", (event) => {
      const mode = element.getAttribute("data-start-mode") === "store" ? "store" : "product";
      target.querySelectorAll("[data-start-mode]").forEach((card) => {
        card.classList.toggle("selected", card.getAttribute("data-start-mode") === mode);
      });
      const nextState = {
        ...(currentState || state || {}),
        uiDraft: {
          ...readDraftFromDom(currentState || state || {}),
          mode
        }
      };
      if (event.target?.matches?.("[data-draft-url]")) {
        persistStateWithoutRender(nextState);
        return;
      }
      renderState(nextState);
    });
  });

  target.querySelectorAll("[data-draft-url]").forEach((input) => {
    input.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    input.addEventListener("focus", () => {
      const mode = input.closest("[data-start-mode]")?.getAttribute("data-start-mode") === "store" ? "store" : "product";
      target.querySelectorAll("[data-start-mode]").forEach((card) => {
        card.classList.toggle("selected", card.getAttribute("data-start-mode") === mode);
      });
      persistStateWithoutRender({
        ...(currentState || state || {}),
        uiDraft: {
          ...readDraftFromDom(currentState || state || {}),
          mode
        }
      });
    });
    input.addEventListener("input", () => {
      persistStateWithoutRender({
        ...(currentState || state || {}),
        uiDraft: readDraftFromDom(currentState || state || {})
      });
    });
  });

  target.querySelectorAll("[data-product-field]").forEach((input) => {
    input.addEventListener("input", () => {
      persistStateWithoutRender({
        ...(currentState || state || {}),
        product: readProductFromDom(currentState || state || {})
      });
    });
  });

  target.querySelectorAll("[data-storyboard-field]").forEach((input) => {
    input.addEventListener("input", () => {
      persistStateWithoutRender({
        ...(currentState || state || {}),
        angles: readStoryboardFromDom(currentState || state || {})
      });
    });
  });

  target.querySelectorAll("[data-preview-field]").forEach((input) => {
    input.addEventListener("input", () => {
      persistStateWithoutRender({
        ...(currentState || state || {}),
        product: readPreviewEditsFromDom(currentState || state || {})
      });
    });
  });

  target.querySelectorAll("[data-review-field], [data-review-campaign-name]").forEach((input) => {
    input.addEventListener("input", () => {
      persistStateWithoutRender({
        ...(currentState || state || {}),
        draft: readReviewDraftFromDom(currentState || state || {})
      });
    });
  });

  target.querySelectorAll("[data-select-account]").forEach((element) => {
    element.addEventListener("click", () => {
      const selectedAdvertiserId = element.getAttribute("data-select-account");
      if (!selectedAdvertiserId) return;
      target.querySelectorAll("[data-select-account]").forEach((card) => {
        card.classList.toggle("selected", card.getAttribute("data-select-account") === selectedAdvertiserId);
      });
      persistStateWithoutRender({
        ...(currentState || state || {}),
        uiSelection: {
          ...((currentState || state || {}).uiSelection || {}),
          selectedAdvertiserId
        }
      });
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
