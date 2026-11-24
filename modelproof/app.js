import sample from './data/sample-run.json' with { type: 'json' };
import {
  loadGraph, recordedRun, countDecisions, inspectFailure, hardenGraph,
  createDeclaration, exportGraph, lookupCompatibility,
} from './model.mjs';

const byId = (id) => document.getElementById(id);
const decisions = {
  held: { label: 'Held', short: 'H', description: 'behavior met' },
  broke: { label: 'Broke', short: 'B', description: 'behavior violated' },
  stopped: { label: 'Stopped', short: 'S', description: 'run ended early' },
};

let session = null;
let declaration = null;
let archivedFailure = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function report(message) {
  byId('action-status').textContent = message;
}

function decisionMark(decision) {
  const { label, short } = decisions[decision];
  const mark = element('span', `decision ${decision}`);
  const shape = element('span', 'decision-shape');
  const letter = element('span', 'decision-short', short);
  shape.setAttribute('aria-hidden', 'true');
  letter.setAttribute('aria-hidden', 'true');
  mark.append(shape, element('span', 'decision-label', label), letter);
  return mark;
}

function formatCounts(run) {
  const counts = countDecisions(run);
  return Object.entries(decisions).map(([key, { label }]) => `${counts[key]} ${label}`).join(' · ');
}

function showFailure(container, record, canHarden) {
  const { scenario, model, generation, failure } = record;
  const heading = element('h3', '', `${scenario.name} · ${model}`);
  heading.tabIndex = -1;
  const label = element('p', 'record-label', `${sample.label} · Generation ${generation} · Turn ${failure.turn}`);
  const deviation = element('p', 'deviation', failure.deviation);
  const trace = element('dl', 'trace');
  trace.append(
    element('dt', '', 'Visitor'),
    element('dd', '', failure.request),
    element('dt', '', 'Recorded action'),
    element('dd', '', failure.response),
  );
  const checks = element('ul', 'checks');
  for (const check of failure.checks) {
    const row = element('li');
    const result = element('strong', '', check.passed ? 'Pass' : 'Fail');
    row.append(result, ` ${check.label}. Expected ${check.expected}. Observed ${check.observed}.`);
    checks.append(row);
  }
  container.replaceChildren(heading, label, deviation, trace, element('h4', '', 'Fixed checks'), checks);
  if (canHarden) {
    const action = element('div', 'harden-action');
    const harden = element('button', '', 'Harden');
    harden.type = 'button';
    harden.addEventListener('click', applyHarden);
    action.append(harden, element('p', 'hint', 'Add two prompt lines and show Generation 2.'));
    container.append(action);
  }
  return heading;
}

function selectFailure(run, scenario, model) {
  const failure = inspectFailure(run, scenario.id, model);
  const record = { scenario, model, generation: run.generation, failure };
  session = { ...session, failure: record };
  if (run.generation === 1) {
    archivedFailure = record;
    renderArchive();
  }
  const panel = byId('active-failure');
  panel.hidden = false;
  showFailure(panel, record, run.generation === 1).focus();
  report(`Opened the recorded failure for ${model}.`);
}

function renderMatrix(run) {
  const table = byId('matrix');
  const header = document.createElement('thead');
  const heading = header.insertRow();
  const scenarioHeading = element('th', 'scenario-column', 'Scenario');
  scenarioHeading.scope = 'col';
  heading.append(scenarioHeading);
  for (const model of sample.models) {
    const th = element('th', 'model-column');
    th.scope = 'col';
    th.append(element('span', 'model-prefix', 'Model '), model.slice('Model '.length));
    heading.append(th);
  }

  const body = document.createElement('tbody');
  for (const scenario of sample.scenarios) {
    const row = body.insertRow();
    const name = element('th', '', scenario.name);
    name.scope = 'row';
    row.append(name);
    for (const model of sample.models) {
      const decision = run.results[scenario.id][model];
      const cell = row.insertCell();
      const mark = decisionMark(decision);
      if (decision === 'broke') {
        const button = element('button', 'cell-button');
        button.type = 'button';
        button.setAttribute('aria-label', `Broke: ${scenario.name}, ${model}. Inspect failure.`);
        button.addEventListener('click', () => selectFailure(run, scenario, model));
        button.append(mark);
        cell.append(button);
      } else {
        cell.append(mark);
      }
    }
  }
  table.replaceChildren(header, body);
}

function renderArchive() {
  const title = byId('archive-title');
  const content = byId('archived-failure');
  if (archivedFailure) {
    title.textContent = `Generation 1 failure · ${archivedFailure.model}`;
    showFailure(content, archivedFailure, false);
  } else {
    title.textContent = 'Generation 1 failure';
    content.replaceChildren(element('p', '', 'Inspect a Broke result in Generation 1 to see the record here.'));
  }
}

function renderEvidence() {
  const run = recordedRun(sample, session.generation);
  const hardened = run.generation === 2;
  byId('evidence-heading').textContent = `Test evidence · Generation ${run.generation}`;
  byId('evidence-note').textContent = `${sample.label}. Select a Broke result to inspect what happened.`;
  byId('current-counts').textContent = formatCounts(run);
  const previous = byId('previous-counts');
  previous.hidden = !hardened;
  if (hardened) {
    previous.textContent = `Gen 1: ${formatCounts(recordedRun(sample, 1))}`;
  }
  byId('evidence-counts').hidden = false;
  byId('active-failure').hidden = true;
  renderMatrix(run);
  byId('matrix-wrap').hidden = false;
  byId('run-tests').disabled = false;
}

function renderDeclaration() {
  declaration = createDeclaration(sample, session);
  const summary = byId('declaration-summary');
  const models = byId('declared-models');
  byId('export-declaration').disabled = !declaration;
  byId('export-graph').disabled = !declaration;
  models.hidden = !declaration;
  models.replaceChildren();
  if (!declaration) {
    summary.textContent = 'Apply Harden after inspecting a broken result to see which models can be declared.';
    return;
  }
  const testedWith = declaration.testedWith.join(', ').replaceAll(', Model ', ', ');
  summary.textContent = `Tested with ${testedWith} on ${declaration.date} · ${declaration.scenarioCount} scenarios · Generation ${declaration.generation}`;
  models.append(...declaration.testedWith.map((model) => element('li', '', model)));
}

function renderPromptChanges(show) {
  const lines = byId('prompt-lines');
  byId('prompt-intro').textContent = show
    ? 'Two instructions added to the sample graph.'
    : 'Harden adds two instructions and shows the second recorded run.';
  lines.hidden = !show;
  lines.replaceChildren();
  if (show) {
    lines.append(...sample.promptAdditions.map((line) => {
      const item = element('li');
      const plus = element('span', 'addition-sign', '+');
      plus.setAttribute('aria-hidden', 'true');
      item.append(plus, line);
      return item;
    }));
  }
  byId('prompt-changes').open = show;
}

function clearLookup() {
  byId('lookup-result').hidden = true;
  byId('lookup-answer').textContent = '';
}

function applyHarden() {
  session = hardenGraph(sample, session);
  renderEvidence();
  renderDeclaration();
  renderPromptChanges(true);
  clearLookup();
  byId('prompt-changes').querySelector('summary').focus();
  report('Added two prompt lines and opened Generation 2.');
}

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

byId('load-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const result = loadGraph(sample, byId('graph-address').value, byId('load-consent').checked);
  if (result.error) {
    report(result.error);
    return;
  }
  session = result;
  archivedFailure = null;
  byId('archive').open = false;
  renderArchive();
  renderPromptChanges(false);
  renderEvidence();
  renderDeclaration();
  clearLookup();
  byId('evidence-heading').focus();
  report('Loaded the sample graph and opened Generation 1.');
});

byId('load-consent').addEventListener('change', (event) => {
  report(event.target.checked ? 'Sample load allowed. Press Load to continue.' : 'Sample load permission cleared.');
});

byId('run-tests').addEventListener('click', () => {
  session = { ...session, failure: null };
  renderEvidence();
  byId('evidence-heading').focus();
  report(`Replayed the sample recording for Generation ${session.generation}.`);
});

byId('export-declaration').addEventListener('click', () => {
  download('sample-declaration.json', declaration);
  report('Started the sample declaration download.');
});

byId('export-graph').addEventListener('click', () => {
  download('sample-graph.json', exportGraph(sample, session));
  report('Started the sample graph JSON download.');
});

byId('copy-address').addEventListener('click', async () => {
  const input = byId('lookup-address');
  try {
    await navigator.clipboard.writeText(input.value);
    report('Copied the sample lookup address.');
  } catch {
    input.focus();
    input.select();
    report('Sample address selected. Use your device’s copy command.');
  }
});

byId('lookup-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const result = lookupCompatibility(declaration, byId('lookup-graph').value, byId('lookup-model').value);
  const explanations = {
    Yes: 'The model held in all five scenarios.',
    No: 'The model was tested and did not hold in every scenario.',
    'Not tested': 'The current declaration has no record for this graph and model.',
  };
  byId('lookup-result').hidden = false;
  const answer = byId('lookup-answer');
  answer.replaceChildren(element('strong', '', result.status), ` · ${explanations[result.status]}`);
  byId('lookup-json').textContent = JSON.stringify(result, null, 2);
  report('Checked the sample declaration in this page.');
});

byId('lookup-form').addEventListener('input', clearLookup);

byId('palette').addEventListener('change', (event) => {
  document.documentElement.dataset.palette = event.target.value;
  report(`Switched to the ${event.target.value} palette.`);
});

const cap = byId('budget-cap');
let budgetCap = sample.budget.capCents / 100;
cap.value = budgetCap.toFixed(2);
byId('spent').textContent = `$${(sample.budget.spentCents / 100).toFixed(2)}`;
cap.addEventListener('change', () => {
  if (!cap.validity.valid || !Number.isFinite(cap.valueAsNumber)) {
    cap.value = budgetCap.toFixed(2);
    report('Enter a budget cap of zero or more, to the nearest cent.');
    return;
  }
  budgetCap = cap.valueAsNumber;
  cap.value = budgetCap.toFixed(2);
  report('Sample budget cap recorded in this page only.');
});

byId('agent-count').prepend(`${sample.graph.agents.length} agents `);
const modelSelect = byId('lookup-model');
for (const model of [...sample.models, 'Other model']) modelSelect.add(new Option(model, model));
for (const [key, { description }] of Object.entries(decisions)) {
  const item = element('span', 'legend-item');
  item.append(decisionMark(key), `= ${description}`);
  byId('legend').append(item);
}
byId('load-button').disabled = false;
byId('copy-address').disabled = false;
byId('check-compatibility').disabled = false;
