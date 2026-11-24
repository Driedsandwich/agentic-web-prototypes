export function loadGraph(sample, address, consent) {
  if (address.trim() !== sample.graph.url) {
    return { error: 'Use the sample ferry graph address shown on this page.' };
  }
  if (!consent) {
    return { error: 'Allow the sample load first, then press Load.' };
  }
  return { graph: sample.graph, generation: 1, failure: null };
}

export function recordedRun(sample, generation) {
  return sample.runs.find((run) => run.generation === generation);
}

export function countDecisions(run) {
  const counts = { held: 0, broke: 0, stopped: 0 };
  for (const row of Object.values(run.results)) {
    for (const decision of Object.values(row)) {
      counts[decision] += 1;
    }
  }
  return counts;
}

export function inspectFailure(run, scenarioId, model) {
  const record = run.failures[scenarioId]?.[model];
  if (!record) return null;
  return {
    ...record,
    checks: record.checks.map((check) => ({
      ...check,
      passed: check.observed === check.expected,
    })),
  };
}

export function hardenGraph(sample, session) {
  if (session?.generation !== 1 || !session.failure) return session;
  return {
    graph: {
      ...session.graph,
      prompt: [...session.graph.prompt, ...sample.promptAdditions],
    },
    generation: 2,
    failure: null,
  };
}

export function exportGraph(sample, session) {
  if (session?.generation !== 2) return null;
  return { evidence: sample.label, generation: session.generation, ...session.graph };
}

export function createDeclaration(sample, session) {
  if (session?.generation !== 2) return null;
  const run = recordedRun(sample, session.generation);
  const testedWith = sample.models.filter((model) =>
    sample.scenarios.every(({ id }) => run.results[id][model] === 'held')
  );
  return {
    evidence: sample.label,
    graphUrl: session.graph.url,
    generation: run.generation,
    date: run.date,
    scenarioCount: sample.scenarios.length,
    testedWith,
    testedWithoutQualifying: sample.models.filter((model) => !testedWith.includes(model)),
  };
}

export function lookupCompatibility(declaration, address, modelName) {
  const graphUrl = address.trim();
  const model = modelName.trim();
  let status = 'Not tested';
  if (graphUrl === declaration?.graphUrl) {
    if (declaration.testedWith.includes(model)) status = 'Yes';
    if (declaration.testedWithoutQualifying.includes(model)) status = 'No';
  }
  return { evidence: 'Sample lookup', graphUrl, model, status };
}
