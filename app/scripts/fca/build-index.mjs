import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { defaultSnapshotId, indexFile, snapshotFile } from "./corpus-paths.mjs";

const snapshotId = process.argv[2] || defaultSnapshotId;
const input = snapshotFile(snapshotId);
const output = indexFile(snapshotId);

await fsp.access(input);
await fsp.mkdir(new URL("../../corpus/index/", import.meta.url), { recursive: true });
await fsp.rm(output, { force: true });

const db = new DatabaseSync(output);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE snapshot (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    item_count INTEGER NOT NULL
  );
  CREATE TABLE provisions (
    rowid INTEGER PRIMARY KEY,
    provision_id TEXT NOT NULL UNIQUE,
    sourcebook TEXT NOT NULL,
    module TEXT,
    chapter TEXT,
    section TEXT,
    provision_type TEXT,
    heading TEXT,
    text TEXT NOT NULL,
    effective_date TEXT,
    url TEXT,
    parent_id TEXT,
    cross_references_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL,
    content_hash TEXT NOT NULL
  );
  CREATE INDEX provisions_sourcebook ON provisions(sourcebook);
  CREATE INDEX provisions_hierarchy ON provisions(sourcebook, chapter, section);
  CREATE VIRTUAL TABLE provisions_fts USING fts5(
    provision_id UNINDEXED,
    sourcebook,
    heading,
    text,
    metadata,
    tokenize = 'unicode61 remove_diacritics 2'
  );
`);

const insertProvision = db.prepare(`
  INSERT INTO provisions (
    provision_id, sourcebook, module, chapter, section, provision_type,
    heading, text, effective_date, url, parent_id,
    cross_references_json, metadata_json, content_hash
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertFts = db.prepare(`
  INSERT INTO provisions_fts (rowid, provision_id, sourcebook, heading, text, metadata)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const required = ["id", "sourcebook", "text"];
let count = 0;
db.exec("BEGIN");
try {
  const lines = readline.createInterface({
    input: fs.createReadStream(input, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    for (const field of required) {
      if (!record[field]) throw new Error(`Missing ${field} on line ${count + 1}`);
    }
    const metadataJson = JSON.stringify(record.metadata ?? {});
    const contentHash = crypto
      .createHash("sha256")
      .update(`${record.id}\n${record.text}`)
      .digest("hex");
    const result = insertProvision.run(
      record.id,
      record.sourcebook,
      record.module ?? null,
      record.chapter ?? null,
      record.section ?? null,
      record.provisionType ?? null,
      record.heading ?? null,
      record.text,
      record.effectiveDate ?? null,
      record.url ?? null,
      record.parentId ?? null,
      JSON.stringify(record.crossReferences ?? []),
      metadataJson,
      contentHash,
    );
    insertFts.run(
      Number(result.lastInsertRowid),
      record.id,
      record.sourcebook,
      record.heading ?? "",
      record.text,
      metadataJson,
    );
    count += 1;
  }
  const inputHash = crypto
    .createHash("sha256")
    .update(await fsp.readFile(input))
    .digest("hex");
  db.prepare(
    "INSERT INTO snapshot (id, source, created_at, sha256, item_count) VALUES (?, ?, ?, ?, ?)",
  ).run(snapshotId, input, new Date().toISOString(), inputHash, count);
  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  await fsp.rm(output, { force: true });
  throw error;
}
db.exec("PRAGMA optimize");
db.close();
console.log(`Indexed ${count} provisions into ${output}`);


