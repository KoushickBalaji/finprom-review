import path from "node:path";
import { corpusRoot, snapshotDir } from "./corpus-paths.mjs";
import { normalizeHandbook } from "./normalize-handbook-lib.mjs";

const snapshotDate = process.argv[2] || "2026-08-30";
const snapshotId = process.argv[3] || `fca-handbook-${snapshotDate}`;
const rawRoot = path.join(corpusRoot, "raw", snapshotDate);
const outputDir = snapshotDir(snapshotId);

const { manifest, report, provisionsPath } = await normalizeHandbook({
  rawRoot,
  outputDir,
  snapshotDate,
  snapshotId,
});

console.log(`Normalized ${manifest.counts.provisions} FCA provisions.`);
console.log(`Snapshot: ${snapshotId}`);
console.log(`Output: ${provisionsPath}`);
console.log(`Validation: ${report.validation.passed ? "passed" : "failed"}`);

if (!report.validation.passed) process.exitCode = 1;


