const root = document.getElementById("app-root") || document.getElementById("app");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTimeline(steps = []) {
  if (!steps.length) return "";

  return `
    <div class="timeline">
      ${steps
        .map(
          (step) => `
            <div class="timeline-step">
              <div class="timeline-badge ${escapeHtml(step.status)}">${escapeHtml(step.status)}</div>
              <div class="timeline-copy">
                <strong>${escapeHtml(step.label)}</strong>
                <span>${escapeHtml(step.owner)}</span>
              </div>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderHighlights(state) {
  if (!state.highlights?.length) return "";

  return `
    <div class="highlight-grid">
      ${state.highlights
        .map(
          (item) => `
            <div class="highlight-card ${escapeHtml(item.tone || "default")}">
              <span>${escapeHtml(item.label)}</span>
              <strong>${escapeHtml(item.value)}</strong>
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
      <div class="meta-item"><strong>Account</strong><span>${escapeHtml(state.readiness.accountConnection)}</span></div>
      <div class="meta-item"><strong>Identity</strong><span>${escapeHtml(state.readiness.identity)}</span></div>
      <div class="meta-item"><strong>Payment</strong><span>${escapeHtml(state.readiness.payment)}</span></div>
      <div class="meta-item"><strong>Video</strong><span>${escapeHtml(state.readiness.video)}</span></div>
      <div class="meta-item"><strong>Recommended objective</strong><span>${escapeHtml(state.readiness.recommendedObjective)}</span></div>
    </div>
  `;
}

function renderChecklist(state) {
  if (!state.checklist?.length) return "";

  return `
    <div class="checklist">
      ${state.checklist
        .map(
          (item) => `
            <article class="checklist-item ${escapeHtml(item.status)}">
              <div class="checklist-pill">${escapeHtml(item.status)}</div>
              <div>
                <strong>${escapeHtml(item.label)}</strong>
                <p>${escapeHtml(item.detail)}</p>
              </div>
            </article>
          `
        )
        .join("")}
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

function renderOptionGroups(state) {
  if (!state.optionGroups?.length) return "";

  return state.optionGroups
    .map(
      (group) => `
        <section class="panel" style="margin-top:20px;">
          <div class="section-topline">
            <h2>${escapeHtml(group.title)}</h2>
            ${group.description ? `<p>${escapeHtml(group.description)}</p>` : ""}
          </div>
          <div class="option-grid">
            ${group.options
              .map(
                (option) => `
                  <article class="option-card ${escapeHtml(option.status)}">
                    <small>${escapeHtml(option.kicker)}</small>
                    <h3>${escapeHtml(option.title)}</h3>
                    <p>${escapeHtml(option.description)}</p>
                    <div class="meta-stack">
                      ${option.meta.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
                    </div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `
    )
    .join("");
}

function renderCreativeCards(state) {
  if (!state.angles?.length) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Creative directions</h2>
      <div class="carousel">
        ${state.angles
          .map(
            (angle) => `
              <article class="card">
                <small>${escapeHtml(angle.format)}</small>
                <h3>${escapeHtml(angle.title)}</h3>
                <p>${escapeHtml(angle.hook)}</p>
                <p class="card-footer">${escapeHtml(angle.targetObjective)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderCreativeAssets(state) {
  if (!state.creativeAssets?.length) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Creative asset paths</h2>
      <div class="option-grid">
        ${state.creativeAssets
          .map(
            (asset) => `
              <article class="option-card ${escapeHtml(asset.status)}">
                <small>${escapeHtml(asset.source)}</small>
                <h3>${escapeHtml(asset.title)}</h3>
                <p>${escapeHtml(asset.description)}</p>
                <div class="meta-stack">
                  ${asset.meta.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
                </div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAccounts(state) {
  if (!state.accounts?.length) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Advertiser accounts</h2>
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
                  <span>${escapeHtml(account.country)} • ${escapeHtml(account.currency)}</span>
                  <span>${escapeHtml(account.status)} • ${escapeHtml(String(account.identityCount))} identities</span>
                </div>
                <div class="account-id">Advertiser ID ${escapeHtml(account.advertiserId)}</div>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderIdentities(state) {
  if (!state.identities?.length) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Connected identities</h2>
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
    </section>
  `;
}

function renderDraft(state) {
  if (!state.draft) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>${escapeHtml(state.draft.name)}</h2>
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
      <div class="warning-wrap">
        <strong>Launch warnings</strong>
        <ul class="warning-list">
          ${state.draft.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </div>
    </section>
  `;
}

function renderPublish(state) {
  if (!state.publish) return "";

  return `
    <div class="publish-banner">
      <div>
        <div class="publish-state">${escapeHtml(state.publish.state)}</div>
        <h3>Campaign ${escapeHtml(state.publish.campaignId)}</h3>
        <p>${escapeHtml(state.publish.nextCheckIn)}</p>
      </div>
    </div>
  `;
}

function renderReportPlan(state) {
  if (!state.reportPlan) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Reporting plan</h2>
      <div class="meta-list">
        <div class="meta-item"><strong>Cadence</strong><span>${escapeHtml(state.reportPlan.cadence)}</span></div>
        <div class="meta-item"><strong>Delivery</strong><span>${escapeHtml(state.reportPlan.delivery)}</span></div>
        <div class="meta-item"><strong>Next run</strong><span>${escapeHtml(state.reportPlan.nextRun)}</span></div>
        <div class="meta-item"><strong>Focus</strong><span>${escapeHtml(state.reportPlan.focus)}</span></div>
      </div>
      <div class="warning-wrap">
        <strong>Metrics to emphasize</strong>
        <ul class="warning-list">
          ${state.reportPlan.metrics.map((metric) => `<li>${escapeHtml(metric)}</li>`).join("")}
        </ul>
      </div>
      <div class="warning-wrap">
        <strong>Setup notes</strong>
        <ul class="warning-list">
          ${state.reportPlan.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
        </ul>
      </div>
    </section>
  `;
}

function renderCapabilityNotes(state) {
  if (!state.capabilityNotes?.length) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>Capability notes</h2>
      <div class="note-list">
        ${state.capabilityNotes
          .map(
            (note) => `
              <article class="note-card ${escapeHtml(note.status)}">
                <div class="note-status">${escapeHtml(note.status)}</div>
                <strong>${escapeHtml(note.title)}</strong>
                <p>${escapeHtml(note.detail)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderAuth(state) {
  if (state.auth?.status !== "needs_authorization" || !state.auth.authorizationUrl) return "";

  return `
    <section class="panel" style="margin-top:20px;">
      <h2>TikTok authorization</h2>
      <div class="auth-panel">
        <div>
          <strong>TikTok Ads authorization is required</strong>
          <p>Open the TikTok authorization flow, finish approval, then return to the same ChatGPT app session and continue.</p>
        </div>
        <a class="auth-link" href="${escapeHtml(state.auth.authorizationUrl)}" target="_blank" rel="noreferrer">Open TikTok authorization</a>
      </div>
    </section>
  `;
}

function renderProductMeta(state) {
  if (!state.product) return "";

  return `
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
        <span class="stat-label">Destination</span>
        <span class="stat-value stat-link">${escapeHtml(state.product.destination)}</span>
      </div>
      <div class="stat">
        <span class="stat-label">Price</span>
        <span class="stat-value">${escapeHtml(state.product.price)}</span>
      </div>
    </div>
  `;
}

export function renderStateToElement(target, state) {
  if (!target || !state) return;

  target.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div class="hero-card hero-primary">
          ${state.phaseLabel ? `<div class="eyebrow">${escapeHtml(state.phaseLabel)}</div>` : ""}
          <h1>${escapeHtml(state.headline)}</h1>
          <p>${escapeHtml(state.summary)}</p>
          <div class="cta-row">
            <button class="btn btn-primary">${escapeHtml(state.primaryCta)}</button>
            ${state.secondaryCta ? `<button class="btn btn-secondary">${escapeHtml(state.secondaryCta)}</button>` : ""}
          </div>
          ${renderHighlights(state)}
        </div>
        <div class="hero-card hero-secondary">
          <div class="hero-side-head">Guided launch map</div>
          ${renderTimeline(state.timeline)}
        </div>
      </section>

      <section class="grid">
        <div class="panel">
          <h2>What happens in this step</h2>
          ${renderChecklist(state)}
        </div>
        <div class="panel">
          <h2>Launch readiness</h2>
          ${renderReadiness(state)}
          ${renderPublish(state)}
        </div>
      </section>

      ${renderAuth(state)}
      ${state.product ? `<section class="panel" style="margin-top:20px;"><h2>Promoted product</h2>${renderProductMeta(state)}</section>` : ""}
      ${state.blockers?.length ? `<section class="panel" style="margin-top:20px;"><h2>What still needs attention</h2>${renderBlockers(state)}</section>` : ""}
      ${renderOptionGroups(state)}
      ${renderAccounts(state)}
      ${renderIdentities(state)}
      ${renderCreativeAssets(state)}
      ${renderCreativeCards(state)}
      ${renderDraft(state)}
      ${renderReportPlan(state)}
      ${renderCapabilityNotes(state)}
    </main>
  `;
}

function renderState(state) {
  renderStateToElement(root, state);
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
