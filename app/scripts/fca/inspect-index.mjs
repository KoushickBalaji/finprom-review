import { DatabaseSync } from "node:sqlite";
import { defaultSnapshotId, indexFile } from "./corpus-paths.mjs";

const query = process.argv.slice(2).join(" ") || "fair clear misleading";
const db = new DatabaseSync(indexFile(defaultSnapshotId), { readOnly: true });
const snapshot = db.prepare("SELECT * FROM snapshot").get();
const results = db
  .prepare(`
    SELECT provision_id, sourcebook, heading,
           snippet(provisions_fts, 3, '[', ']', ' … ', 24) AS excerpt,
           bm25(provisions_fts, 0, 4, 2, 1, 0.5) AS score
    FROM provisions_fts
    WHERE provisions_fts MATCH ?
    ORDER BY score
    LIMIT 10
  `)
  .all(query);
db.close();
console.log(JSON.stringify({ snapshot, query, results }, null, 2));


