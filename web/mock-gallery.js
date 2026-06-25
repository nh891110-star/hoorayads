import { renderStateToElement } from "./widget.js";

const states = window.__POC_MOCK_GALLERY__ || [];
const galleryRoot = document.getElementById("gallery");

if (galleryRoot) {
  galleryRoot.innerHTML = states
    .map(
      (entry, index) => `
        <section class="mock-step">
          <div class="mock-step-topline">
            <span class="mock-step-index">Step ${index + 1}</span>
            <div>
              <h2>${entry.label}</h2>
              <p>${entry.note}</p>
            </div>
          </div>
          <div class="mock-step-frame">
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
