export function assembleAnswer(samples, questionId) {
  const question = samples.questions.find(({ id }) => id === questionId);
  if (!question) return null;

  const networksById = new Map(samples.networks.map((network) => [network.id, network]));
  const sentences = question.sourceOrder.map((network) => {
    const source = networksById.get(network);
    if (!source) throw new Error(`Missing sample source: ${network}`);
    const text = source.section.answerSentences[questionId];
    if (!text) throw new Error(`Missing sample sentence: ${network} for ${questionId}`);
    return { text, source };
  });

  return { sentences, callPath: samples.networks };
}

export function formatAttribution({ source, license }) {
  return `Built from ${source} · ${license} · not affiliated · Sample summary`;
}

export function formatManifest(manifest) {
  return JSON.stringify(manifest, null, 2);
}
