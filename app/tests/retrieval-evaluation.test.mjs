import assert from "node:assert/strict";
import test from "node:test";
import {
  compareRetrievalModes,
  scoreRetrievalCase,
  summarizeRetrievalMode,
} from "../scripts/fca/retrieval-evaluation-v2-lib.mjs";

const definition = {
  id: "guarantee",
  product: "investments",
  assumptions: [],
  evidenceGroups: [
    {
      id: "guarantee-wording",
      description: "Guarantee wording",
      acceptedCitations: [
        { citation: "COBS 4.2.5 G", relevance: "direct", rationale: "Specific guidance" },
        { citation: "COBS 4.2.1 R", relevance: "supporting", rationale: "General rule" },
      ],
    },
    {
      id: "risk-warning",
      description: "Risk warning",
      acceptedCitations: [
        { citation: "COBS 4.12A.11 R", relevance: "direct", rationale: "Prescribed warning" },
      ],
    },
  ],
};

test("scores each required evidence group and preserves partial coverage", () => {
  const scored = scoreRetrievalCase(definition, [
    { citation: "COBS 4.2.5 G", sourcebook: "COBS", semanticRank: 1 },
  ]);
  assert.equal(scored.evidenceGroupCount, 2);
  assert.equal(scored.evidenceGroupsCoveredAt10, 1);
  assert.equal(scored.evidenceGroupRecallAt10, 0.5);
  assert.equal(scored.fullCoverageAt10, false);
  assert.equal(scored.partialCoverageAt10, true);
  assert.equal(scored.groups[0].bestMatch.rank, 1);
  assert.equal(scored.groups[1].bestMatch, null);
});

test("summarizes evidence-group and full-case coverage", () => {
  const cases = [
    {
      evidenceGroupCount: 2,
      evidenceGroupsCoveredAt5: 2,
      evidenceGroupsCoveredAt10: 2,
      evidenceGroupRecallAt10: 1,
      fullCoverageAt5: true,
      fullCoverageAt10: true,
      partialCoverageAt10: false,
      reciprocalRank: 1,
      routeLeakage: [],
    },
    {
      evidenceGroupCount: 2,
      evidenceGroupsCoveredAt5: 0,
      evidenceGroupsCoveredAt10: 1,
      evidenceGroupRecallAt10: 0.5,
      fullCoverageAt5: false,
      fullCoverageAt10: false,
      partialCoverageAt10: true,
      reciprocalRank: 0.1,
      routeLeakage: [],
    },
  ];
  const lexical = summarizeRetrievalMode("lexical", cases, 20);
  const semantic = summarizeRetrievalMode("semantic", cases, 30);
  const hybrid = summarizeRetrievalMode("hybrid", cases, 25);
  assert.equal(hybrid.fullCaseCoverageRateAt5, 0.5);
  assert.equal(hybrid.fullCaseCoverageRateAt10, 0.5);
  assert.equal(hybrid.evidenceGroupRecallAt10, 0.75);
  assert.equal(hybrid.casesPartialCoverageAt10, 1);
  assert.equal(hybrid.meanFirstRelevantReciprocalRank, 0.55);
  assert.deepEqual(compareRetrievalModes([
    { mode: "lexical", summary: lexical, cases },
    { mode: "semantic", summary: semantic, cases },
    { mode: "hybrid", summary: hybrid, cases },
  ]), {
    routeLeakage: 0,
    hybridDoesNotRegressEvidenceGroupRecallAt10: true,
    allDiagnosticModesPresent: true,
  });
});

