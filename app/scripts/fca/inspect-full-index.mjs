import { DatabaseSync } from "node:sqlite";
import { fullSnapshotId, indexFile } from "./corpus-paths.mjs";

const snapshotId = process.argv[2] || fullSnapshotId;
const db = new DatabaseSync(indexFile(snapshotId), { readOnly: true });
const manifest = db.prepare("SELECT * FROM index_manifest").get();
const sourcebooks = db.prepare(`
  SELECT sourcebook, COUNT(*) AS chunks
  FROM chunks WHERE eligibility = 'substantive'
  GROUP BY sourcebook ORDER BY sourcebook
`).all();
const content = db.prepare(`
  SELECT COUNT(*) AS chunks,
         SUM(LENGTH(search_text)) AS search_characters,
         ROUND(AVG(LENGTH(search_text)), 2) AS average_characters,
         MAX(LENGTH(search_text)) AS maximum_characters
  FROM chunks WHERE eligibility = 'substantive'
`).get();
const embeddings = db.prepare(`
  SELECT model, dimensions, COUNT(*) AS embedded_chunks
  FROM embeddings GROUP BY model, dimensions
`).all();
const runs = db.prepare("SELECT * FROM embedding_runs ORDER BY started_at DESC").all();
db.close();
console.log(JSON.stringify({
  manifest,
  content: {
    ...content,
    estimatedTokensLow: Math.ceil(content.search_characters / 4.5),
    estimatedTokensHigh: Math.ceil(content.search_characters / 3.5),
  },
  sourcebooks,
  embeddings,
  runs,
}, null, 2));

