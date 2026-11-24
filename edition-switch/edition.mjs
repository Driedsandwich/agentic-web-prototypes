const priority = { usable: 0, review: 1, blocked: 2 };

export function createState(data) {
  return {
    destination: "venue",
    alsoWeb: false,
    placements: data.slots.map((slot) => ({ ...slot, offerId: null })),
    negotiations: {},
    history: []
  };
}

export function getDestinations(state) {
  return state.destination === "venue" && state.alsoWeb ? ["venue", "web"] : [state.destination];
}

export function evaluateLicense(data, license, destinations) {
  const results = destinations.map((destination) => ({
    destination,
    ...(license.uses[destination] ?? {
      decision: "review",
      condition: `No sample terms cover ${data.destinations[destination]}.`
    })
  }));
  const controlling = results.reduce((previous, result) =>
    priority[result.decision] >= priority[previous.decision] ? result : previous
  );

  return { ...controlling, version: license.version, results };
}

export function getPlacementResults(data, state) {
  const destinations = getDestinations(state);
  return state.placements.map((placement) => {
    const asset = data.assets[placement.assetId];
    const offer = data.offers[placement.offerId];
    return {
      ...placement,
      asset,
      credit: offer?.credit ?? asset.credit,
      check: evaluateLicense(data, offer?.license ?? asset.license, destinations)
    };
  });
}

function negotiationKey(state, slotId) {
  return `${slotId}:${getDestinations(state).join(",")}`;
}

function requestPasses(data, request) {
  return Object.hasOwn(data.assets, request.assetId)
    && request.uses.length > 0
    && request.uses.every((use) => Object.hasOwn(data.destinations, use));
}

export function updatePublishing(data, state, destination, alsoWeb = state.alsoWeb) {
  if (!Object.hasOwn(data.destinations, destination)) return state;
  const next = { ...state, destination, alsoWeb };
  const destinations = getDestinations(next);
  const { assetId, destination: offerDestination, initialOfferId } = data.negotiation;
  const blocked = getPlacementResults(data, next).find((placement) =>
    placement.assetId === assetId
      && placement.check.decision === "blocked"
      && destinations.includes(offerDestination)
  );

  if (!blocked) return next;
  const key = negotiationKey(next, blocked.id);
  if (next.negotiations[key]) return next;

  const request = { uses: destinations, assetId: blocked.assetId };
  const pass = requestPasses(data, request);
  if (!pass) {
    return {
      ...next,
      history: [
        ...next.history,
        { who: "Peer Preflight", title: "Check the sample request fields", text: "No offer was requested.", request, pass }
      ]
    };
  }

  const offer = data.offers[initialOfferId];
  const labels = destinations.map((use) => data.destinations[use]).join(" + ");
  return {
    ...next,
    negotiations: { ...next.negotiations, [key]: initialOfferId },
    history: [
      ...next.history,
      { who: "You", title: "Requested a replacement", text: `Asked for a photo for ${labels}.`, request, pass },
      {
        who: "Rights holder",
        title: "Offered a replacement",
        text: `${data.assets[offer.assetId].title} · terms ${offer.license.version}`
      }
    ]
  };
}

export function getPendingOffer(data, state, slotId) {
  const placement = state.placements.find((item) => item.id === slotId);
  const id = state.negotiations[negotiationKey(state, slotId)];
  if (!placement || placement.offerId || !id) return null;
  const offer = data.offers[id];
  const check = evaluateLicense(data, offer.license, getDestinations(state));
  if (check.decision !== "usable") return null;
  return { id, ...offer, asset: data.assets[offer.assetId], check };
}

export function acceptOffer(data, state, slotId) {
  const offer = getPendingOffer(data, state, slotId);
  if (!offer) return state;
  return {
    ...state,
    placements: state.placements.map((placement) =>
      placement.id === slotId ? { ...placement, assetId: offer.assetId, offerId: offer.id } : placement
    ),
    history: [
      ...state.history,
      {
        who: "You",
        title: "Accepted and applied",
        text: `${offer.asset.title} · terms ${offer.license.version}`
      }
    ]
  };
}

export function counterOffer(data, state, slotId, counterId) {
  const offer = getPendingOffer(data, state, slotId);
  const counter = data.negotiation.counters.find((choice) => choice.id === counterId);
  if (!offer || !counter) return state;

  const key = negotiationKey(state, slotId);
  const response = counter.offerId ? data.offers[counter.offerId] : offer;
  return {
    ...state,
    negotiations: { ...state.negotiations, [key]: counter.offerId ?? offer.id },
    history: [
      ...state.history,
      { who: "You", title: "Made a counterproposal", text: counter.message },
      {
        who: "Rights holder",
        title: counter.offerId ? "Revised the offer" : "Kept the previous offer",
        text: `${counter.reply} Terms ${response.license.version}.`
      }
    ]
  };
}

export function removePlacement(data, state, slotId) {
  const placement = state.placements.find((item) => item.id === slotId);
  if (!placement) return state;
  return {
    ...state,
    placements: state.placements.filter((item) => item.id !== slotId),
    history: [
      ...state.history,
      { who: "You", title: "Removed from the flyer", text: data.assets[placement.assetId].title }
    ]
  };
}

export function getLatestRequest(state) {
  const entry = state.history.findLast((item) => item.request);
  return entry ? { ...entry.request, pass: entry.pass } : null;
}

export function makeCredits(data, state) {
  const placements = getPlacementResults(data, state);
  const included = placements.filter(({ check }) => check.decision === "usable");
  const omitted = placements.length - included.length;
  const destinations = getDestinations(state).map((use) => data.destinations[use]);
  const lines = [
    `Sample — ${data.flyer.title}`,
    `Destinations: ${destinations.join(" + ")}`,
    "",
    ...included.map(({ asset, credit }) => `${asset.title} — ${credit}`)
  ];
  if (included.length === 0) lines.push("No usable placements.");
  if (omitted) {
    lines.push("", `Excluded ${omitted} placement${omitted === 1 ? "" : "s"} outside the usable list.`);
  }

  return { text: lines.join("\n") + "\n", included: included.length, omitted };
}
