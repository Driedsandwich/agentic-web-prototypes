import { assembleAnswer, formatAttribution, formatManifest } from "./samples.mjs";

const get = (id) => document.getElementById(id);
const picker = get("question-picker");
const askButton = get("ask-button");
const copyButton = get("copy-button");
const palette = get("palette-select");
const answerRows = get("answer-rows");
const answerEmpty = get("answer-empty");
const answerLabel = get("answer-label");
const manifestCode = get("manifest-template");

function setStatus(id, message) {
  get(id).textContent = message;
}

function renderCallPath(networks) {
  const template = get("path-step-template");
  const callPath = get("call-path");

  return networks.map((network) => {
    const card = template.content.cloneNode(true);
    card.querySelector("h3").textContent = network.id;
    card.querySelector(".sample-host").textContent = new URL(network.address).hostname;
    card.querySelector(".attribution").textContent = formatAttribution(network);
    const result = card.querySelector(".path-result");
    callPath.append(card);
    return result;
  });
}

function renderAnswer({ sentences, callPath }, pathResults, preflight) {
  const template = get("answer-row-template");
  const rows = sentences.map(({ text, source }) => {
    const row = template.content.cloneNode(true);
    const mark = row.querySelector(".source-mark");
    const citation = row.querySelector(".citation");
    const status = row.querySelector(".status");
    mark.dataset.mark = source.mark;
    mark.textContent = source.mark;
    row.querySelector(".answer-sentence").textContent = text;
    row.querySelector(".citation-title").textContent =
      `${source.source} · ${source.section.title} · ${source.license}`;
    row.querySelector(".attribution").textContent = formatAttribution(source);
    row.querySelector(".sample-summary p").textContent = source.section.summary;
    citation.addEventListener("toggle", () => {
      status.textContent = citation.open ? "Sample summary opened." : "Sample summary closed.";
    });
    return row;
  });

  answerRows.replaceChildren(...rows);
  answerRows.hidden = false;
  answerLabel.hidden = false;
  answerEmpty.hidden = true;

  callPath.forEach((network, index) => {
    const result = pathResults[index];
    result.querySelector(".returned-section").textContent = `Returns ${network.section.title}`;
    result.querySelector(".preflight-result").textContent = `${preflight.result} · Sample ${preflight.tool} result`;
    result.hidden = false;
  });
}

function configureQuestions(samples, pathResults) {
  let selectedId = samples.questions[0].id;
  const selectedQuestion = get("selected-question");
  const pickerSummary = picker.querySelector("summary");
  const options = get("question-options");

  const choices = samples.questions.map((question) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = question.prompt;
    button.setAttribute("aria-pressed", String(selectedId === question.id));
    item.append(button);
    return { question, item, button };
  });

  for (const { question, item, button } of choices) {
    button.addEventListener("click", () => {
      if (selectedId !== question.id) {
        selectedId = question.id;
        selectedQuestion.textContent = question.prompt;
        answerRows.replaceChildren();
        answerRows.hidden = true;
        answerLabel.hidden = true;
        answerEmpty.hidden = false;
        for (const result of pathResults) result.hidden = true;
      }

      for (const choice of choices) {
        choice.button.setAttribute("aria-pressed", String(choice.question.id === selectedId));
      }

      picker.open = false;
      pickerSummary.focus();
      setStatus("ask-status", "Sample question selected. Press Ask to assemble its answer.");
    });
    options.append(item);
  }

  picker.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !picker.open) return;
    picker.open = false;
    pickerSummary.focus();
  });

  askButton.addEventListener("click", () => {
    picker.open = false;
    renderAnswer(assembleAnswer(samples, selectedId), pathResults, samples.preflight);
    setStatus("ask-status", "Assembled the sample answer on this page.");
  });

  selectedQuestion.textContent = samples.questions[0].prompt;
  askButton.disabled = false;
}

async function copyManifest(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Try copying the visible selection when clipboard access is blocked.
    }
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(manifestCode);
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    if (document.execCommand("copy")) {
      selection.removeAllRanges();
      return true;
    }
  } catch {
    // Leave the selection available for the device's copy command.
  }
  return false;
}

palette.addEventListener("change", () => {
  document.documentElement.dataset.palette = palette.value;
  const name = palette.selectedOptions[0].textContent;
  setStatus("palette-status", `${name} applied on this page.`);
});

const glossary = get("glossary");
let glossaryWasOpen = glossary.open;
glossary.addEventListener("toggle", () => {
  if (glossary.open === glossaryWasOpen) return;
  glossaryWasOpen = glossary.open;
  setStatus("glossary-status", glossary.open ? "Glossary opened." : "Glossary closed.");
});

async function loadSamples() {
  try {
    const response = await fetch(new URL("./data/samples.json", import.meta.url), {
      mode: "same-origin",
      redirect: "error",
    });
    if (!response.ok) throw new Error("Sample data could not be loaded.");
    const samples = await response.json();
    const pathResults = renderCallPath(samples.networks);
    configureQuestions(samples, pathResults);
    const manifest = formatManifest(samples.manifest);
    manifestCode.textContent = manifest;
    get("callable-url").textContent = samples.networks[0].address;
    copyButton.disabled = false;
    copyButton.addEventListener("click", async () => {
      const copied = await copyManifest(manifest);
      setStatus("copy-status", copied
        ? "Copied the sample template to your clipboard."
        : "Template selected. Use your device's copy command.");
    });
  } catch {
    get("selected-question").textContent = "Sample questions unavailable";
    setStatus("ask-status", "Could not load the sample data. Open this page from a static HTTP or HTTPS server.");
  }
}

loadSamples();
