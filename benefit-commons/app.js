import { RULE_FILES, checkBenefits, makeChecklist } from "./benefits.mjs";

const form = document.getElementById("benefit-form");
const fields = {
  state: document.getElementById("state"),
  householdSize: document.getElementById("household-size"),
  monthlyIncome: document.getElementById("monthly-income"),
  children: document.getElementById("children"),
  language: document.getElementById("language"),
};
const checkButton = document.getElementById("check-button");
const inputError = document.getElementById("input-error");
const checkStatus = document.getElementById("check-status");
const results = document.getElementById("results");
const ruleList = document.getElementById("rule-list");
const sourceTemplate = document.getElementById("rule-source-template");
const resultTemplate = document.getElementById("result-template");
const application = document.getElementById("sample-application");
const palette = document.getElementById("palette");
const paletteStatus = document.getElementById("palette-status");
const applicationHash = "#sample-application-";

let programs = [];

function renderDate(container, date) {
  const time = container.querySelector("time");
  time.dateTime = date;
  time.textContent = date;
}

function renderSource(program) {
  const card = sourceTemplate.content.firstElementChild.cloneNode(true);
  card.querySelector(".source-site").textContent = program.source.site;
  card.querySelector(".source-preflight strong").textContent = program.source.samplePreflight;
  renderDate(card, program.source.copiedOn);
  return card;
}

function downloadChecklist(program) {
  const blob = new Blob([makeChecklist(program)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sample-${program.id}-checklist.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderResult({ program, estimate, reason }) {
  const card = resultTemplate.content.firstElementChild.cloneNode(true);
  card.id = `result-${program.id}`;
  card.querySelector(".result-title").textContent = program.title;
  card.querySelector(".decision").dataset.estimate = estimate;
  card.querySelector(".decision-label").textContent = estimate;
  card.querySelector(".result-reason").textContent = reason;
  card.querySelector(".result-site").textContent = program.source.site;
  card.querySelector(".application-link").href = applicationHash + program.id;
  renderDate(card, program.source.copiedOn);
  card.querySelector(".export-button").addEventListener("click", () => {
    downloadChecklist(program);
    card.querySelector(".result-feedback").textContent = "Requested a sample checklist download in this browser.";
  });
  return card;
}

function setApplicationFeedback(id, message) {
  const card = document.getElementById(`result-${id}`);
  if (card) card.querySelector(".result-feedback").textContent = message;
}

function syncApplication() {
  const program = programs.find(({ id }) => location.hash === applicationHash + id);
  if (!program) {
    if (application.open) application.close();
    return;
  }

  application.dataset.program = program.id;
  document.getElementById("application-program").textContent = program.title;
  document.getElementById("application-address").textContent = program.source.application;
  if (!application.open) application.showModal();
  setApplicationFeedback(program.id, "Opened the sample application preview in this page.");
}

window.addEventListener("hashchange", syncApplication);
document.getElementById("close-application").addEventListener("click", () => application.close());
application.addEventListener("close", () => {
  const id = application.dataset.program;
  if (location.hash === applicationHash + id) {
    const page = new URL(location.href);
    page.hash = "";
    history.replaceState(history.state, "", page);
  }
  setApplicationFeedback(id, "Closed the sample application preview.");
});

function clearInputError() {
  const invalid = form.querySelector("[aria-invalid]");
  if (invalid) {
    invalid.removeAttribute("aria-invalid");
    invalid.removeAttribute("aria-describedby");
  }
  inputError.hidden = true;
  inputError.textContent = "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!programs.length) return;

  const input = Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, field.value]),
  );
  const outcome = checkBenefits(programs, input);

  clearInputError();
  if (outcome.error) {
    const { field, message } = outcome.error;
    fields[field].setAttribute("aria-invalid", "true");
    fields[field].setAttribute("aria-describedby", "input-error");
    inputError.hidden = false;
    inputError.textContent = message;
    fields[field].focus();
    return;
  }

  results.replaceChildren(...outcome.results.map(renderResult));
  checkStatus.textContent = `Calculated ${outcome.results.length} estimates in this page only. ${programs[0].notice}.`;
});

form.addEventListener("input", () => {
  clearInputError();
  if (!results.childElementCount) return;

  results.replaceChildren();
  checkStatus.textContent = "Inputs changed. Select Check to update the estimates.";
});

palette.value = document.documentElement.dataset.palette;
palette.addEventListener("change", () => {
  document.documentElement.dataset.palette = palette.value;
  paletteStatus.textContent = `Switched to ${palette.selectedOptions[0].textContent}.`;
});

async function loadSampleRules() {
  try {
    programs = await Promise.all(RULE_FILES.map(async (filename) => {
      const response = await fetch(`./data/${filename}.json`, {
        mode: "same-origin",
        credentials: "omit",
        redirect: "error",
      });
      if (!response.ok) throw new Error(`Could not load ${filename}`);
      return response.json();
    }));
  } catch {
    checkStatus.textContent = "The sample rule files could not be loaded. Open the prototype from a static web server.";
    return;
  }

  ruleList.replaceChildren(...programs.map(renderSource));
  checkButton.disabled = false;
  syncApplication();
}

loadSampleRules();
