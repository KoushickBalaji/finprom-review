import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FCA_END_TO_END_SMOKE_AUTHORITY,
  FCA_END_TO_END_SMOKE_CASES,
} from "../../evals/fca-end-to-end-smoke-cases.mjs";
import {
  engineMetadata,
  runReviewWithTrace,
} from "../../lib/review-engine.js";
import {
  assessSmokeRun,
  renderSmokeMarkdown,
  summarizeSmokeRuns,
} from "./end-to-end-smoke-lib.mjs";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(moduleDir, "../..");
const reportDirectory = path.join(
  appRoot,
  "corpus/evals/fca-handbook-2026-08-30",
);
const caseArgumentIndex = process.argv.indexOf("--case");
const requestedCaseId = caseArgumentIndex >= 0 ? process.argv[caseArgumentIndex + 1] : null;
const reportBaseName = requestedCaseId
  ? `end-to-end-smoke-${requestedCaseId}`
  : "end-to-end-smoke";
const jsonPath = path.join(reportDirectory, `${reportBaseName}.json`);
const markdownPath = path.join(reportDirectory, `${reportBaseName}.md`);
const definitions = requestedCaseId
  ? FCA_END_TO_END_SMOKE_CASES.filter((definition) => definition.id === requestedCaseId)
  : FCA_END_TO_END_SMOKE_CASES;

if (requestedCaseId && definitions.length === 0) {
  throw new Error(`Unknown smoke-test case: ${requestedCaseId}`);
}

if (!engineMetadata.realAiAvailable) {
  throw new Error("The end-to-end smoke test requires real AI credentials; the deterministic development fixture is forbidden.");
}
if (!engineMetadata.fullCorpusIndexAvailable) {
  throw new Error("The end-to-end smoke test requires the full local FCA index.");
}
if (engineMetadata.retrievalMode === "pack") {
  throw new Error("The end-to-end smoke test refuses FCA_RETRIEVAL_MODE=pack.");
}

const runs = [];
for (const definition of definitions) {
  const stages = [];
  process.stdout.write(`Running ${definition.id}... `);
  try {
    const execution = await runReviewWithTrace(definition, (stage) => stages.push(stage));
    const run = assessSmokeRun(definition, execution, stages);
    runs.push(run);
    process.stdout.write(`${run.passed ? "PASS" : "FAIL"} (${execution.trace.timings.totalMs} ms)\n`);
  } catch (error) {
    runs.push({
      id: definition.id,
      description: definition.description,
      passed: false,
      checks: [{ id: "workflow-completion", passed: false, detail: error.message }],
      evidenceCoverage: [],
      missingEvidenceGroups: definition.evidenceGroups,
      stages,
      result: { recommendation: "review_failed", reviewerDecision: null },
      trace: {
        providerMode: engineMetadata.providerMode,
        models: {
          extraction: engineMetadata.extractionModel,
          embedding: engineMetadata.embeddingModel,
          evaluation: engineMetadata.evaluationModel,
        },
        retrieval: { evidence: [] },
        timings: { totalMs: null },
        error: { name: error.name, message: error.message },
      },
    });
    process.stdout.write(`FAIL (${error.message})\n`);
  }
}

const report = {
  schemaVersion: 1,
  benchmarkId: "fca-finprom-end-to-end-smoke-v1",
  generatedAt: new Date().toISOString(),
  authority: FCA_END_TO_END_SMOKE_AUTHORITY,
  workflow: {
    workflowVersion: engineMetadata.workflowVersion,
    providerMode: engineMetadata.providerMode,
    retrievalMode: engineMetadata.retrievalMode,
    models: {
      extraction: engineMetadata.extractionModel.replace(/-fast$/, ""),
      embedding: engineMetadata.embeddingModel.replace(/-fast$/, ""),
      evaluation: engineMetadata.evaluationModel.replace(/-fast$/, ""),
    },
  },
  summary: summarizeSmokeRuns(runs),
  runs,
};

fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, renderSmokeMarkdown(report));

console.log(`Report: ${markdownPath}`);
console.log(`Summary: ${report.summary.passed}/${report.summary.total} cases; ${report.summary.evidenceGroups.covered}/${report.summary.evidenceGroups.total} evidence groups.`);
if (!report.summary.allPassed) process.exitCode = 1;

