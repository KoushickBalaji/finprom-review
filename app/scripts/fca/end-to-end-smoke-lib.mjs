const REQUIRED_STAGES = Object.freeze(["context", "claims", "retrieval", "evaluation", "validation"]);

export function citationKey(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.]/g, "");
}

export function scoreEvidenceGroups(evidenceGroups, evidence) {
  const retrieved = new Map(evidence.map((item) => [citationKey(item.id), item.id]));
  return evidenceGroups.map((group) => {
    const matched = group.acceptedCitations.filter((citation) =>
      retrieved.has(citationKey(citation))
    );
    return {
      id: group.id,
      description: group.description,
      acceptedCitations: [...group.acceptedCitations],
      matchedCitations: matched,
      passed: matched.length > 0,
    };
  });
}

function check(id, passed, detail) {
  return { id, passed: Boolean(passed), detail };
}

export function assessSmokeRun(definition, execution, stages) {
  const { result, trace } = execution;
  const evidenceCoverage = scoreEvidenceGroups(
    definition.evidenceGroups,
    trace.retrieval.evidence,
  );
  const stageIds = stages.map((stage) => stage.id);
  const exactClaimQuotes = trace.extraction.claims.every((claim) =>
    definition.promotion.toLowerCase().includes(claim.exactText.toLowerCase())
  );
  const principalSourcebooks = trace.applicabilityRoute.principalSourcebooks;
  const checks = [
    check(
      "real-ai-provider",
      trace.providerMode !== "development-fixture",
      `Provider mode: ${trace.providerMode}`,
    ),
    check(
      "all-workflow-stages",
      REQUIRED_STAGES.every((stage) => stageIds.includes(stage)),
      `Observed stages: ${stageIds.join(", ")}`,
    ),
    check(
      "structured-claim-extraction",
      trace.extraction.claims.length > 0 && exactClaimQuotes,
      `${trace.extraction.claims.length} claim(s); every exactText value is present in the submitted copy: ${exactClaimQuotes}`,
    ),
    check(
      "applicability-route",
      definition.expectedPrincipalSourcebooks.every((sourcebook) =>
        principalSourcebooks.includes(sourcebook)
      ),
      `Principal sourcebooks: ${principalSourcebooks.join(", ")}`,
    ),
    check(
      "full-private-corpus",
      trace.retrieval.snapshot?.corpusMode === "full-handbook-local-index",
      `Corpus mode: ${trace.retrieval.snapshot?.corpusMode ?? "unknown"}`,
    ),
    check(
      "hybrid-retrieval",
      trace.retrieval.mode === "hybrid" && trace.retrieval.snapshot?.semanticSearch === true,
      `Mode: ${trace.retrieval.mode}; semantic search: ${trace.retrieval.snapshot?.semanticSearch ?? false}`,
    ),
    check(
      "expected-evidence-groups",
      evidenceCoverage.every((group) => group.passed),
      `${evidenceCoverage.filter((group) => group.passed).length}/${evidenceCoverage.length} evidence groups covered`,
    ),
    check(
      "grounded-model-output",
      trace.evaluation.findings.length > 0 && trace.evaluation.findings.every((finding) =>
        finding.ruleIds.length > 0
      ),
      `${trace.evaluation.findings.length} finding(s), each with at least one rule ID`,
    ),
    check(
      "deterministic-validation",
      trace.validation.passed,
      trace.validation.passed ? "All promotion quotes and cited rule IDs validated" : trace.validation.errors.join("; "),
    ),
    check(
      "advisory-recommendation",
      definition.acceptedRecommendations.includes(result.recommendation),
      `Expected ${definition.acceptedRecommendations.join(" or ")}; received ${result.recommendation}`,
    ),
    check(
      "reviewer-remains-decision-maker",
      result.reviewerDecision === definition.expectedReviewerDecision,
      `Reviewer decision: ${result.reviewerDecision ?? "not returned"}`,
    ),
  ];

  return {
    id: definition.id,
    description: definition.description,
    passed: checks.every((item) => item.passed),
    checks,
    evidenceCoverage,
    missingEvidenceGroups: evidenceCoverage.filter((group) => !group.passed),
    stages,
    result,
    trace,
  };
}

export function summarizeSmokeRuns(runs) {
  const passed = runs.filter((run) => run.passed).length;
  const failed = runs.length - passed;
  return {
    total: runs.length,
    passed,
    failed,
    allPassed: failed === 0,
    evidenceGroups: {
      total: runs.reduce((sum, run) => sum + run.evidenceCoverage.length, 0),
      covered: runs.reduce(
        (sum, run) => sum + run.evidenceCoverage.filter((group) => group.passed).length,
        0,
      ),
    },
  };
}

export function renderSmokeMarkdown(report) {
  const lines = [
    "# FCA FinProm end-to-end smoke test",
    "",
    `Generated: ${report.generatedAt}`,
    `Workflow: ${report.workflow.workflowVersion}`,
    `Provider: ${report.workflow.providerMode}`,
    `Models: ${report.workflow.models.extraction} → ${report.workflow.models.embedding} → ${report.workflow.models.evaluation}`,
    `Result: ${report.summary.passed}/${report.summary.total} cases passed; ${report.summary.evidenceGroups.covered}/${report.summary.evidenceGroups.total} expected evidence groups covered.`,
    "",
    "> These labels are provisional demo checks, not an FCA compliance SME opinion. An SME must validate expected provisions and outcomes before external accuracy claims.",
    "",
  ];

  for (const run of report.runs) {
    lines.push(`## ${run.passed ? "PASS" : "FAIL"} — ${run.id}`, "");
    lines.push(`Recommendation: ${run.result.recommendation}; reviewer: ${run.result.reviewerDecision ?? "not returned"}; total latency: ${run.trace.timings.totalMs} ms.`, "");
    lines.push("| Check | Status | Evidence |", "|---|---:|---|");
    for (const item of run.checks) {
      lines.push(`| ${item.id} | ${item.passed ? "PASS" : "FAIL"} | ${String(item.detail).replaceAll("|", "\\|")} |`);
    }
    lines.push("");
    if (run.missingEvidenceGroups.length) {
      lines.push("Missing evidence groups:", "");
      for (const group of run.missingEvidenceGroups) {
        lines.push(`- ${group.id}: expected one of ${group.acceptedCitations.join(", ")}`);
      }
      lines.push("");
    }
    lines.push(`Retrieved citations: ${run.trace.retrieval.evidence.map((item) => item.id).join(", ")}`, "");
  }
  return `${lines.join("\n")}\n`;
}

