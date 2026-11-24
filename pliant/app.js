import {
  PAUSE_MS, SAMPLE_VALUES, applyPause, canObservePause, createState, getLayout, getLedger, getReview,
  isSampleValue, reviewInputs, setAdaptive, setInput, submitSample, toggleOriginal, togglePayment, undoChange,
} from "./model.mjs";

const byId = (id) => document.getElementById(id);
const companionQuestion = byId("companion-question");
const companionFields = byId("companion-fields");
const originalFields = byId("original-fields");
const movedFields = byId("moved-fields");
const palette = byId("palette");
const status = byId("status");
const statusMessage = byId("status-message");
const reviewPanel = byId("review-panel");
const submitButton = byId("submit-button");

const changeDetails = {
  example: {
    title: "Example opened",
    reason: "An example was opened to explain who can count as a companion.",
    original: "Original view: the example was hidden.",
    undone: "Example hidden.",
    focus: () => companionQuestion.querySelector("input:checked"),
  },
  payment: {
    title: "Section collapsed",
    reason: "You pay at the venue, so the payment section was tucked away.",
    original: "Original view: the payment section was open.",
    undone: "Payment section restored.",
    focus: () => byId("payment-toggle"),
  },
  move: {
    title: "Fields moved",
    reason: "The two required fields for Yes were moved next to the companion question.",
    original: "Original view: the companion fields were below Payment.",
    undone: "Companion fields returned below Payment.",
    focus: () => companionQuestion.querySelector("input:checked"),
  },
};

let state = createState();
let pauseTimer;
let statusTimer;
let pauseStarted;

function announce(message) {
  window.clearTimeout(statusTimer);
  statusMessage.textContent = message;
  status.classList.add("is-visible");
  statusTimer = window.setTimeout(() => {
    status.classList.remove("is-visible");
    statusMessage.textContent = "";
  }, 6500);
}

function describePause(signal) {
  if (signal.source === "demo") return "The pause demo simulated an 8-second pause.";
  return "You paused on the companion question for 8 seconds.";
}

function makeNote(change, details) {
  const note = byId("change-template").content.firstElementChild.cloneNode(true);
  const preview = note.querySelector("[data-preview]");
  const trigger = note.querySelector("[data-trigger]");
  const undoButton = note.querySelector('[data-action="undo"]');
  const previewButton = note.querySelector('[data-action="preview"]');
  const whyButton = note.querySelector('[data-action="why"]');

  note.dataset.change = change;
  note.setAttribute("aria-label", `Why this changed: ${details.title}`);
  note.querySelector("[data-decision]").textContent = details.title;
  note.querySelector("[data-reason]").textContent = details.reason;
  preview.textContent = details.original;
  trigger.id = `${change}-trigger`;
  whyButton.setAttribute("aria-controls", trigger.id);
  undoButton.setAttribute("aria-label", `Undo: ${details.title}`);
  whyButton.setAttribute("aria-label", `Why now? ${details.title}`);

  undoButton.addEventListener("click", () => {
    state = undoChange(state, change);
    renderLayout();
    details.focus()?.focus();
    announce(details.undone);
  });

  previewButton.addEventListener("click", () => {
    state = toggleOriginal(state, change);
    renderLayout();
    announce(state.changes[change] === "original" ? details.original : `Adapted view: ${details.title.toLowerCase()}.`);
  });

  whyButton.addEventListener("click", () => {
    trigger.hidden = !trigger.hidden;
    whyButton.setAttribute("aria-expanded", String(!trigger.hidden));
    announce(trigger.hidden ? "Pause reason hidden." : describePause(state.signal));
  });

  byId(`${change}-note`).append(note);
  return { note, preview, previewButton, trigger, whyButton };
}

const notes = Object.fromEntries(
  Object.entries(changeDetails).map(([id, details]) => [id, makeNote(id, details)]),
);

function setExpanded(buttonId, open) {
  const button = byId(buttonId);
  button.setAttribute("aria-expanded", String(open));
  byId(button.getAttribute("aria-controls")).hidden = !open;
}

function renderLayout() {
  const layout = getLayout(state);
  const target = layout.fieldsMoved ? movedFields : originalFields;
  if (target !== companionFields.parentElement) target.append(companionFields);

  byId("companion-example").hidden = !layout.exampleOpen;
  byId("original-companion-panel").hidden = !layout.hasCompanion || layout.fieldsMoved;
  byId("companion_name").disabled = !layout.hasCompanion;
  byId("age_group").disabled = !layout.hasCompanion;

  setExpanded("payment-toggle", layout.paymentOpen);
  byId("payment-summary").hidden = layout.paymentOpen;

  byId("adaptive-toggle").setAttribute("aria-checked", String(state.adaptive));
  byId("adaptive-state").textContent = state.adaptive ? "On" : "Off";
  const showPauseHint = canObservePause(state);
  byId("pause-hint").hidden = !showPauseHint;
  if (showPauseHint || layout.exampleOpen) {
    companionQuestion.setAttribute("aria-describedby", layout.exampleOpen ? "companion-example" : "pause-hint");
  } else {
    companionQuestion.removeAttribute("aria-describedby");
  }

  for (const [id, elements] of Object.entries(notes)) {
    const mode = state.changes[id];
    const isOriginal = mode === "original";
    const action = isOriginal ? "Show adapted" : "Show original";
    elements.note.hidden = !mode || (id === "move" && !layout.hasCompanion);
    elements.preview.hidden = !isOriginal;
    elements.previewButton.textContent = action;
    elements.previewButton.setAttribute("aria-label", `${action}: ${changeDetails[id].title}`);
    if (elements.note.hidden) {
      elements.trigger.hidden = true;
      elements.whyButton.setAttribute("aria-expanded", "false");
    }
    if (state.signal) elements.trigger.textContent = describePause(state.signal);
  }
}

function renderLedger() {
  const ledger = getLedger(state);
  byId("ledger-fields").textContent = ledger.fieldIds.join(", ") || "None yet";
  if (!ledger.signal) {
    byId("ledger-signal").textContent = "None yet";
    return;
  }
  const simulated = ledger.signal.source === "demo" ? " (simulated)" : "";
  byId("ledger-signal").textContent = `Paused ${ledger.signal.seconds} s${simulated}`;
}

function renderInputMarkers() {
  for (const badge of document.querySelectorAll("[data-sample-for]")) {
    badge.hidden = !isSampleValue(state, badge.dataset.sampleFor);
  }
  for (const [id, field, label] of [
    ["about-toggle", "attendee_name", "About you"],
    ["course-toggle", "course", "Course choice"],
  ]) {
    const complete = Boolean(state.inputs[field].trim());
    const button = byId(id);
    button.dataset.complete = String(complete);
    button.setAttribute("aria-label", `${label}: ${complete ? "filled in" : "incomplete"}`);
  }
}

function renderReview() {
  reviewPanel.hidden = !state.reviewed;
  byId("review-button").setAttribute("aria-expanded", String(state.reviewed));
  if (!state.reviewed) return;

  const { rows, missing } = getReview(state);
  const list = byId("review-list");
  list.replaceChildren();
  for (const row of rows) {
    const item = document.createElement("div");
    const label = document.createElement("dt");
    const value = document.createElement("dd");
    label.textContent = row.label;
    value.textContent = row.missing ? "Required field" : (row.value.trim() ? row.value : "Not entered");
    if (row.sample) {
      const badge = document.createElement("span");
      badge.className = "sample";
      badge.textContent = "Sample";
      value.append(" ", badge);
    }
    item.append(label, value);
    list.append(item);
  }

  byId("review-message").textContent = missing.length
    ? `Fill in the required fields, then review again: ${missing.map((row) => row.label).join(", ")}.`
    : "Submit shows a confirmation on this page.";
  submitButton.disabled = missing.length > 0 || state.submitted;
  byId("submit-result").hidden = !state.submitted;
}

function stopPauseTimer() {
  window.clearTimeout(pauseTimer);
}

function finishPause(source, elapsedMs) {
  const next = applyPause(state, { source, elapsedMs });
  if (next === state) return;
  state = next;
  setExpanded("companion-toggle", true);
  renderLayout();
  renderLedger();

  const layout = getLayout(state);
  const changes = ["Example opened"];
  if (state.changes.payment) changes.push("payment folded");
  if (layout.fieldsMoved) changes.push("companion fields moved");
  announce(`${changes.join(" · ")}.`);
}

function checkPause() {
  if (!canObservePause(state) || document.hidden || !companionQuestion.contains(document.activeElement)) return;

  const elapsed = performance.now() - pauseStarted;
  if (elapsed < PAUSE_MS) {
    pauseTimer = window.setTimeout(checkPause, PAUSE_MS - elapsed);
    return;
  }
  finishPause("focus", elapsed);
}

function startPauseTimer() {
  stopPauseTimer();
  if (!canObservePause(state) || document.hidden || !companionQuestion.contains(document.activeElement)) return;

  pauseStarted = performance.now();
  pauseTimer = window.setTimeout(checkPause, PAUSE_MS);
}

for (const [id, value] of Object.entries(SAMPLE_VALUES)) {
  if (id === "companion") {
    byId("companion-yes").checked = value === "Yes";
    byId("companion-no").checked = value === "No";
  } else {
    byId(id).value = value;
  }
}
palette.value = document.documentElement.dataset.palette;

for (const [buttonId, label] of [
  ["about-toggle", "About you"],
  ["course-toggle", "Course choice"],
  ["companion-toggle", "Companion"],
  ["accessibility-toggle", "Accessibility needs"],
]) {
  const button = byId(buttonId);
  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") === "false";
    setExpanded(buttonId, open);
    announce(`${label} ${open ? "opened" : "closed"}.`);
  });
}

const words = byId("words");
let wordsOpen = words.open;
words.addEventListener("toggle", () => {
  if (words.open === wordsOpen) return;
  wordsOpen = words.open;
  announce(wordsOpen ? "Word definitions shown." : "Word definitions hidden.");
});

byId("payment-toggle").addEventListener("click", () => {
  state = togglePayment(state);
  renderLayout();
  announce(getLayout(state).paymentOpen ? "Payment section opened." : "Payment section closed.");
});

byId("adaptive-toggle").addEventListener("click", () => {
  stopPauseTimer();
  state = setAdaptive(state, !state.adaptive);
  renderLayout();
  announce(state.adaptive ? "Adaptive help is on." : "Adaptive help is off. Form layout restored.");
});

byId("try-pause").addEventListener("click", () => {
  stopPauseTimer();
  if (!state.adaptive) {
    announce("Turn on Adaptive help to try the pause demo.");
    return;
  }
  finishPause("demo");
});

companionQuestion.addEventListener("focusin", startPauseTimer);
companionQuestion.addEventListener("focusout", stopPauseTimer);
companionQuestion.addEventListener("click", (event) => {
  if (event.target.matches("input")) event.target.focus();
  startPauseTimer();
});
companionQuestion.addEventListener("keydown", startPauseTimer);
document.addEventListener("visibilitychange", startPauseTimer);

byId("signup").addEventListener("input", (event) => {
  const { id, name, value } = event.target;
  const field = name === "companion-choice" ? "companion" : id;
  const wasReviewed = state.reviewed;
  const next = setInput(state, field, value);
  if (next === state) return;

  state = next;
  renderInputMarkers();
  if (field === "companion") {
    renderLayout();
    if (!wasReviewed) {
      const { hasCompanion, fieldsMoved } = getLayout(state);
      if (hasCompanion) {
        announce(fieldsMoved ? "Companion details shown below this question." : "Companion details shown below Payment.");
      } else {
        announce("Companion details hidden.");
      }
    }
  }
  if (wasReviewed) {
    renderReview();
    announce("Inputs changed. Review them again before submitting.");
  }
});

byId("signup").addEventListener("submit", (event) => event.preventDefault());

byId("review-button").addEventListener("click", () => {
  state = reviewInputs(state);
  renderReview();
  byId("review-title").focus();
  announce("All current inputs are shown for review.");
});

submitButton.addEventListener("click", () => {
  const next = submitSample(state);
  if (next === state) return;
  state = next;
  renderReview();
  byId("submit-result").focus();
  announce(byId("submit-result").textContent);
});

palette.addEventListener("change", () => {
  document.documentElement.dataset.palette = palette.value;
  announce(`Palette set to ${palette.selectedOptions[0].textContent}.`);
});

renderInputMarkers();
renderLayout();
renderLedger();
