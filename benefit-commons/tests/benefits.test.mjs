import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { RULE_FILES, checkBenefits, makeChecklist } from "../benefits.mjs";

const programs = await Promise.all(RULE_FILES.map(async (name) => {
  const file = new URL(`../data/${name}.json`, import.meta.url);
  return JSON.parse(await readFile(file, "utf8"));
}));

const sampleInput = {
  state: "Ohio",
  householdSize: "3",
  monthlyIncome: "$2,400",
  children: "1",
  language: "English",
};

function firstEstimate(changes) {
  return checkBenefits(programs, { ...sampleInput, ...changes }).results[0];
}

test("all five rule files identify their sources, dates, and invented thresholds", () => {
  assert.equal(programs.length, 5);
  assert.equal(new Set(programs.map(({ source }) => source.site)).size, 5);

  for (const program of programs) {
    assert.match(program.title, /^Sample /);
    assert.equal(program.notice, "Sample rules — not the real program thresholds");
    assert.match(program.source.site, /\.example$/);
    assert.match(program.source.copiedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new URL(program.source.application).hostname, program.source.site);
    assert.ok(program.checklist.length > 0);
  }
});

test("the displayed sample input returns five ordered estimates with reasons and sources", () => {
  const { results } = checkBenefits(programs, sampleInput);

  assert.deepEqual(results.map(({ estimate }) => estimate), [
    "Likely", "Likely", "Maybe", "Likely", "Unlikely",
  ]);
  assert.deepEqual(results.map(({ program }) => program.id), RULE_FILES);
  assert.ok(results.every(({ reason }) => reason.length > 0));
  assert.equal(results[0].program.source.site, "school-meals-rules.example");
  assert.equal(results[0].program.source.copiedOn, "2026-11-20");
});

test("the exact income limit is included in Likely", () => {
  const result = firstEstimate({ monthlyIncome: "$2,475.00" });
  assert.equal(result.estimate, "Likely");
  assert.match(result.reason, /sample limit of \$2,475/);
});

test("the cent past the income limit and the review ceiling are Maybe", () => {
  assert.equal(firstEstimate({ monthlyIncome: "2475.01" }).estimate, "Maybe");
  assert.equal(firstEstimate({ monthlyIncome: "2725" }).estimate, "Maybe");
});

test("the cent past the review ceiling is Unlikely", () => {
  assert.equal(firstEstimate({ monthlyIncome: "$2,725.01" }).estimate, "Unlikely");
});

test("the sample limit changes with household size", () => {
  assert.equal(firstEstimate({ householdSize: "2" }).estimate, "Unlikely");
  assert.equal(firstEstimate({ householdSize: "4" }).estimate, "Likely");
});

test("zero children triggers the sample child requirement where applicable", () => {
  const { results } = checkBenefits(programs, { ...sampleInput, children: "0", monthlyIncome: "0" });
  assert.equal(results[0].estimate, "Unlikely");
  assert.match(results[0].reason, /requires at least one child/);
  assert.equal(results[1].estimate, "Likely");
  assert.equal(results[4].estimate, "Unlikely");
});

test("a state outside the sample rule coverage returns Maybe with a reason", () => {
  const { results } = checkBenefits(programs, { ...sampleInput, state: "Other state" });
  assert.ok(results.every(({ estimate, reason }) => estimate === "Maybe" && reason.includes("Ohio only")));
});

test("changing the example language does not change the estimates", () => {
  assert.deepEqual(
    checkBenefits(programs, { ...sampleInput, language: "Other language" }),
    checkBenefits(programs, sampleInput),
  );
});

test("blank, out-of-range, and fractional household sizes are rejected", () => {
  for (const householdSize of ["", "0", "100", "3.5"]) {
    const outcome = checkBenefits(programs, { ...sampleInput, householdSize });
    assert.equal(outcome.error.field, "householdSize");
  }
});

test("blank, negative, malformed, and unsafe income amounts are rejected", () => {
  for (const monthlyIncome of ["", "-1", "24,00", "0.001", "90071992547410"]) {
    const outcome = checkBenefits(programs, { ...sampleInput, monthlyIncome });
    assert.equal(outcome.error.field, "monthlyIncome");
  }
});

test("child counts must be whole and between zero and the household size", () => {
  for (const children of ["", "-1", "0.5", "4"]) {
    const outcome = checkBenefits(programs, { ...sampleInput, children });
    assert.equal(outcome.error.field, "children");
  }
  assert.equal(firstEstimate({ children: "3" }).estimate, "Likely");
});

test("checklist text includes the fictional program, source, and documents", () => {
  const { program } = firstEstimate({ monthlyIncome: "1234.56" });
  const checklist = makeChecklist(program);
  assert.match(checklist, /^Sample free or reduced-price school meals/);
  assert.match(checklist, /Sample rules — not the real program thresholds/);
  assert.match(checklist, /school-meals-rules\.example \(copied 2026-11-20\)/);
  assert.match(checklist, /^\[ \] Recent income records$/m);
  assert.doesNotMatch(checklist, /1234|Ohio|English|Likely/);
});
