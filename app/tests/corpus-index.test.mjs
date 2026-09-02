import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { appRoot, defaultSnapshotId, indexFile } from "../scripts/fca/corpus-paths.mjs";

test("builds a searchable, versioned FCA provision index", () => {
  execFileSync(process.execPath, ["scripts/fca/export-demo-pack.mjs"], {
    cwd: appRoot,
    stdio: "pipe",
  });
  execFileSync(process.execPath, ["scripts/fca/build-index.mjs"], {
    cwd: appRoot,
    stdio: "pipe",
  });

  const db = new DatabaseSync(indexFile(defaultSnapshotId), { readOnly: true });
  const snapshot = db.prepare("SELECT * FROM snapshot").get();
  assert.equal(snapshot.item_count, 8);
  assert.equal(snapshot.id, defaultSnapshotId);
  assert.match(snapshot.sha256, /^[a-f0-9]{64}$/);

  const result = db
    .prepare(`
      SELECT provision_id
      FROM provisions_fts
      WHERE provisions_fts MATCH ?
      ORDER BY bm25(provisions_fts)
      LIMIT 1
    `)
    .get("guaranteed protected secure");
  db.close();
  assert.equal(result.provision_id, "COBS 4.2.5G");
});

