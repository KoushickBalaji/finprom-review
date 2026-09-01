import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { embedMany } from "ai";
import { fullSnapshotId, indexFile } from "./corpus-paths.mjs";
import {
  createOpenAIEmbeddings,
  vectorNorm,
  vectorToBlob,
} from "./openai-embeddings.mjs";

const snapshotId = process.argv[2] || fullSnapshotId;
const model = process.env.FCA_EMBEDDING_MODEL || "text-embedding-3-small";
const dimensions = Number.parseInt(process.env.FCA_EMBEDDING_DIMENSIONS || "1536", 10);
const batchSize = Math.min(128, Math.max(1, Number.parseInt(process.env.FCA_EMBEDDING_BATCH_SIZE || "64", 10)));
const maximumBatches = Number.parseInt(process.env.FCA_EMBEDDING_MAX_BATCHES || "0", 10);
const apiKey = process.env.OPENAI_API_KEY;
const gatewayAvailable = Boolean(
  process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL,
);
const provider = apiKey ? "openai-direct" : "vercel-ai-gateway/openai";

if (!apiKey && !gatewayAvailable) {
  throw new Error("Corpus embedding needs OPENAI_API_KEY or Vercel AI Gateway authentication (AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN). Never commit either credential.");
}
if (!Number.isInteger(dimensions) || dimensions <= 0) throw new Error("Invalid FCA_EMBEDDING_DIMENSIONS");

const db = new DatabaseSync(indexFile(snapshotId));
const manifest = db.prepare("SELECT * FROM index_manifest WHERE snapshot_id = ?").get(snapshotId);
if (!manifest) throw new Error(`Index manifest not found for ${snapshotId}`);

const runId = `emb_${crypto.createHash("sha256")
  .update(`${manifest.chunk_sha256}\n${model}\n${dimensions}`)
  .digest("hex")
  .slice(0, 20)}`;
const now = new Date().toISOString();
db.prepare(`
  INSERT INTO embedding_runs (
    run_id, snapshot_id, chunk_sha256, provider, model, dimensions, status,
    started_at, updated_at, embedded_count, prompt_tokens, api_requests
  ) VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?, 0, 0, 0)
  ON CONFLICT(run_id) DO UPDATE SET
    provider = excluded.provider, status = 'running', updated_at = excluded.updated_at, last_error = NULL
`).run(runId, snapshotId, manifest.chunk_sha256, provider, model, dimensions, now, now);

const selectBatch = db.prepare(`
  SELECT c.chunk_id, c.search_text
  FROM chunks c
  LEFT JOIN embeddings e
    ON e.chunk_id = c.chunk_id AND e.model = ? AND e.dimensions = ?
  WHERE c.eligibility = 'substantive' AND e.chunk_id IS NULL
  ORDER BY c.rowid
  LIMIT ?
`);
const insertEmbedding = db.prepare(`
  INSERT OR REPLACE INTO embeddings (
    chunk_id, model, dimensions, run_id, vector, norm, embedded_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateRun = db.prepare(`
  UPDATE embedding_runs
  SET status = ?, updated_at = ?, completed_at = ?, embedded_count = ?,
      prompt_tokens = prompt_tokens + ?, api_requests = api_requests + ?, last_error = ?
  WHERE run_id = ?
`);

let embeddedThisSession = 0;
let batches = 0;
try {
  while (maximumBatches <= 0 || batches < maximumBatches) {
    const rows = selectBatch.all(model, dimensions, batchSize);
    if (!rows.length) break;
    const inputs = rows.map((row) => row.search_text);
    const { embeddings, usage } = apiKey
      ? await createOpenAIEmbeddings({ apiKey, inputs, model, dimensions })
      : await embedMany({
          model: `openai/${model}`,
          values: inputs,
          maxParallelCalls: 1,
          maxRetries: 8,
          providerOptions: { openai: { dimensions } },
        });
    const embeddedAt = new Date().toISOString();
    db.exec("BEGIN");
    try {
      rows.forEach((row, index) => {
        const vector = embeddings[index];
        if (vector.length !== dimensions) {
          throw new Error(`Expected ${dimensions} dimensions, received ${vector.length}`);
        }
        insertEmbedding.run(
          row.chunk_id,
          model,
          dimensions,
          runId,
          vectorToBlob(vector),
          vectorNorm(vector),
          embeddedAt,
        );
      });
      embeddedThisSession += rows.length;
      batches += 1;
      const total = db.prepare(`
        SELECT COUNT(*) AS count FROM embeddings WHERE model = ? AND dimensions = ?
      `).get(model, dimensions).count;
      updateRun.run(
        "running",
        embeddedAt,
        null,
        total,
        usage.prompt_tokens ?? usage.tokens ?? 0,
        1,
        null,
        runId,
      );
      db.exec("COMMIT");
      console.log(JSON.stringify({ runId, batches, embeddedThisSession, embeddedTotal: total }));
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const remaining = db.prepare(`
    SELECT COUNT(*) AS count
    FROM chunks c
    LEFT JOIN embeddings e
      ON e.chunk_id = c.chunk_id AND e.model = ? AND e.dimensions = ?
    WHERE c.eligibility = 'substantive' AND e.chunk_id IS NULL
  `).get(model, dimensions).count;
  const total = db.prepare(`
    SELECT COUNT(*) AS count FROM embeddings WHERE model = ? AND dimensions = ?
  `).get(model, dimensions).count;
  const completedAt = remaining === 0 ? new Date().toISOString() : null;
  updateRun.run(
    remaining === 0 ? "complete" : "paused",
    new Date().toISOString(),
    completedAt,
    total,
    0,
    0,
    null,
    runId,
  );
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log(JSON.stringify({
    runId,
    model,
    provider,
    dimensions,
    batchSize,
    embeddedThisSession,
    embeddedTotal: total,
    remaining,
    status: remaining === 0 ? "complete" : "paused",
  }, null, 2));
} catch (error) {
  updateRun.run(
    "paused",
    new Date().toISOString(),
    null,
    db.prepare(`SELECT COUNT(*) AS count FROM embeddings WHERE model = ? AND dimensions = ?`).get(model, dimensions).count,
    0,
    0,
    String(error?.message ?? error).slice(0, 1_000),
    runId,
  );
  throw error;
} finally {
  db.close();
}

