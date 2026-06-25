import { renderStateToElement } from "./widget.js";

const states = window.__POC_MOCK_GALLERY__ || [];
const galleryRoot = document.getElementById("gallery");

if (galleryRoot) {
  galleryRoot.innerHTML = states
    .map(
      (entry, index) => `
        <section class="mock-step">
          <div class="mock-step-frame">
            <div class="mock-step-label">Preview ${index + 1} · ${entry.label}</div>
            <div class="mock-step-surface" id="mock-surface-${index}"></div>
          </div>
        </section>
      `
    )
    .join("");

  states.forEach((entry, index) => {
    renderStateToElement(document.getElementById(`mock-surface-${index}`), entry.state);
  });
}
