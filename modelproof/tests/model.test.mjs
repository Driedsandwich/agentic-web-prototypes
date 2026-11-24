import { test } from 'node:test';
import assert from 'node:assert/strict';
import sample from '../data/sample-run.json' with { type: 'json' };
import {
  loadGraph, recordedRun, countDecisions, inspectFailure, hardenGraph,
  createDeclaration, exportGraph, lookupCompatibility,
} from '../model.mjs';

const address = sample.graph.url;
const load = () => loadGraph(sample, address, true);

function inspect(session) {
  const run = recordedRun(sample, session.generation);
  return { ...session, failure: inspectFailure(run, 'date', 'Model D') };
}

const harden = () => hardenGraph(sample, inspect(load()));
const declaration = () => createDeclaration(sample, harden());

test('Load accepts the sample address with local consent and starts Generation 1', () => {
  const session = loadGraph(sample, ` ${address} `, true);
  assert.equal(session.generation, 1);
  assert.equal(session.graph.agents.length, 4);
  assert.equal(session.failure, null);
  assert.equal(recordedRun(sample, session.generation).generation, 1);
});

test('Load rejects other graph addresses and requires consent', () => {
  assert.ok(loadGraph(sample, 'https://other.example/agents', true).error);
  assert.ok(loadGraph(sample, address, false).error);
  assert.ok(loadGraph(sample, '', true).error);
});

test('each recording covers all 30 cells and matches the sample totals', () => {
  assert.equal(sample.label, 'Sample recorded run');
  assert.deepEqual(sample.budget, { currency: 'USD', capCents: 200, spentCents: 84 });
  assert.deepEqual(countDecisions(recordedRun(sample, 1)), { held: 19, broke: 8, stopped: 3 });
  assert.deepEqual(countDecisions(recordedRun(sample, 2)), { held: 27, broke: 2, stopped: 1 });
  for (const run of sample.runs) {
    assert.deepEqual(Object.keys(run.results), sample.scenarios.map(({ id }) => id));
    for (const row of Object.values(run.results)) {
      assert.deepEqual(Object.keys(row), sample.models);
    }
  }
});

test('every Broke cell has a turn and a failing fixed check, while other cells have no failure', () => {
  for (const run of sample.runs) {
    for (const { id } of sample.scenarios) {
      for (const model of sample.models) {
        const failure = inspectFailure(run, id, model);
        if (run.results[id][model] === 'broke') {
          assert.ok(failure.turn > 0 && failure.request && failure.response && failure.deviation);
          assert.ok(failure.checks.some((check) => !check.passed));
        } else {
          assert.equal(failure, null);
        }
      }
    }
  }
});

test('the Model D date failure exposes both passing and failing checks in order', () => {
  const record = inspectFailure(recordedRun(sample, 1), 'date', 'Model D');
  assert.equal(record.turn, 2);
  assert.deepEqual(record.checks.map(({ passed }) => passed), [true, false]);
  assert.equal(record.checks[1].expected, 'Yes');
  assert.equal(record.checks[1].observed, 'No');
});

test('Harden requires an inspected failure, adds precisely two lines and does not duplicate them on retry', () => {
  const initial = load();
  assert.equal(hardenGraph(sample, initial), initial);
  const hardened = hardenGraph(sample, inspect(initial));
  assert.equal(hardened.generation, 2);
  assert.equal(hardened.graph.prompt.length, initial.graph.prompt.length + 2);
  assert.deepEqual(hardened.graph.prompt, [...initial.graph.prompt, ...sample.promptAdditions]);
  assert.deepEqual(initial.graph, sample.graph);
  assert.equal(hardenGraph(sample, hardened), hardened);
  assert.equal(load().generation, 1);
  assert.deepEqual(load().graph.prompt, initial.graph.prompt);
});

test('replaying a generation returns the same recorded evidence and sample spend', () => {
  for (const session of [load(), harden()]) {
    const first = recordedRun(sample, session.generation);
    const replay = recordedRun(sample, session.generation);
    assert.deepEqual(replay.results, first.results);
    assert.equal(sample.budget.spentCents, 84);
  }
});

test('the declaration becomes available after Harden and lists A, B, C and E', () => {
  assert.equal(createDeclaration(sample, null), null);
  assert.equal(createDeclaration(sample, load()), null);
  const result = declaration();
  assert.deepEqual(result, {
    evidence: 'Sample recorded run',
    graphUrl: address,
    generation: 2,
    date: '2026-11-24',
    scenarioCount: 5,
    testedWith: ['Model A', 'Model B', 'Model C', 'Model E'],
    testedWithoutQualifying: ['Model D', 'Model F'],
  });
});

test('graph export includes the hardened prompt and original routes as JSON data', () => {
  assert.equal(exportGraph(sample, load()), null);
  const result = JSON.parse(JSON.stringify(exportGraph(sample, harden())));
  assert.equal(result.evidence, 'Sample recorded run');
  assert.equal(result.generation, 2);
  assert.equal(result.url, address);
  assert.deepEqual(result.routes, sample.graph.routes);
  assert.deepEqual(result.prompt, [...sample.graph.prompt, ...sample.promptAdditions]);
});

test('lookup answers Yes for a declared model using the exported declaration JSON', () => {
  const saved = JSON.parse(JSON.stringify(declaration()));
  assert.deepEqual(lookupCompatibility(saved, address, 'Model A'), {
    evidence: 'Sample lookup', graphUrl: address, model: 'Model A', status: 'Yes',
  });
});

test('lookup answers No for a tested model with a broken or stopped scenario', () => {
  for (const model of ['Model D', 'Model F']) {
    assert.equal(lookupCompatibility(declaration(), address, model).status, 'No');
  }
});

test('lookup answers Not tested for an unknown graph or model, or before publication', () => {
  const saved = declaration();
  assert.equal(lookupCompatibility(saved, address, 'Other model').status, 'Not tested');
  assert.equal(lookupCompatibility(saved, 'https://other.example/agents', 'Model A').status, 'Not tested');
  assert.equal(lookupCompatibility(null, address, 'Model A').status, 'Not tested');
});
