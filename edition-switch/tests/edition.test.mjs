import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acceptOffer,
  counterOffer,
  createState,
  evaluateLicense,
  getDestinations,
  getLatestRequest,
  getPendingOffer,
  getPlacementResults,
  makeCredits,
  removePlacement,
  updatePublishing
} from "../edition.mjs";

const data = JSON.parse(await readFile(new URL("../data/edition.json", import.meta.url), "utf8"));
const webState = () => updatePublishing(data, createState(data), "venue", true);
const pier = (state) => getPlacementResults(data, state).find(({ id }) => id === "pier");

test("the sample opens with venue handouts only and all three assets usable", () => {
  const state = createState(data);
  assert.deepEqual(getDestinations(state), ["venue"]);
  assert.deepEqual(getPlacementResults(data, state).map(({ check }) => check.decision), ["usable", "usable", "usable"]);
  assert.equal(getPendingOffer(data, state, "pier"), null);
  assert.equal(getLatestRequest(state), null);
  assert.equal(state.history.length, 0);
});

test("adding Web shows the print-only condition and prepares the v3 crop without changing the flyer", () => {
  const state = webState();
  assert.deepEqual(getDestinations(state), ["venue", "web"]);
  assert.deepEqual(getPlacementResults(data, state).map(({ check }) => check.decision), ["usable", "blocked", "usable"]);
  assert.equal(pier(state).check.condition, "Licensed for printed handouts only.");
  assert.equal(pier(state).check.version, "v2");
  assert.equal(pier(state).assetId, "pier-at-dusk");
  const offer = getPendingOffer(data, state, "pier");
  assert.equal(offer.assetId, "pier-web-crop");
  assert.match(offer.asset.title, /1600 px/);
  assert.match(offer.check.condition, /2027-03-31/);
  assert.equal(offer.credit, "Photo: Studio Kite");
  assert.equal(offer.license.version, "v3");
  assert.equal(state.history.length, 2);
});

test("the sample request is valid and carries only use tags and the photo ID", () => {
  const state = webState();
  const request = state.history[0].request;
  assert.deepEqual(request, { uses: ["venue", "web"], assetId: "pier-at-dusk" });
  assert.deepEqual(getLatestRequest(state), { ...request, pass: true });
});

test("accept applies the current offer once and checks the replacement's terms", () => {
  const before = webState();
  const accepted = acceptOffer(data, before, "pier");
  assert.equal(pier(before).assetId, "pier-at-dusk");
  assert.equal(pier(accepted).assetId, "pier-web-crop");
  assert.equal(pier(accepted).check.decision, "usable");
  assert.equal(pier(accepted).check.version, "v3");
  assert.equal(accepted.history.at(-1).title, "Accepted and applied");
  assert.equal(getPendingOffer(data, accepted, "pier"), null);
  assert.equal(acceptOffer(data, accepted, "pier"), accepted);
});

test("an April counter yields v4 and updates the credits only after acceptance", () => {
  const before = webState();
  const revised = counterOffer(data, before, "pier", "april");
  assert.equal(getPendingOffer(data, before, "pier").license.version, "v3");
  assert.equal(getPendingOffer(data, revised, "pier").license.version, "v4");
  assert.match(getPendingOffer(data, revised, "pier").check.condition, /2027-04-30/);
  assert.equal(pier(revised).assetId, "pier-at-dusk");
  assert.equal(revised.history.at(-1).who, "Rights holder");
  assert.equal(makeCredits(data, revised).included, 2);
  const accepted = acceptOffer(data, revised, "pier");
  assert.equal(pier(accepted).check.version, "v4");
  assert.match(makeCredits(data, accepted).text, /Studio Kite \/ Harbor Collection/);
});

test("a Social counter leaves the previously offered terms available", () => {
  const revised = counterOffer(data, webState(), "pier", "april");
  const declined = counterOffer(data, revised, "pier", "social");
  assert.match(declined.history.at(-1).text, /Social use is outside/);
  assert.equal(getPendingOffer(data, declined, "pier").license.version, "v4");
  assert.equal(pier(declined).assetId, "pier-at-dusk");
});

test("switching destinations hides unrelated offers, and returning restores the pending terms", () => {
  const revised = counterOffer(data, webState(), "pier", "april");
  const venueOnly = updatePublishing(data, revised, "venue", false);
  assert.equal(getPendingOffer(data, venueOnly, "pier"), null);
  assert.equal(acceptOffer(data, venueOnly, "pier"), venueOnly);
  const webOnly = updatePublishing(data, venueOnly, "web");
  assert.deepEqual(getDestinations(webOnly), ["web"]);
  assert.equal(getPendingOffer(data, webOnly, "pier").license.version, "v3");
  const restored = updatePublishing(data, webOnly, "venue", true);
  assert.equal(getPendingOffer(data, restored, "pier").license.version, "v4");
  assert.equal(restored.history.length, webOnly.history.length);
});

test("Social checks all assets and does not inherit permission from an accepted Web offer", () => {
  const accepted = acceptOffer(data, webState(), "pier");
  const social = updatePublishing(data, accepted, "social");
  assert.deepEqual(getDestinations(social), ["social"]);
  assert.deepEqual(getPlacementResults(data, social).map(({ check }) => check.decision), ["usable", "blocked", "review"]);
  assert.equal(getPendingOffer(data, social, "pier"), null);
  assert.equal(makeCredits(data, social).omitted, 2);
});

test("missing terms require review and a blocked destination takes precedence", () => {
  const license = data.assets["pier-at-dusk"].license;
  assert.equal(evaluateLicense(data, { ...license, uses: {} }, ["venue"]).decision, "review");
  const blocked = evaluateLicense(data, { ...license, uses: { web: license.uses.web } }, ["web", "social"]);
  assert.equal(blocked.decision, "blocked");
  assert.equal(blocked.destination, "web");
  assert.deepEqual(blocked.results.map(({ decision }) => decision), ["blocked", "review"]);
});

test("Remove drops the placement and its credits and records the action", () => {
  const before = webState();
  const removed = removePlacement(data, before, "pier");
  assert.equal(pier(before).assetId, "pier-at-dusk");
  assert.equal(pier(removed), undefined);
  assert.equal(getPendingOffer(data, removed, "pier"), null);
  assert.equal(removed.history.at(-1).title, "Removed from the flyer");
  assert.equal(makeCredits(data, removed).included, 2);
  assert.doesNotMatch(makeCredits(data, removed).text, /Studio Kite/);
  assert.equal(removePlacement(data, removed, "pier"), removed);
});

test("credits describe the sample destinations and only list usable placed assets", () => {
  const blocked = webState();
  const draft = makeCredits(data, blocked);
  assert.equal(draft.omitted, 1);
  assert.doesNotMatch(draft.text, /Studio Kite/);
  const final = makeCredits(data, acceptOffer(data, blocked, "pier"));
  assert.match(final.text, /^Sample — Harbor Light Photo Week/);
  assert.match(final.text, /Venue handout \+ Web/);
  assert.match(final.text, /web crop 1600 px — Photo: Studio Kite/);
  assert.match(final.text, /Photo: Point Archive/);
  assert.match(final.text, /Map: Inlet Maps/);
  assert.equal(final.included, 3);
  assert.equal(final.omitted, 0);
});
