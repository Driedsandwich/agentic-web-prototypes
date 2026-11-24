import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assembleAnswer, formatAttribution, formatManifest } from "../samples.mjs";

const samples = JSON.parse(readFileSync(new URL("../data/samples.json", import.meta.url), "utf8"));
const path = ["spec-docs", "mcp-spec-docs", "web-platform-docs"];

test("the picker offers three distinct questions and starts with the specified example", () => {
  assert.equal(samples.questions.length, 3);
  assert.equal(new Set(samples.questions.map(({ id }) => id)).size, 3);
  assert.equal(new Set(samples.questions.map(({ prompt }) => prompt)).size, 3);
  assert.equal(
    samples.questions[0].prompt,
    "A partner network runs in my visitor's browser. What does my MCP endpoint need so that the partner can call it?",
  );
});

const sourceOrderByQuestion = {
  "partner-call": ["spec-docs", "web-platform-docs", "mcp-spec-docs"],
  "caller-origin": ["spec-docs", "web-platform-docs", "mcp-spec-docs"],
  "preflight": ["web-platform-docs", "spec-docs", "mcp-spec-docs"],
};

for (const [id, sourceOrder] of Object.entries(sourceOrderByQuestion)) {
  test(`${id} assembles three sentences with their sections and a fixed call path`, () => {
    const answer = assembleAnswer(samples, id);
    assert.equal(answer.sentences.length, 3);
    assert.deepEqual(answer.sentences.map(({ source }) => source.id), sourceOrder);
    assert.deepEqual(answer.callPath.map(({ id }) => id), path);
    for (const { text, source } of answer.sentences) {
      assert.match(text, /\S.*\.$/);
      assert.equal(text, source.section.answerSentences[id]);
      assert.ok(source.section.title);
      assert.ok(source.section.summary);
      assert.ok(answer.callPath.includes(source));
    }
  });
}

test("assembling answers is repeatable and leaves the sample data intact", () => {
  const snapshot = structuredClone(samples);
  const firstAnswer = assembleAnswer(samples, "partner-call");
  const secondAnswer = assembleAnswer(samples, "caller-origin");
  assert.notDeepEqual(firstAnswer.sentences, secondAnswer.sentences);
  assert.deepEqual(assembleAnswer(samples, "partner-call"), firstAnswer);
  assert.deepEqual(samples, snapshot);
});

test("every network has a fictional address, distinct source mark, and licensed attribution", () => {
  const networks = samples.networks.map(({ address, mark, section, ...network }) => [
    new URL(address).hostname,
    mark,
    section.title,
    formatAttribution(network),
  ]);
  assert.deepEqual(networks, [
    ["docmesh.example", "AGW", "§3.4 Public artifacts and CORS",
      "Built from Agentic web spec · Apache-2.0 · not affiliated · Sample summary"],
    ["mcp-docs.example", "MCP", "Transports",
      "Built from MCP specification · Apache-2.0 · not affiliated · Sample summary"],
    ["webdocs.example", "MDN", "CORS",
      "Built from MDN Web Docs · CC-BY-SA 2.5 · not affiliated · Sample summary"],
  ]);
});

test("the fixture supplies a sample pass and the copy template contains four parseable lines", () => {
  assert.deepEqual(samples.preflight, { result: "Pass", tool: "Peer Preflight" });
  const template = formatManifest(samples.manifest);
  assert.equal(template, '{\n  "name": "my-docs",\n  "readTool": "read_section"\n}');
  assert.equal(template.split("\n").length, 4);
  assert.deepEqual(JSON.parse(template), samples.manifest);
});

test("there is no answer for an unlisted question", () => {
  assert.equal(assembleAnswer(samples, "unknown"), null);
});

test("a broken source reference cannot produce an uncited answer", () => {
  const incomplete = { ...samples, networks: samples.networks.slice(1) };
  assert.throws(() => assembleAnswer(incomplete, "partner-call"), /Missing sample source/);
});

test("an incomplete section cannot produce a sample answer", () => {
  const incomplete = structuredClone(samples);
  delete incomplete.networks[0].section.answerSentences["partner-call"];
  assert.throws(() => assembleAnswer(incomplete, "partner-call"), /Missing sample sentence/);
});
