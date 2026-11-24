import { deepEqual, equal, notEqual } from "node:assert/strict";
import { test } from "node:test";
import {
  PAUSE_MS, applyPause, canObservePause, createState, getLayout, getLedger, getReview, isSampleValue,
  reviewInputs, setAdaptive, setInput, submitSample, toggleOriginal, togglePayment, undoChange,
} from "../model.mjs";

const demo = (state = createState()) => applyPause(state, { source: "demo" });

test("the initial sample has an open payment section and companion fields in their original place", () => {
  const state = createState();
  equal(state.adaptive, true);
  deepEqual(getLayout(state), {
    hasCompanion: true, exampleOpen: false, fieldsMoved: false, paymentOpen: true,
  });
  deepEqual(getLedger(state), { fieldIds: [], signal: null, enteredValuesShared: 0 });
});

test("focused pause applies at eight seconds and does not repeat on the next pause", () => {
  const state = createState();
  equal(PAUSE_MS, 8_000);
  equal(applyPause(state, { source: "focus", elapsedMs: PAUSE_MS - 1 }), state);
  const paused = applyPause(state, { source: "focus", elapsedMs: PAUSE_MS });
  notEqual(paused, state);
  equal(canObservePause(paused), false);
  equal(applyPause(paused, { source: "focus", elapsedMs: PAUSE_MS }), paused);
  deepEqual(getLedger(paused).signal, { source: "focus", seconds: 8 });
});

test("the pause demo immediately applies the three changes without editing the inputs", () => {
  const state = setInput(createState(), "companion_name", "Test Guest");
  const adapted = demo(state);
  deepEqual(getLayout(adapted), {
    hasCompanion: true, exampleOpen: true, fieldsMoved: true, paymentOpen: false,
  });
  deepEqual(adapted.inputs, state.inputs);
  deepEqual(getLedger(adapted).signal, { source: "demo", seconds: 8 });
});

test("each change can be undone alone", () => {
  const state = demo();
  equal(getLayout(undoChange(state, "example")).exampleOpen, false);
  equal(getLayout(undoChange(state, "example")).fieldsMoved, true);
  equal(getLayout(undoChange(state, "payment")).paymentOpen, true);
  equal(getLayout(undoChange(state, "payment")).exampleOpen, true);
  equal(getLayout(undoChange(state, "move")).fieldsMoved, false);
  equal(getLayout(undoChange(state, "move")).paymentOpen, false);
});

test("Show original previews each earlier layout and Show adapted brings the change back", () => {
  const state = demo();
  for (const [change, layoutKey, original] of [
    ["example", "exampleOpen", false], ["payment", "paymentOpen", true], ["move", "fieldsMoved", false],
  ]) {
    const preview = toggleOriginal(state, change);
    equal(preview.changes[change], "original");
    equal(getLayout(preview)[layoutKey], original);
    deepEqual(getLayout(toggleOriginal(preview, change)), getLayout(state));
  }
});

test("undoing a preview clears the change until the visitor explicitly replays the demo", () => {
  const state = demo();
  const undone = undoChange(toggleOriginal(state, "example"), "example");
  equal(toggleOriginal(undone, "example"), undone);
  equal(applyPause(undone, { source: "focus", elapsedMs: PAUSE_MS }), undone);
  equal(getLayout(demo(undone)).exampleOpen, true);
});

test("turning off adaptive help restores layout, preserves edits and ignores future pauses", () => {
  const adapted = setInput(demo(), "accessibility_needs", "Test access request");
  const off = setAdaptive(adapted, false);
  deepEqual(getLayout(off), getLayout(createState()));
  equal(off.inputs.accessibility_needs, "Test access request");
  deepEqual(getLedger(off), getLedger(adapted));
  equal(canObservePause(off), false);
  equal(demo(off), off);
  equal(applyPause(off, { source: "focus", elapsedMs: PAUSE_MS }), off);

  const enabled = setAdaptive(off, true);
  equal(canObservePause(enabled), true);
  deepEqual(getLayout(enabled), getLayout(createState()));
});

test("payment can be manually reopened while adapted and a prior manual closure is preserved", () => {
  const adapted = demo();
  equal(getLayout(togglePayment(adapted)).paymentOpen, true);
  equal(getLayout(togglePayment(togglePayment(adapted))).paymentOpen, false);
  equal(getLayout(undoChange(adapted, "payment")).paymentOpen, true);

  const closed = togglePayment(createState());
  const demoAfterClosure = demo(closed);
  equal(demoAfterClosure.changes.payment, null);
  equal(getLayout(setAdaptive(demoAfterClosure, false)).paymentOpen, false);
});

test("companion fields are conditional and their values come back if Yes is reselected", () => {
  const no = setInput(createState(), "companion", "No");
  const adapted = demo(no);
  equal(getLayout(adapted).fieldsMoved, false);
  equal(getLayout(adapted).hasCompanion, false);
  equal(getReview(adapted).rows.some((row) => row.id === "companion_name" || row.id === "age_group"), false);
  const yes = setInput(adapted, "companion", "Yes");
  equal(getLayout(yes).fieldsMoved, true);
  equal(yes.inputs.companion_name, createState().inputs.companion_name);
});

test("the ledger contains fixed identifiers and the pause only, even after personal text is entered", () => {
  const state = setInput(createState(), "companion_name", "Local text for testing");
  const ledger = getLedger(demo(state));
  deepEqual(ledger, {
    fieldIds: ["companion", "companion_name", "payment_method"],
    signal: { source: "demo", seconds: 8 },
    enteredValuesShared: 0,
  });
});

test("review contains every applicable input and identifies sample values", () => {
  const state = setInput(createState(), "attendee_name", "Test Applicant");
  const review = getReview(state);
  deepEqual(review.rows.map((row) => row.id), Object.keys(createState().inputs));
  deepEqual(review.rows[0], {
    id: "attendee_name", label: "Your name", value: "Test Applicant", sample: false, missing: false,
  });
  equal(isSampleValue(state, "companion_name"), true);
  equal(isSampleValue(setInput(state, "course", "Hand sewing basics"), "course"), true);
});

test("submit requires a fresh review, accepts valid samples and becomes eligible again after another review", () => {
  const state = createState();
  equal(submitSample(state), state);
  const submitted = submitSample(reviewInputs(state));
  equal(submitted.submitted, true);
  equal(submitSample(submitted), submitted);

  const edited = setInput(submitted, "attendee_name", "Test Applicant");
  equal(edited.reviewed, false);
  equal(edited.submitted, false);
  equal(submitSample(edited), edited);
  equal(submitSample(reviewInputs(edited)).submitted, true);
});

test("review catches missing required companion fields only when Yes is selected", () => {
  const noName = setInput(createState(), "companion_name", "  ");
  const noAge = setInput(noName, "age_group", "");
  const reviewed = reviewInputs(noAge);
  deepEqual(getReview(reviewed).missing.map((row) => row.id), ["companion_name", "age_group"]);
  equal(submitSample(reviewed), reviewed);
  equal(submitSample(reviewInputs(setInput(reviewed, "companion", "No"))).submitted, true);
});
