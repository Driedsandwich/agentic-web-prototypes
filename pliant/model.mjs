export const PAUSE_MS = 8_000;

export const SAMPLE_VALUES = Object.freeze({
  attendee_name: "Sample Applicant",
  course: "Bookbinding basics",
  companion: "Yes",
  companion_name: "Sample Guest",
  age_group: "Adult",
  accessibility_needs: "",
  payment_method: "Card at the venue",
});

const FIELDS = [
  { id: "attendee_name", label: "Your name", required: true },
  { id: "course", label: "Course choice", required: true, sampleChoices: true },
  { id: "companion", label: "Bringing a companion?", required: true },
  { id: "companion_name", label: "Companion name", required: true, companionOnly: true },
  { id: "age_group", label: "Age group", required: true, companionOnly: true },
  { id: "accessibility_needs", label: "Accessibility needs" },
  { id: "payment_method", label: "Payment method", required: true, sampleChoices: true },
];

const SIGNAL_FIELDS = Object.freeze(["companion", "companion_name", "payment_method"]);
const ORIGINAL = Object.freeze({ example: null, payment: null, move: null });

export function createState() {
  return {
    inputs: { ...SAMPLE_VALUES },
    adaptive: true,
    pauseUsed: false,
    signal: null,
    changes: ORIGINAL,
    paymentOpen: true,
    adaptedPaymentOpen: false,
    reviewed: false,
    submitted: false,
  };
}

export function setInput(state, id, value) {
  if (!Object.hasOwn(SAMPLE_VALUES, id) || state.inputs[id] === value) return state;
  return {
    ...state,
    inputs: { ...state.inputs, [id]: value },
    reviewed: false,
    submitted: false,
  };
}

export function isSampleValue(state, id) {
  const field = FIELDS.find((item) => item.id === id);
  const value = state.inputs[id];
  return Boolean(value && (field?.sampleChoices || value === SAMPLE_VALUES[id]));
}

export function setAdaptive(state, adaptive) {
  if (state.adaptive === adaptive) return state;
  return { ...state, adaptive, pauseUsed: false, changes: ORIGINAL, adaptedPaymentOpen: false };
}

export function canObservePause(state) {
  return state.adaptive && !state.pauseUsed;
}

export function applyPause(state, { source, elapsedMs = 0 }) {
  if (!state.adaptive) return state;
  if (source === "focus") {
    if (state.pauseUsed || elapsedMs < PAUSE_MS) return state;
  } else if (source !== "demo") {
    return state;
  }

  return {
    ...state,
    pauseUsed: true,
    signal: { source, seconds: PAUSE_MS / 1_000 },
    changes: { example: "adapted", payment: state.paymentOpen ? "adapted" : null, move: "adapted" },
    adaptedPaymentOpen: false,
  };
}

export function getLayout(state) {
  const hasCompanion = state.inputs.companion === "Yes";
  return {
    hasCompanion,
    exampleOpen: state.changes.example === "adapted",
    fieldsMoved: hasCompanion && state.changes.move === "adapted",
    paymentOpen: state.changes.payment === "adapted" ? state.adaptedPaymentOpen : state.paymentOpen,
  };
}

export function togglePayment(state) {
  if (state.changes.payment === "adapted") {
    return { ...state, adaptedPaymentOpen: !state.adaptedPaymentOpen };
  }
  return { ...state, paymentOpen: !state.paymentOpen };
}

export function undoChange(state, change) {
  if (!state.changes[change]) return state;
  return { ...state, changes: { ...state.changes, [change]: null } };
}

export function toggleOriginal(state, change) {
  const current = state.changes[change];
  if (!current) return state;
  return {
    ...state,
    changes: { ...state.changes, [change]: current === "original" ? "adapted" : "original" },
    adaptedPaymentOpen: change === "payment" ? false : state.adaptedPaymentOpen,
  };
}

export function getLedger(state) {
  return {
    fieldIds: state.signal ? SIGNAL_FIELDS : [],
    signal: state.signal,
    enteredValuesShared: 0,
  };
}

export function getReview(state) {
  const hasCompanion = state.inputs.companion === "Yes";
  const rows = FIELDS.filter((field) => !field.companionOnly || hasCompanion).map((field) => {
    const value = state.inputs[field.id];
    return {
      id: field.id,
      label: field.label,
      value,
      sample: isSampleValue(state, field.id),
      missing: Boolean(field.required && !value.trim()),
    };
  });
  return {
    rows,
    missing: rows.filter((row) => row.missing),
  };
}

export function reviewInputs(state) {
  return { ...state, reviewed: true };
}

export function submitSample(state) {
  if (!state.reviewed || state.submitted || getReview(state).missing.length) return state;
  return { ...state, submitted: true };
}
