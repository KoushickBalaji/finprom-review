const citationKey = (value) => String(value ?? "")
  .toUpperCase()
  .replace(/\s+/g, "")
  .replace(/[^A-Z0-9.]/g, "");

const round = (value) => Number(value.toFixed(4));

export function scoreRetrievalCase(definition, evidence) {
  const ranked = evidence.map((item, index) => ({
    rank: index + 1,
    citation: item.citation,
    citationKey: citationKey(item.citation),
    sourcebook: item.sourcebook,
    lexicalRank: item.lexicalRank ?? null,
    semanticRank: item.semanticRank ?? null,
    fusedScore: item.fusedScore ?? null,
  }));
  const rankedByCitation = new Map(ranked.map((item) => [item.citationKey, item]));
  const groups = definition.evidenceGroups.map((group) => {
    const matches = group.acceptedCitations
      .map((accepted) => ({
        ...accepted,
        match: rankedByCitation.get(citationKey(accepted.citation)) ?? null,
      }))
      .filter((item) => item.match)
      .sort((left, right) => left.match.rank - right.match.rank);
    const bestMatch = matches[0] ?? null;
    return {
      id: group.id,
      description: group.description,
      acceptedCitations: group.acceptedCitations,
      bestMatch: bestMatch ? {
        citation: bestMatch.citation,
        relevance: bestMatch.relevance,
        rank: bestMatch.match.rank,
      } : null,
      coveredAt5: Boolean(bestMatch && bestMatch.match.rank <= 5),
      coveredAt10: Boolean(bestMatch && bestMatch.match.rank <= 10),
    };
  });
  const coveredAt5 = groups.filter((group) => group.coveredAt5).length;
  const coveredAt10 = groups.filter((group) => group.coveredAt10).length;
  const groupCount = groups.length;
  const firstRelevantRank = groups.reduce((best, group) => {
    if (!group.bestMatch) return best;
    return best === null ? group.bestMatch.rank : Math.min(best, group.bestMatch.rank);
  }, null);
  return {
    id: definition.id,
    product: definition.product,
    assumptions: definition.assumptions,
    evidenceGroupCount: groupCount,
    evidenceGroupsCoveredAt5: coveredAt5,
    evidenceGroupsCoveredAt10: coveredAt10,
    evidenceGroupRecallAt5: groupCount ? round(coveredAt5 / groupCount) : 0,
    evidenceGroupRecallAt10: groupCount ? round(coveredAt10 / groupCount) : 0,
    fullCoverageAt5: groupCount > 0 && coveredAt5 === groupCount,
    fullCoverageAt10: groupCount > 0 && coveredAt10 === groupCount,
    partialCoverageAt10: coveredAt10 > 0 && coveredAt10 < groupCount,
    firstRelevantRank,
    reciprocalRank: firstRelevantRank ? 1 / firstRelevantRank : 0,
    groups,
    ranked,
  };
}

export function summarizeRetrievalMode(mode, cases, elapsedMs) {
  const caseCount = cases.length;
  const evidenceGroups = cases.reduce((sum, item) => sum + item.evidenceGroupCount, 0);
  const groupsCoveredAt5 = cases.reduce((sum, item) => sum + item.evidenceGroupsCoveredAt5, 0);
  const groupsCoveredAt10 = cases.reduce((sum, item) => sum + item.evidenceGroupsCoveredAt10, 0);
  const casesFullCoverageAt5 = cases.filter((item) => item.fullCoverageAt5).length;
  const casesFullCoverageAt10 = cases.filter((item) => item.fullCoverageAt10).length;
  const casesPartialCoverageAt10 = cases.filter((item) => item.partialCoverageAt10).length;
  return {
    mode,
    cases: caseCount,
    evidenceGroups,
    casesFullCoverageAt5,
    casesFullCoverageAt10,
    casesPartialCoverageAt10,
    casesNoCoverageAt10: caseCount - casesFullCoverageAt10 - casesPartialCoverageAt10,
    fullCaseCoverageRateAt5: caseCount ? round(casesFullCoverageAt5 / caseCount) : 0,
    fullCaseCoverageRateAt10: caseCount ? round(casesFullCoverageAt10 / caseCount) : 0,
    evidenceGroupRecallAt5: evidenceGroups ? round(groupsCoveredAt5 / evidenceGroups) : 0,
    evidenceGroupRecallAt10: evidenceGroups ? round(groupsCoveredAt10 / evidenceGroups) : 0,
    meanCaseGroupRecallAt10: caseCount
      ? round(cases.reduce((sum, item) => sum + item.evidenceGroupRecallAt10, 0) / caseCount)
      : 0,
    meanFirstRelevantReciprocalRank: caseCount
      ? round(cases.reduce((sum, item) => sum + item.reciprocalRank, 0) / caseCount)
      : 0,
    elapsedMs: Math.round(elapsedMs),
    averageMsPerCase: caseCount ? round(elapsedMs / caseCount) : 0,
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
    hybridDoesNotRegressEvidenceGroupRecallAt10: Boolean(
      hybrid && lexical && hybrid.evidenceGroupRecallAt10 >= lexical.evidenceGroupRecallAt10
    ),
    allDiagnosticModesPresent: ["lexical", "semantic", "hybrid"].every((mode) => byMode[mode]),
  };
}

export { citationKey };

