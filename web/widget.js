const root = document.getElementById("app-root") || document.getElementById("app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTimeline(steps = []) {
  return `
    <div class="timeline">
      ${steps
        .map(
          (step) => `
            <div class="timeline-step">
              <div class="timeline-badge ${step.status}">${escapeHtml(step.status)}</div>
              <div>
                <strong>${escapeHtml(step.label)}</strong>
              </div>
              <div class="owner-pill">${escapeHtml(step.owner)}</div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderReadiness(state) {
  if (!state.readiness) return "";
  return `
    <div class="meta-list">
      <div class="meta-item"><strong>Ad account</strong><span>${escapeHtml(state.readiness.accountConnection)}</span></div>
      <div class="meta-item"><strong>Identity</strong><span>${escapeHtml(state.readiness.identity)}</span></div>
      <div class="meta-item"><strong>Payment</strong><span>${escapeHtml(state.readiness.payment)}</span></div>
      <div class="meta-item"><strong>Video</strong><span>${escapeHtml(state.readiness.video)}</span></div>
      <div class="meta-item"><strong>Recommended objective</strong><span>${escapeHtml(state.readiness.recommendedObjective)}</span></div>
    </div>
  `;
}

function renderBlockers(state) {
  if (!state.blockers?.length) return "";
  return `
    <div class="blockers">
      ${state.blockers
        .map(
          (blocker) => `
            <div class="blocker ${escapeHtml(blocker.severity)}">
              <strong>${escapeHtml(blocker.title)}</strong>
              <p>${escapeHtml(blocker.detail)}</p>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderCreativeCards(state) {
  if (!state.angles?.length) return "";
  return `
    <div class="carousel">
      ${state.angles
        .map(
          (angle) => `
            <article class="card">
              <small>${escapeHtml(angle.format)}</small>
              <h3>${escapeHtml(angle.title)}</h3>
              <p>${escapeHtml(angle.hook)}</p>
              <p style="margin-top:12px;"><strong>${escapeHtml(angle.targetObjective)}</strong></p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDraft(state) {
  if (!state.draft) return "";
  return `
    <div class="meta-list">
      ${state.draft.fields
        .map(
          (field) => `
            <div class="meta-item">
              <strong>${escapeHtml(field.label)}</strong>
              <span>${escapeHtml(field.value)}${field.editable ? " • editable" : ""}</span>
            </div>
          `
        )
        .join("")}
    </div>
    <div style="margin-top:16px;">
      <strong>Warnings</strong>
      <ul class="warning-list">
        ${state.draft.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderAccounts(state) {
  if (!state.accounts?.length) return "";
  return `
    <div class="account-list">
      ${state.accounts
        .map(
          (account) => `
            <article class="account-card">
              <div class="account-topline">
                <strong>${escapeHtml(account.advertiserName)}</strong>
                <span class="owner-pill">${escapeHtml(account.advertiserRole)}</span>
              </div>
              <div class="account-meta">
                <span>${escapeHtml(account.bcName)}</span>
                <span>${escapeHtml(account.currency)} • ${escapeHtml(account.timezone)}</span>
                <span>${escapeHtml(account.status)} • ${escapeHtml(String(account.identityCount))} identities</span>
              </div>
              <div class="account-id">Advertiser ID ${escapeHtml(account.advertiserId)}</div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderIdentities(state) {
  if (!state.identities?.length) return "";
  return `
    <div class="account-list">
      ${state.identities
        .map(
          (identity) => `
            <article class="account-card">
              <div class="account-topline">
                <strong>${escapeHtml(identity.displayName)}</strong>
                <span class="owner-pill">${escapeHtml(identity.identityType)}</span>
              </div>
              <div class="account-meta">
                <span>@${escapeHtml(identity.username || "unknown")}</span>
                <span>${escapeHtml(identity.availableStatus)}</span>
              </div>
              <div class="account-id">Identity ID ${escapeHtml(identity.identityId)}</div>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderAuth(state) {
  if (state.auth?.status !== "needs_authorization" || !state.auth.authorizationUrl) return "";
  return `
    <div class="auth-panel">
      <div>
        <strong>TikTok authorization is required</strong>
        <p>Open the TikTok authorization flow, finish access approval, then come back and continue in the same ChatGPT app thread.</p>
      </div>
      <a class="auth-link" href="${escapeHtml(state.auth.authorizationUrl)}" target="_blank" rel="noreferrer">Open TikTok authorization</a>
    </div>
  `;
}

function renderPublish(state) {
  if (!state.publish) return "";
  return `
    <div class="publish-banner">
      <div>
        <div class="publish-state">${escapeHtml(state.publish.state)}</div>
        <h3 style="margin:10px 0 6px;">Campaign ${escapeHtml(state.publish.campaignId)}</h3>
        <p style="margin:0;color:var(--muted);">${escapeHtml(state.publish.nextCheckIn)}</p>
      </div>
    </div>
  `;
}

function renderState(state) {
  if (!root || !state) return;

  const productMeta = state.product
    ? `
      <div class="stats">
        <div class="stat">
          <span class="stat-label">Platform</span>
          <span class="stat-value">${escapeHtml(state.product.platform)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Product</span>
          <span class="stat-value">${escapeHtml(state.product.title)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Price</span>
          <span class="stat-value">${escapeHtml(state.product.price)}</span>
        </div>
      </div>
    `
    : "";

  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div class="hero-card">
          <div class="eyebrow">TikTok Ads ChatGPT app POC</div>
          <h1>${escapeHtml(state.headline)}</h1>
          <p>${escapeHtml(state.summary)}</p>
          <div class="cta-row">
            <button class="btn btn-primary">${escapeHtml(state.primaryCta)}</button>
            ${state.secondaryCta ? `<button class="btn btn-secondary">${escapeHtml(state.secondaryCta)}</button>` : ""}
          </div>
        </div>
        <div class="hero-card">
          ${productMeta}
        </div>
      </section>

      <section class="grid">
        <div class="panel">
          <h2>Flow status</h2>
          ${renderTimeline(state.timeline)}
        </div>
        <div class="panel">
          <h2>Readiness snapshot</h2>
          ${renderReadiness(state)}
          ${renderPublish(state)}
        </div>
      </section>

      ${state.auth?.status === "needs_authorization" ? `<section class="panel" style="margin-top:20px;"><h2>Authorization</h2>${renderAuth(state)}</section>` : ""}
      ${state.accounts?.length ? `<section class="panel" style="margin-top:20px;"><h2>Advertiser accounts</h2>${renderAccounts(state)}</section>` : ""}
      ${state.identities?.length ? `<section class="panel" style="margin-top:20px;"><h2>Connected identities</h2>${renderIdentities(state)}</section>` : ""}
      ${state.blockers?.length ? `<section class="panel" style="margin-top:20px;"><h2>What still needs attention</h2>${renderBlockers(state)}</section>` : ""}
      ${state.angles?.length ? `<section class="panel" style="margin-top:20px;"><h2>Creative directions</h2>${renderCreativeCards(state)}</section>` : ""}
      ${state.draft ? `<section class="panel" style="margin-top:20px;"><h2>${escapeHtml(state.draft.name)}</h2>${renderDraft(state)}</section>` : ""}
    </main>
  `;
}

function maybeReadToolResult(message) {
  if (!message || message.jsonrpc !== "2.0") return null;
  if (message.method !== "ui/notifications/tool-result") return null;
  return message.params?.structuredContent?.widgetState || message.params?._meta?.widgetState || null;
}

window.addEventListener(
  "message",
  (event) => {
    if (event.source !== window.parent) return;
    const state = maybeReadToolResult(event.data);
    if (state) renderState(state);
  },
  { passive: true }
);

renderState(window.__POC_PREVIEW_STATE__);
