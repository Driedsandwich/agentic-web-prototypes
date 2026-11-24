import {
  acceptOffer,
  counterOffer,
  createState,
  getDestinations,
  getLatestRequest,
  getPendingOffer,
  getPlacementResults,
  makeCredits,
  removePlacement,
  updatePublishing
} from "./edition.mjs";

const decisions = {
  usable: { label: "Usable", mark: "✓" },
  blocked: { label: "Not for this use", mark: "×" },
  review: { label: "Needs review", mark: "?" }
};

const destinations = document.querySelector("#destinations");
const alsoWeb = document.querySelector("#also-web");
const webOption = document.querySelector("#web-option");
const exportButton = document.querySelector("#export");
const workspace = document.querySelector("#workspace");
const placementsNode = document.querySelector("#placements");
const selectedNode = document.querySelector("#selected-photo");
const offerNode = document.querySelector("#offer");
const pageStatus = document.querySelector("#page-status");
const panelStatus = document.querySelector("#panel-status");
const historyNode = document.querySelector("#history");
const ledger = document.querySelector("#ledger");
const preflight = document.querySelector("#preflight");
const palette = document.querySelector("#palette");

let data;
let state;
let offerSlotId;
let selectedId;
let counterOpen = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function button(label, className, action) {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
}

function sample() {
  return element("span", "sample", "Sample");
}

function heading(text, level = "h2") {
  const row = element("div", "section-heading");
  row.append(element(level, "", text), sample());
  return row;
}

function term(list, label, value) {
  list.append(element("dt", "", label), element("dd", "", value));
}

function artwork(asset, decorative = false) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "artwork");
  svg.setAttribute("viewBox", asset.viewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  if (decorative) {
    svg.setAttribute("aria-hidden", "true");
  } else {
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", asset.description);
  }
  const use = document.createElementNS(svg.namespaceURI, "use");
  use.setAttribute("href", `./artwork.svg#${asset.art}`);
  svg.append(use);
  return svg;
}

function decisionBadge(decision) {
  const { label, mark } = decisions[decision];
  const badge = element("span", `decision decision-${decision}`);
  const symbol = element("span", "decision-symbol", mark);
  symbol.setAttribute("aria-hidden", "true");
  badge.append(symbol, element("span", "", label));
  return badge;
}

function renderFlyer(placements) {
  const cards = placements.map((placement) => {
    const { asset, check, id } = placement;
    const card = button("", "placement", () => {
      selectedId = id;
      counterOpen = false;
      render();
      document.getElementById(`placement-${id}`).focus({ preventScroll: true });
      pageStatus.textContent = `Selected ${asset.title}. ${decisions[check.decision].label}.`;
      panelStatus.textContent = "";
    });
    card.id = `placement-${id}`;
    card.setAttribute("aria-pressed", String(id === selectedId));
    card.setAttribute("aria-controls", "selected-photo");
    const picture = element("span", `placement-picture picture-${check.decision}`);
    picture.append(artwork(asset, true), decisionBadge(check.decision));
    const caption = element("span", "placement-caption");
    caption.append(element("strong", "placement-title", asset.title), element("span", "placement-condition", check.condition));
    card.append(picture, caption);
    return card;
  });

  placementsNode.replaceChildren(...cards);
}

function renderSelected(placement) {
  if (!placement) {
    selectedNode.replaceChildren(heading("Photos"), element("p", "", "The sample flyer has no photos left. Reload to start again."));
    return;
  }

  const { asset, check, credit, offerId } = placement;
  const title = heading(asset.title);
  title.classList.add("photo-heading");
  title.firstElementChild.id = "selected-heading";
  title.firstElementChild.tabIndex = -1;
  const origin = element("p", "sample-address asset-origin", asset.origin);
  const rights = element("div", "current-rights");
  const condition = element("p", "current-condition", check.condition);
  const metadata = element("dl", "metadata");
  term(metadata, "Destination checked", data.destinations[check.destination]);
  term(metadata, "Terms", check.version);
  term(metadata, "Credit", credit);

  rights.append(decisionBadge(check.decision), condition, metadata);
  if (offerId) rights.append(element("p", "agreement", "Accepted and applied in this page."));

  selectedNode.replaceChildren(title, origin, rights);
}

function thumbnail(asset, label, kind) {
  const figure = element("figure", `comparison-${kind}`);
  figure.append(artwork(asset), element("figcaption", "", label));
  return figure;
}

function applyOffer() {
  const offer = getPendingOffer(data, state, selectedId);
  if (!offer) return;
  state = acceptOffer(data, state, selectedId);
  counterOpen = false;
  render();
  pageStatus.textContent = publishingSummary();
  panelStatus.textContent = `Applied the replacement (${offer.license.version}). Recorded in this page only.`;
  document.querySelector("#selected-heading").focus();
}

function removePhoto(placement) {
  state = removePlacement(data, state, placement.id);
  selectedId = state.placements[0]?.id;
  counterOpen = false;
  render();
  pageStatus.textContent = publishingSummary();
  panelStatus.textContent = `Removed ${placement.asset.title} from this page’s flyer.`;
  document.querySelector("#selected-heading")?.focus();
}

function counterForm() {
  const form = element("form", "counter-form");
  form.id = "counter-form";
  const choices = element("fieldset", "counter-choices");
  choices.append(element("legend", "", "Choose a counterproposal"));
  for (const choice of data.negotiation.counters) {
    const label = element("label");
    const radio = element("input");
    radio.type = "radio";
    radio.name = "counter-choice";
    radio.value = choice.id;
    radio.required = true;
    label.append(radio, element("span", "", choice.message));
    choices.append(label);
  }

  const submit = element("button", "button button-outline", "Get sample reply");
  submit.type = "submit";
  form.append(choices, submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = new FormData(form).get("counter-choice");
    const result = counterOffer(data, state, selectedId, selected);
    if (result === state) return;
    state = result;
    counterOpen = false;
    render();
    panelStatus.textContent = state.history.at(-1).text;
    document.querySelector("#counter").focus();
  });

  return form;
}

function renderOffer(placement) {
  const offer = placement && getPendingOffer(data, state, placement.id);
  offerNode.replaceChildren();
  if (!offer) {
    if (placement?.check.decision === "blocked") {
      const section = element("section", "panel-section offer");
      section.append(
        element("p", "", "This sample has no replacement for the selected destination."),
        button("Remove", "button button-remove", () => removePhoto(placement))
      );
      offerNode.append(section);
    }
    return;
  }

  const section = element("section", "panel-section offer");
  const comparison = element("div", "comparison");
  comparison.append(thumbnail(placement.asset, "Current", "current"), thumbnail(offer.asset, "Proposed", "proposed"));
  const terms = element("div", "offer-terms");
  terms.append(
    element("h3", "", offer.asset.title),
    element("p", "", offer.credit),
    element("p", "", offer.check.condition),
    element("p", "terms-version", `Terms ${offer.license.version}`)
  );

  const actions = element("div", "offer-actions");
  const accept = button("Accept", "button button-primary", applyOffer);
  accept.setAttribute("aria-describedby", "accept-note");
  const counter = button("Counter", "button button-outline", () => {
    counterOpen = !counterOpen;
    renderOffer(placement);
    panelStatus.textContent = counterOpen ? "Choose a sample counterproposal to get a reply." : "Closed the counterproposal choices.";
    document.querySelector(counterOpen ? "#counter-form input" : "#counter").focus();
  });
  counter.id = "counter";
  counter.setAttribute("aria-expanded", String(counterOpen));
  if (counterOpen) counter.setAttribute("aria-controls", "counter-form");
  actions.append(accept, counter, button("Remove", "button button-remove", () => removePhoto(placement)));

  const note = element("p", "terms-note", "Records the agreement in this page only. No payment, no contract.");
  note.id = "accept-note";
  section.append(heading("Counteroffer"), comparison, terms, actions, note);
  if (counterOpen) section.append(counterForm());
  offerNode.append(section);
}

function renderHistory() {
  if (!state.history.length) {
    historyNode.replaceChildren(element("p", "quiet", "The sample exchange starts when you add Web."));
    return;
  }
  const timeline = element("ol", "timeline");
  timeline.setAttribute("role", "list");
  for (const entry of state.history) {
    const item = element("li", "");
    item.append(
      element("p", "history-who", entry.who),
      element("p", "history-title", entry.title),
      element("p", "history-text", entry.text)
    );
    timeline.append(item);
  }
  historyNode.replaceChildren(timeline);
}

function renderLedger() {
  const request = getLatestRequest(state);
  ledger.replaceChildren();
  if (request) {
    preflight.replaceChildren(
      element("strong", request.pass ? "preflight-pass" : "", request.pass ? "Pass" : "Needs attention"),
      document.createTextNode(request.pass ? " · Use tags and photo ID checked locally." : " · Check the sample request fields.")
    );
    const labels = request.uses.map((use) => `${data.destinations[use]} (${use})`).join(", ");
    term(ledger, "Would send", `Use tags: ${labels}. Photo ID: ${request.assetId}.`);
  } else {
    term(ledger, "Would send", "Use tags and the photo ID when a replacement is requested.");
  }
  term(ledger, "Would keep in this page", "Flyer draft and title. Counterproposal choices.");
}

function render() {
  const placements = getPlacementResults(data, state);
  const placement = placements.find(({ id }) => id === selectedId);
  alsoWeb.checked = state.alsoWeb;
  webOption.hidden = state.destination !== "venue";
  renderFlyer(placements);
  renderSelected(placement);
  renderOffer(placement);
  renderHistory();
  renderLedger();
}

function publishingSummary() {
  const labels = getDestinations(state).map((use) => data.destinations[use]).join(" + ");
  const placements = getPlacementResults(data, state);
  const usable = placements.filter(({ check }) => check.decision === "usable").length;
  return `${labels} · ${usable} of ${placements.length} sample placements usable.`;
}

function changePublishing(destination, publishOnWeb) {
  const previous = state;
  state = updatePublishing(data, state, destination, publishOnWeb);
  const offer = getPendingOffer(data, state, offerSlotId);
  const offerAvailable = offer && !getPendingOffer(data, previous, offerSlotId);
  if (offerAvailable) selectedId = offerSlotId;
  counterOpen = false;
  render();
  pageStatus.textContent = publishingSummary();
  if (offerAvailable) {
    const link = element("a", "", "View the counteroffer");
    link.href = "#offer";
    pageStatus.append(link);
  }
  panelStatus.textContent = "";
}

function downloadCredits() {
  const credits = makeCredits(data, state);
  const url = URL.createObjectURL(new Blob([credits.text], { type: "text/plain;charset=utf-8" }));
  const link = element("a");
  link.href = url;
  link.download = "edition-switch-sample-credits.txt";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const omitted = credits.omitted ? ` · ${credits.omitted} excluded` : "";
  pageStatus.textContent = `Downloaded sample credits · ${credits.included} included${omitted}.`;
}

palette.addEventListener("change", () => {
  document.documentElement.dataset.palette = palette.value;
  document.querySelector("#palette-status").textContent = `Palette changed to ${palette.selectedOptions[0].textContent}.`;
});

document.querySelector(".glossary-link").addEventListener("click", () => {
  document.querySelector("#words").open = true;
});

async function start() {
  const response = await fetch(new URL("./data/edition.json", import.meta.url));
  if (!response.ok) throw new Error("Sample data could not be loaded.");
  data = await response.json();
  state = createState(data);
  offerSlotId = data.slots.find(({ assetId }) => assetId === data.negotiation.assetId)?.id;
  selectedId = offerSlotId ?? data.slots[0]?.id;

  const flyerTitle = document.querySelector("#flyer-title");
  const lines = data.flyer.titleLines.map((line) => element("span", "", line));
  flyerTitle.append(lines[0], document.createTextNode(" "), lines[1]);
  document.querySelector("#flyer-dates").textContent = data.flyer.dates;
  document.querySelector("#flyer-venue").textContent = data.flyer.venue;
  document.querySelector("#usage-check").textContent = data.usageCheckUrl;

  destinations.querySelector('input[value="venue"]').checked = true;
  destinations.addEventListener("change", (event) => changePublishing(event.target.value, state.alsoWeb));
  alsoWeb.addEventListener("change", () => changePublishing("venue", alsoWeb.checked));
  exportButton.addEventListener("click", downloadCredits);
  render();
  pageStatus.textContent = publishingSummary();
  workspace.hidden = false;
  destinations.disabled = false;
  alsoWeb.disabled = false;
  exportButton.disabled = false;
}

start().catch(() => {
  pageStatus.textContent = "Could not load the sample. Open this page from a static server and reload.";
});
