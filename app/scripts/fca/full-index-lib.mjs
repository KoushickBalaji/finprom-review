import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const sha256File = async (file) => {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(file);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
};

const normalizedCitation = (value) => String(value ?? "")
  .toUpperCase()
  .replace(/\s+/g, "")
  .replace(/[^A-Z0-9.]/g, "");

function displayCitation(sourcebook, citation) {
  const clean = String(citation ?? "").trim();
  if (!clean) return sourcebook;
  if (clean.toUpperCase().startsWith(`${sourcebook.toUpperCase()} `)) return clean;
  return /^(sch|tp|app|annex)\b/i.test(clean) ? `${sourcebook} ${clean}` : clean;
}

function canonicalUrl(record) {
  const base = record.source?.chapterUrl ?? null;
  const anchor = record.fcaIdentifiers?.provisionId ?? null;
  return base && anchor ? `${base}#${anchor}` : base;
}

async function loadCanonicalMetadata(file) {
  const records = new Map();
  const lines = readline.createInterface({
    input: fs.createReadStream(file, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    records.set(record.id, {
      url: canonicalUrl(record),
      crossReferences: record.crossReferences ?? [],
    });
  }
  return records;
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA temp_store = MEMORY;
    CREATE TABLE index_manifest (
      snapshot_id TEXT PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      chunk_sha256 TEXT NOT NULL,
      canonical_sha256 TEXT NOT NULL,
      chunk_count INTEGER NOT NULL,
      searchable_count INTEGER NOT NULL,
      schema_version INTEGER NOT NULL
    );
    CREATE TABLE chunks (
      rowid INTEGER PRIMARY KEY,
      chunk_id TEXT NOT NULL UNIQUE,
      parent_id TEXT NOT NULL,
      citation TEXT NOT NULL,
      citation_key TEXT NOT NULL,
      provision_name TEXT,
      provision_type TEXT,
      provision_type_code TEXT,
      sourcebook TEXT NOT NULL,
      sourcebook_name TEXT,
      module TEXT,
      chapter TEXT,
      section TEXT,
      subsection TEXT,
      hierarchy TEXT,
      snapshot_id TEXT NOT NULL,
      snapshot_date TEXT NOT NULL,
      url TEXT,
      effective_date TEXT,
      eligibility TEXT NOT NULL,
      chunk_strategy TEXT NOT NULL,
      requires_asset_review INTEGER NOT NULL,
      position_index INTEGER NOT NULL,
      position_count INTEGER NOT NULL,
      text TEXT NOT NULL,
      search_text TEXT NOT NULL,
      content_sha256 TEXT NOT NULL,
      cross_references_json TEXT NOT NULL
    );
    CREATE INDEX chunks_scope ON chunks(sourcebook, section, eligibility);
    CREATE INDEX chunks_parent ON chunks(parent_id);
    CREATE INDEX chunks_citation ON chunks(citation_key);
    CREATE VIRTUAL TABLE chunks_fts USING fts5(
      chunk_id UNINDEXED,
      citation,
      sourcebook,
      hierarchy,
      search_text,
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
      embedded_count INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER NOT NULL DEFAULT 0,
      api_requests INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
    CREATE TABLE embeddings (
      chunk_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      run_id TEXT NOT NULL,
      vector BLOB NOT NULL,
      norm REAL NOT NULL,
      embedded_at TEXT NOT NULL,
      PRIMARY KEY(chunk_id, model, dimensions),
      FOREIGN KEY(chunk_id) REFERENCES chunks(chunk_id),
      FOREIGN KEY(run_id) REFERENCES embedding_runs(run_id)
    );
    CREATE INDEX embeddings_run ON embeddings(run_id);
  `);
}

export async function buildFullIndex({
  snapshotId,
  chunkFile,
  chunkManifestFile,
  canonicalFile,
  outputFile,
}) {
  const chunkManifest = JSON.parse(await fsp.readFile(chunkManifestFile, "utf8"));
  if (chunkManifest.snapshotId !== snapshotId) {
    throw new Error(`Chunk manifest is for ${chunkManifest.snapshotId}, not ${snapshotId}`);
  }
  const [chunkHash, canonicalHash, canonical] = await Promise.all([
    sha256File(chunkFile),
    sha256File(canonicalFile),
    loadCanonicalMetadata(canonicalFile),
  ]);
  if (chunkHash !== chunkManifest.files.chunks.sha256) {
    throw new Error("Chunk file checksum does not match its manifest");
  }
  if (canonicalHash !== chunkManifest.derivedFrom.sha256) {
    throw new Error("Canonical corpus checksum does not match the chunk manifest");
  }

  await fsp.mkdir(path.dirname(outputFile), { recursive: true });
  const temporaryFile = `${outputFile}.building`;
  await fsp.rm(temporaryFile, { force: true });
  await fsp.rm(`${temporaryFile}-wal`, { force: true });
  await fsp.rm(`${temporaryFile}-shm`, { force: true });
  const db = new DatabaseSync(temporaryFile);
  createSchema(db);

  const insertChunk = db.prepare(`
    INSERT INTO chunks (
      chunk_id, parent_id, citation, citation_key, provision_name,
      provision_type, provision_type_code, sourcebook, sourcebook_name,
      module, chapter, section, subsection, hierarchy, snapshot_id,
      snapshot_date, url, effective_date, eligibility, chunk_strategy,
      requires_asset_review, position_index, position_count, text,
      search_text, content_sha256, cross_references_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertFts = db.prepare(`
    INSERT INTO chunks_fts (rowid, chunk_id, citation, sourcebook, hierarchy, search_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let chunkCount = 0;
  let searchableCount = 0;
  const lines = readline.createInterface({
    input: fs.createReadStream(chunkFile, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  db.exec("BEGIN");
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      const parent = canonical.get(record.parentId) ?? { url: record.source?.chapterUrl, crossReferences: [] };
      const citation = displayCitation(record.sourcebook, record.citation);
      const result = insertChunk.run(
        record.id,
        record.parentId,
        citation,
        normalizedCitation(citation),
        record.provisionName ?? null,
        record.provisionType ?? null,
        record.provisionTypeCode ?? null,
        record.sourcebook,
        record.sourcebookName ?? null,
        record.module ?? null,
        record.chapter ?? null,
        record.section ?? null,
        record.subsection ?? null,
        record.hierarchy ?? null,
        record.snapshotId,
        record.snapshotDate,
        parent.url ?? null,
        record.dates?.provisionDate ?? null,
        record.retrieval?.eligibility ?? "substantive",
        record.retrieval?.strategy ?? "whole-provision",
        record.retrieval?.requiresAssetReview ? 1 : 0,
        record.position?.index ?? 1,
        record.position?.count ?? 1,
        record.text,
        record.searchText ?? `${record.citation}\n\n${record.text}`,
        record.content?.textSha256 ?? crypto.createHash("sha256").update(record.text).digest("hex"),
        JSON.stringify(parent.crossReferences),
      );
      chunkCount += 1;
      if ((record.retrieval?.eligibility ?? "substantive") === "substantive") {
        insertFts.run(
          Number(result.lastInsertRowid),
          record.id,
          citation,
          record.sourcebook,
          record.hierarchy ?? "",
          record.searchText ?? record.text,
        );
        searchableCount += 1;
      }
      if (chunkCount % 2_000 === 0) {
        db.exec("COMMIT; BEGIN");
      }
    }
    db.exec("COMMIT");
    db.prepare(`
      INSERT INTO index_manifest (
        snapshot_id, snapshot_date, created_at, chunk_sha256,
        canonical_sha256, chunk_count, searchable_count, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 2)
    `).run(
      snapshotId,
      chunkManifest.snapshotDate,
      new Date().toISOString(),
      chunkHash,
      canonicalHash,
      chunkCount,
      searchableCount,
    );
    db.exec("INSERT INTO chunks_fts(chunks_fts) VALUES('optimize')");
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
    await fsp.rm(outputFile, { force: true });
    await fsp.rename(temporaryFile, outputFile);
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    db.close();
    await fsp.rm(temporaryFile, { force: true });
    throw error;
  }

  return { snapshotId, chunkCount, searchableCount, chunkHash, canonicalHash, outputFile };
}

export { normalizedCitation };

