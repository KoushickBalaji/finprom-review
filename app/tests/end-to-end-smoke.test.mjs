import test from "node:test";
import assert from "node:assert/strict";
import {
  assessSmokeRun,
  citationKey,
  scoreEvidenceGroups,
  summarizeSmokeRuns,
} from "../scripts/fca/end-to-end-smoke-lib.mjs";

test("citation keys ignore FCA display spacing", () => {
  assert.equal(citationKey("COBS 4.2.5 G"), citationKey("COBS 4.2.5G"));
});

test("evidence groups report exact missing groups", () => {
  const groups = [
    { id: "one", description: "one", acceptedCitations: ["CONC 3.5.3 R"] },
    { id: "two", description: "two", acceptedCitations: ["CONC 3.5.7 R"] },
  ];
  const scored = scoreEvidenceGroups(groups, [{ id: "CONC 3.5.3R" }]);
  assert.equal(scored[0].passed, true);
  assert.equal(scored[1].passed, false);
});

test("smoke assessment requires real AI, full hybrid corpus, validation and pending reviewer", () => {
  const definition = {
    id: "example",
    description: "example",
    promotion: "A sufficiently long promotion.",
    acceptedRecommendations: ["recommended"],
    expectedReviewerDecision: "pending",
    expectedPrincipalSourcebooks: ["COBS"],
    evidenceGroups: [{
      id: "fair-clear",
      description: "governing rule",
      acceptedCitations: ["COBS 4.2.1 R"],
    }],
  };
  const execution = {
    result: { recommendation: "recommended", reviewerDecision: "pending" },
    trace: {
      providerMode: "openai-direct",
      extraction: { claims: [{ exactText: "A sufficiently long promotion." }] },
      applicabilityRoute: { principalSourcebooks: ["COBS"] },
      retrieval: {
        mode: "hybrid",
        snapshot: { corpusMode: "full-handbook-local-index", semanticSearch: true },
        evidence: [{ id: "COBS 4.2.1R" }],
      },
      evaluation: { findings: [{ ruleIds: ["COBS 4.2.1R"] }] },
      validation: { passed: true, errors: [] },
      timings: { totalMs: 10 },
    },
  };
  const stages = ["context", "claims", "retrieval", "evaluation", "validation"].map((id) => ({ id }));
  const run = assessSmokeRun(definition, execution, stages);
  assert.equal(run.passed, true);
  assert.equal(summarizeSmokeRuns([run]).allPassed, true);
});

