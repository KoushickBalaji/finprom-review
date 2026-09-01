import path from "node:path";
import { fileURLToPath } from "node:url";
import { chunkHandbook } from "./chunk-handbook-lib.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "../..");
const snapshotDate = process.argv[2] || "2026-08-30";
const snapshotId = `fca-handbook-${snapshotDate}`;
const inputPath = path.resolve(process.argv[3] || path.join(appRoot, "corpus", "snapshots", snapshotId, "provisions.ndjson"));
const outputDir = path.resolve(process.argv[4] || path.join(appRoot, "corpus", "chunks", snapshotId));

console.log(`Building deterministic chunk preview from ${inputPath}`);
const { finalPath, reportPath, report } = await chunkHandbook({
  inputPath,
  outputDir,
  snapshotId,
  snapshotDate,
});
console.log(JSON.stringify({
  chunksPath: finalPath,
  reportPath,
  counts: report.counts,
  strategies: report.strategies,
  chunkTextCharacters: report.chunkTextCharacters,
  structuralChunkTextCharacters: report.structuralChunkTextCharacters,
}, null, 2));

