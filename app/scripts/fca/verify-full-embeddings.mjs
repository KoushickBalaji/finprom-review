import fsp from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { buildApplicabilityRoute } from "../../lib/applicability-router.js";
import { retrieveFullCorpusEvidence } from "../../lib/full-corpus-retrieval.js";
import { createOpenAIEmbeddings } from "./openai-embeddings.mjs";
import { fullSnapshotId, indexFile } from "./corpus-paths.mjs";

const snapshotId = process.argv[2] || fullSnapshotId;
const model = process.env.FCA_EMBEDDING_MODEL || "text-embedding-3-small";
const dimensions = Number.parseInt(process.env.FCA_EMBEDDING_DIMENSIONS || "1536", 10);
const file = indexFile(snapshotId);
const db = new DatabaseSync(file, { readOnly: true });

const manifest = db.prepare("SELECT * FROM index_manifest WHERE snapshot_id = ?").get(snapshotId);
const run = db.prepare(`
  SELECT * FROM embedding_runs
  WHERE snapshot_id = ? AND model = ? AND dimensions = ?
  ORDER BY updated_at DESC LIMIT 1
`).get(snapshotId, model, dimensions);
const integrity = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM chunks WHERE eligibility = 'substantive') AS eligible_chunks,
    COUNT(e.chunk_id) AS embedded_chunks,
    SUM(CASE WHEN e.chunk_id IS NULL THEN 1 ELSE 0 END) AS missing_chunks,
    SUM(CASE WHEN e.chunk_id IS NOT NULL AND LENGTH(e.vector) != e.dimensions * 4 THEN 1 ELSE 0 END) AS invalid_vector_blobs,
    MIN(e.norm) AS minimum_norm,
    MAX(e.norm) AS maximum_norm
  FROM chunks c
  LEFT JOIN embeddings e
    ON e.chunk_id = c.chunk_id AND e.model = ? AND e.dimensions = ?
  WHERE c.eligibility = 'substantive'
`).get(model, dimensions);
db.close();

if (!manifest || !run) throw new Error("Embedding manifest/run is missing");
if (run.status !== "complete") throw new Error(`Embedding run is ${run.status}, not complete`);
if (integrity.missing_chunks !== 0 || integrity.invalid_vector_blobs !== 0) {
  throw new Error(`Embedding integrity failed: ${JSON.stringify(integrity)}`);
}

let hybridQuery = null;
if (process.env.OPENAI_API_KEY) {
  const query = [
    "investments",
    "Earn a guaranteed 12% annual return with our investment bond. Your capital is completely secure.",
    "guarantee guaranteed return protected capital secure investment risk free",
    "financial promotion fair clear not misleading",
  ].join(" ");
  const { embeddings } = await createOpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    inputs: [query],
    model,
    dimensions,
  });
  const route = buildApplicabilityRoute({
    product: "investments",
    channel: "website",
    audience: "uk_retail",
    jurisdiction: "UK_FCA",
  });
  const result = await retrieveFullCorpusEvidence({
    query,
    route,
    queryEmbedding: embeddings[0],
  });
  hybridQuery = result.evidence.map(({ id, sourcebook, lexicalRank, semanticRank, fusedScore }) => ({
    id,
    sourcebook,
    lexicalRank,
    semanticRank,
    fusedScore: Number(fusedScore?.toFixed?.(6) ?? 0),
  }));
}

const stats = await fsp.stat(file);
console.log(JSON.stringify({
  file,
  fileBytes: stats.size,
  manifest,
  run,
  integrity,
  hybridQuery,
}, null, 2));

