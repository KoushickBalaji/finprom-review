import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import {
  buildApplicabilityRoute,
  matchingRouteLanes,
} from "../../lib/applicability-router.js";
import { FCA_PRODUCT_IDS } from "../../shared/fca-product-registry.js";
import { corpusRoot } from "./corpus-paths.mjs";

const snapshotId = process.argv[2] ?? "fca-handbook-2026-08-30";
const inputFile = process.argv[3] ?? path.join(
  corpusRoot,
  "chunks",
  snapshotId,
  "chunks.preview.ndjson",
);

const products = FCA_PRODUCT_IDS;
const reports = Object.fromEntries(products.map((product) => {
  const route = buildApplicabilityRoute({
    product,
    channel: "website",
    audience: "uk_retail",
    jurisdiction: "UK_FCA",
  });
  return [product, {
    scopeId: route.scopeId,
    route,
    matchedChunks: 0,
    matchedProvisions: new Set(),
    laneCounts: Object.fromEntries(route.lanes.map((lane) => [lane.id, 0])),
    sourcebookCounts: {},
  }];
}));

let corpusChunks = 0;
let substantiveChunks = 0;

const lines = readline.createInterface({
  input: createReadStream(inputFile, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  corpusChunks += 1;
  if ((record.retrieval?.eligibility ?? "substantive") !== "substantive") continue;
  substantiveChunks += 1;

  for (const report of Object.values(reports)) {
    const laneIds = matchingRouteLanes(record, report.route);
    if (!laneIds.length) continue;
    report.matchedChunks += 1;
    report.matchedProvisions.add(record.parentId);
    report.sourcebookCounts[record.sourcebook] =
      (report.sourcebookCounts[record.sourcebook] ?? 0) + 1;
    for (const laneId of laneIds) report.laneCounts[laneId] += 1;
  }
}

const output = {
  snapshotId,
  inputFile,
  corpusChunks,
  substantiveChunks,
  routes: Object.fromEntries(Object.entries(reports).map(([product, report]) => [product, {
    scopeId: report.scopeId,
    principalSourcebooks: report.route.principalSourcebooks,
    matchedChunks: report.matchedChunks,
    matchedProvisions: report.matchedProvisions.size,
    percentageOfSubstantiveChunks: Number(
      ((report.matchedChunks / substantiveChunks) * 100).toFixed(2),
    ),
    laneCounts: report.laneCounts,
    sourcebookCounts: report.sourcebookCounts,
  }])),
};

console.log(JSON.stringify(output, null, 2));

