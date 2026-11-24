export const RULE_FILES = [
  "school-meals",
  "phone-discount",
  "earned-income-credit",
  "health-marketplace",
  "early-education",
];

const FORMAT_DOLLARS = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function incomeInCents(rawIncome) {
  const match = rawIncome.trim().match(/^\$?(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/);
  if (!match) return NaN;

  const dollars = match[1].replaceAll(",", "");
  const cents = (match[2] ?? "").padEnd(2, "0");
  return Number(dollars + cents);
}

function enteredInteger(text) {
  return text.trim() ? Number(text) : NaN;
}

function estimateProgram(program, { state, householdSize, monthlyIncomeCents, children }) {
  const rule = program.rule;
  const limit = rule.baseMonthlyCents + (householdSize - 1) * rule.additionalPersonCents;
  const reviewLimit = limit + rule.reviewRangeCents;
  const formattedLimit = FORMAT_DOLLARS.format(limit / 100);

  if (state !== rule.state) {
    return { program, estimate: "Maybe", reason: `This sample rule copy covers ${rule.state} only.` };
  }
  if (children < rule.minimumChildren) {
    return { program, estimate: "Unlikely", reason: "This sample rule requires at least one child under 18." };
  }
  if (monthlyIncomeCents <= limit) {
    return { program, estimate: "Likely", reason: `Income is at or below the sample limit of ${formattedLimit} per month for this household size.` };
  }
  const upperLimit = FORMAT_DOLLARS.format(reviewLimit / 100);
  if (monthlyIncomeCents <= reviewLimit) {
    return { program, estimate: "Maybe", reason: `Income is above ${formattedLimit} and within the sample review range up to ${upperLimit} per month.` };
  }
  return { program, estimate: "Unlikely", reason: `Income is above the sample review range of up to ${upperLimit} per month.` };
}

export function checkBenefits(programs, input) {
  const householdSize = enteredInteger(input.householdSize);
  const monthlyIncomeCents = incomeInCents(input.monthlyIncome);
  const children = enteredInteger(input.children);

  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 99) {
    return { error: { field: "householdSize", message: "Enter a household size from 1 to 99." } };
  }
  if (!Number.isSafeInteger(monthlyIncomeCents)) {
    return { error: { field: "monthlyIncome", message: "Enter a monthly income in dollars, such as 2400 or 2400.50." } };
  }
  if (!Number.isInteger(children) || children < 0 || children > householdSize) {
    return { error: { field: "children", message: "Enter a whole number of children from 0 up to the household size." } };
  }

  const values = { state: input.state, householdSize, monthlyIncomeCents, children };
  return { results: programs.map((program) => estimateProgram(program, values)) };
}

export function makeChecklist(program) {
  return [
    program.title,
    program.notice,
    `Sample source: ${program.source.site} (copied ${program.source.copiedOn})`,
    "",
    "Sample documents to gather",
    ...program.checklist.map((item) => `[ ] ${item}`),
    "",
  ].join("\n");
}
