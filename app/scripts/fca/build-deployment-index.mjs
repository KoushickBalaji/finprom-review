import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fullSnapshotId, indexFile } from "./corpus-paths.mjs";

const snapshotId = process.argv[2] || fullSnapshotId;
const sourceFile = indexFile(snapshotId);
const outputFile = path.resolve(
  path.dirname(sourceFile),
  `../deploy/${snapshotId}-int8.sqlite`,
);

function quantizeVector(blob) {
  const source = new Float32Array(
    blob.buffer,
    blob.byteOffset,
    blob.byteLength / Float32Array.BYTES_PER_ELEMENT,
  );
  let maximum = 0;
  for (const value of source) maximum = Math.max(maximum, Math.abs(value));
  const scale = maximum ? maximum / 127 : 1;
  const quantized = Buffer.allocUnsafe(source.length);
  for (let index = 0; index < source.length; index += 1) {
    quantized.writeInt8(
      Math.max(-127, Math.min(127, Math.round(source[index] / scale))),
      index,
    );
  }
  return { quantized, scale };
}

async function sha256File(file) {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

await fsp.mkdir(path.dirname(outputFile), { recursive: true });
await fsp.rm(outputFile, { force: true });
const source = new DatabaseSync(sourceFile, { readOnly: true });
const target = new DatabaseSync(outputFile);

try {
  const manifest = source.prepare("SELECT * FROM index_manifest LIMIT 1").get();
  if (!manifest || manifest.snapshot_id !== snapshotId) {
    throw new Error(`Source index manifest does not match ${snapshotId}`);
  }
  target.exec(`
    PRAGMA journal_mode = OFF;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE index_manifest (
      snapshot_id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      chunk_sha256 TEXT NOT NULL,
      canonical_sha256 TEXT NOT NULL,
      chunk_count INTEGER NOT NULL,
      searchable_count INTEGER NOT NULL,
      schema_version INTEGER NOT NULL,
      deployment_profile TEXT NOT NULL
    );
    CREATE TABLE chunks (
      rowid INTEGER PRIMARY KEY,
      chunk_id TEXT NOT NULL UNIQUE,
      parent_id TEXT NOT NULL,
      citation TEXT NOT NULL,
      citation_key TEXT NOT NULL,
      provision_name TEXT,
      provision_type TEXT,
      sourcebook TEXT NOT NULL,
      module TEXT,
      chapter TEXT,
      section TEXT,
      subsection TEXT,
      snapshot_id TEXT NOT NULL,
      url TEXT,
      effective_date TEXT,
      eligibility TEXT NOT NULL,
      text TEXT NOT NULL,
      cross_references_json TEXT NOT NULL
    );
    CREATE INDEX chunks_scope ON chunks(sourcebook, section, eligibility);
    CREATE INDEX chunks_citation ON chunks(citation_key);
    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      chunk_id UNINDEXED,
      citation,
      sourcebook,
      hierarchy,
      search_text,
      content='',
      tokenize = 'unicode61 remove_diacritics 2'
    );
    CREATE TABLE embedding_runs (
      run_id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      chunk_sha256 TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      embedded_count INTEGER NOT NULL,
      prompt_tokens INTEGER NOT NULL,
      api_requests INTEGER NOT NULL,
      last_error TEXT
    );
    CREATE TABLE embeddings (
      chunk_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      run_id TEXT NOT NULL,
      vector BLOB NOT NULL,
      norm REAL NOT NULL,
      scale REAL NOT NULL,
      embedded_at TEXT NOT NULL,
      PRIMARY KEY(chunk_id, model, dimensions)
    );
  `);

  target.prepare(`
    INSERT INTO index_manifest VALUES (?, ?, ?, ?, ?, ?, ?, 3, ?)
  `).run(
    manifest.snapshot_id,
    manifest.snapshot_date,
    new Date().toISOString(),
    manifest.chunk_sha256,
    manifest.canonical_sha256,
    manifest.chunk_count,
    manifest.searchable_count,
    "full-handbook-private-blob-index-int8",
  );

  const insertChunk = target.prepare(`
    INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = target.prepare(`
    INSERT INTO chunks_fts(rowid, chunk_id, citation, sourcebook, hierarchy, search_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const chunks = source.prepare(`
    SELECT rowid, chunk_id, parent_id, citation, citation_key, provision_name,
      provision_type, sourcebook, module, chapter, section, subsection,
      snapshot_id, url, effective_date, eligibility, text,
      cross_references_json, hierarchy, search_text
    FROM chunks ORDER BY rowid
  `).iterate();
  target.exec("BEGIN");
  let chunkCount = 0;
  for (const row of chunks) {
    insertChunk.run(
      row.rowid, row.chunk_id, row.parent_id, row.citation, row.citation_key,
      row.provision_name, row.provision_type, row.sourcebook, row.module,
      row.chapter, row.section, row.subsection, row.snapshot_id, row.url,
      row.effective_date, row.eligibility, row.text, row.cross_references_json,
    );
    if (row.eligibility === "substantive") {
      insertFts.run(
        row.rowid,
        row.chunk_id,
        row.citation,
        row.sourcebook,
        row.hierarchy || "",
        row.search_text,
      );
    }
    chunkCount += 1;
    if (chunkCount % 2_000 === 0) target.exec("COMMIT; BEGIN");
  }
  target.exec("COMMIT");

  const insertRun = target.prepare(`
    INSERT INTO embedding_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const row of source.prepare("SELECT * FROM embedding_runs").iterate()) {
    insertRun.run(...Object.values(row));
  }

  const insertEmbedding = target.prepare(`
    INSERT INTO embeddings VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  target.exec("BEGIN");
  let embeddingCount = 0;
  for (const row of source.prepare("SELECT * FROM embeddings ORDER BY chunk_id").iterate()) {
    const { quantized, scale } = quantizeVector(row.vector);
    insertEmbedding.run(
      row.chunk_id, row.model, row.dimensions, row.run_id,
      quantized, row.norm, scale, row.embedded_at,
    );
    embeddingCount += 1;
    if (embeddingCount % 2_000 === 0) target.exec("COMMIT; BEGIN");
  }
  target.exec("COMMIT");
  target.exec("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize'); VACUUM;");

  if (chunkCount !== manifest.chunk_count || embeddingCount !== manifest.searchable_count) {
    throw new Error(`Deployment index counts differ: ${chunkCount}/${embeddingCount}`);
  }
} finally {
  source.close();
  target.close();
}

const stats = await fsp.stat(outputFile);
console.log(JSON.stringify({
  outputFile,
  bytes: stats.size,
  megabytes: Number((stats.size / 1_048_576).toFixed(1)),
  sha256: await sha256File(outputFile),
}, null, 2));

