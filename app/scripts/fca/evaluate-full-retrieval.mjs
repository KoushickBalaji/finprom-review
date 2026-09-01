import fsp from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  FCA_RETRIEVAL_EVAL_CASES,
  FCA_RETRIEVAL_LABEL_AUTHORITY,
  buildRetrievalEvalQuery,
} from "../../evals/fca-retrieval-cases-v2.mjs";
import { buildApplicabilityRoute } from "../../lib/applicability-router.js";
import {
  fullCorpusIndexPath,
  retrieveFullCorpusEvidence,
} from "../../lib/full-corpus-retrieval.js";
import { createOpenAIEmbeddings } from "./openai-embeddings.mjs";
import {
  compareRetrievalModes,
  scoreRetrievalCase,
  summarizeRetrievalMode,
} from "./retrieval-evaluation-v2-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "../..");
const model = process.env.FCA_EMBEDDING_MODEL || "text-embedding-3-small";
const dimensions = Number.parseInt(process.env.FCA_EMBEDDING_DIMENSIONS || "1536", 10);
const apiKey = process.env.OPENAI_API_KEY;
const modes = ["lexical", "semantic", "hybrid"];
const evidenceLimit = 10;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required to embed retrieval-evaluation queries");
}

const indexPath = fullCorpusIndexPath();
const db = new DatabaseSync(indexPath, { readOnly: true });
const manifest = db.prepare("SELECT * FROM index_manifest LIMIT 1").get();
const embeddingRun = db.prepare(`
  SELECT * FROM embedding_runs
  WHERE snapshot_id = ? AND model = ? AND dimensions = ? AND status = 'complete'
  ORDER BY completed_at DESC LIMIT 1
`).get(manifest?.snapshot_id, model, dimensions);
db.close();
if (!manifest) throw new Error("Full-corpus index manifest is missing");
if (!embeddingRun) {
  throw new Error(`No completed ${model}/${dimensions} embedding run matches the full index`);
}
if (embeddingRun.chunk_sha256 !== manifest.chunk_sha256) {
  throw new Error("Completed embedding run does not match the indexed chunk checksum");
}

const queries = FCA_RETRIEVAL_EVAL_CASES.map(buildRetrievalEvalQuery);
const embeddingStarted = performance.now();
const queryEmbeddingResult = await createOpenAIEmbeddings({
  apiKey,
  inputs: queries,
  model,
  dimensions,
});
const queryEmbeddingMs = performance.now() - embeddingStarted;

const routes = FCA_RETRIEVAL_EVAL_CASES.map((definition) => buildApplicabilityRoute(definition));

// Load each distinct scoped vector set before timing. This separates query-time
// exact similarity work from the one-off cost of reading vectors from SQLite.
const warmedScopes = new Set();
for (let index = 0; index < routes.length; index += 1) {
  const route = routes[index];
  if (warmedScopes.has(route.scopeId)) continue;
  await retrieveFullCorpusEvidence({
    query: queries[index],
    route,
    queryEmbedding: queryEmbeddingResult.embeddings[index],
    lexicalPhrases: FCA_RETRIEVAL_EVAL_CASES[index].searchConcepts,
    retrievalMode: "semantic",
    evidenceLimit: 1,
    expandReferenceLimit: 0,
  });
  warmedScopes.add(route.scopeId);
}

const modeResults = [];
for (const retrievalMode of modes) {
  const started = performance.now();
  const cases = [];
  for (let index = 0; index < FCA_RETRIEVAL_EVAL_CASES.length; index += 1) {
    const definition = FCA_RETRIEVAL_EVAL_CASES[index];
    const route = routes[index];
    const result = await retrieveFullCorpusEvidence({
      query: queries[index],
      route,
      queryEmbedding: queryEmbeddingResult.embeddings[index],
      lexicalPhrases: definition.searchConcepts,
      retrievalMode,
      evidenceLimit,
      expandReferenceLimit: 0,
    });
    const scored = scoreRetrievalCase(definition, result.evidence);
    const allowedSourcebooks = new Set([...route.principalSourcebooks, "PRIN", "GEN"]);
    scored.routeLeakage = result.evidence
      .filter((item) => !allowedSourcebooks.has(item.sourcebook))
      .map((item) => ({ citation: item.citation, sourcebook: item.sourcebook }));
    cases.push(scored);
  }
  const elapsedMs = performance.now() - started;
  modeResults.push({
    mode: retrievalMode,
    summary: summarizeRetrievalMode(retrievalMode, cases, elapsedMs),
    cases,
  });
}

const output = {
  schemaVersion: 2,
  createdAt: new Date().toISOString(),
  index: {
    path: indexPath,
    snapshotId: manifest.snapshot_id,
    snapshotDate: manifest.snapshot_date,
    chunkSha256: manifest.chunk_sha256,
    canonicalSha256: manifest.canonical_sha256,
    searchableChunks: manifest.searchable_count,
  },
  embeddings: {
    runId: embeddingRun.run_id,
    provider: embeddingRun.provider,
    model,
    dimensions,
    queryCount: queries.length,
    queryTokens: queryEmbeddingResult.usage.prompt_tokens ?? 0,
    queryEmbeddingMs: Math.round(queryEmbeddingMs),
  },
  evaluation: {
    benchmarkId: "fca-retrieval-demo-v2",
    evidenceLimit,
    referenceExpansion: false,
    cases: FCA_RETRIEVAL_EVAL_CASES.length,
    evidenceGroups: FCA_RETRIEVAL_EVAL_CASES.reduce(
      (sum, definition) => sum + definition.evidenceGroups.length,
      0,
    ),
    labelAuthority: FCA_RETRIEVAL_LABEL_AUTHORITY,
    note: "Queries represent promotion text plus deterministic claim-extraction concepts. This evaluates claim-level evidence coverage, not final compliance outcomes.",
  },
  modeResults,
  comparison: compareRetrievalModes(modeResults),
};

const outputDir = path.join(appRoot, "corpus", "evals", manifest.snapshot_id);
await fsp.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, "retrieval-evaluation.json");
await fsp.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  embeddings: output.embeddings,
  summaries: modeResults.map(({ summary }) => summary),
  comparison: output.comparison,
  incompleteCases: modeResults.map(({ mode, cases }) => ({
    mode,
    cases: cases.filter((item) => !item.fullCoverageAt10).map((item) => ({
      id: item.id,
      coverage: `${item.evidenceGroupsCoveredAt10}/${item.evidenceGroupCount}`,
      missingGroups: item.groups.filter((group) => !group.coveredAt10).map((group) => group.id),
    })),
  })),
}, null, 2));

