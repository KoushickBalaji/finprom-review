// Legacy v1 single-anchor scorer retained only to preserve the historical
// baseline. Active evaluation uses retrieval-evaluation-v2-lib.mjs.
const citationKey = (value) => String(value ?? "")
  .toUpperCase()
  .replace(/\s+/g, "")
  .replace(/[^A-Z0-9.]/g, "");

export function scoreRetrievalCase(definition, evidence) {
  const expectedKeys = new Set(definition.expectedAnyOf.map(citationKey));
  const ranked = evidence.map((item, index) => ({
    rank: index + 1,
    citation: item.citation,
    citationKey: citationKey(item.citation),
    sourcebook: item.sourcebook,
    lexicalRank: item.lexicalRank ?? null,
    semanticRank: item.semanticRank ?? null,
    fusedScore: item.fusedScore ?? null,
  }));
  const expected = ranked.filter((item) => expectedKeys.has(item.citationKey));
  const firstExpectedRank = expected.length ? Math.min(...expected.map((item) => item.rank)) : null;
  return {
    id: definition.id,
    product: definition.product,
    expectedAnyOf: definition.expectedAnyOf,
    firstExpectedRank,
    hitAt5: firstExpectedRank !== null && firstExpectedRank <= 5,
    hitAt10: firstExpectedRank !== null && firstExpectedRank <= 10,
    reciprocalRank: firstExpectedRank ? 1 / firstExpectedRank : 0,
    ranked,
  };
}

const round = (value) => Number(value.toFixed(4));

export function summarizeRetrievalMode(mode, cases, elapsedMs) {
  const count = cases.length;
  const hitsAt5 = cases.filter((item) => item.hitAt5).length;
  const hitsAt10 = cases.filter((item) => item.hitAt10).length;
  return {
    mode,
    cases: count,
    hitsAt5,
    hitsAt10,
    recallAt5: count ? round(hitsAt5 / count) : 0,
    recallAt10: count ? round(hitsAt10 / count) : 0,
    meanReciprocalRank: count
      ? round(cases.reduce((sum, item) => sum + item.reciprocalRank, 0) / count)
      : 0,
    elapsedMs: Math.round(elapsedMs),
    averageMsPerCase: count ? round(elapsedMs / count) : 0,
  };
}

export function compareRetrievalModes(modeResults) {
  const byMode = Object.fromEntries(modeResults.map((item) => [item.mode, item.summary]));
  const hybrid = byMode.hybrid;
  const lexical = byMode.lexical;
  return {
    routeLeakage: modeResults.reduce(
      (sum, mode) => sum + mode.cases.reduce((caseSum, item) => caseSum + (item.routeLeakage?.length ?? 0), 0),
      0,
    ),
    hybridDoesNotRegressRecallAt10: Boolean(hybrid && lexical && hybrid.recallAt10 >= lexical.recallAt10),
    allModesPresent: ["lexical", "semantic", "hybrid"].every((mode) => byMode[mode]),
  };
}

export { citationKey };

