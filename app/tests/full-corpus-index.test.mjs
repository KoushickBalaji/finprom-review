import assert from "node:assert/strict";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { buildFullIndex } from "../scripts/fca/full-index-lib.mjs";

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

test("builds a checksum-bound chunk index with cross references and FTS", async (context) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "fca-full-index-"));
  context.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const snapshotId = "fca-handbook-test";
  const canonical = {
    id: "parent-1",
    source: { chapterUrl: "https://handbook.fca.org.uk/handbook/conc3" },
    fcaIdentifiers: { provisionId: "p1" },
    crossReferences: [{ kind: "handbook", label: "CONC 3.3.2 R", url: "https://example.test" }],
  };
  const chunk = {
    id: "chunk-1",
    parentId: "parent-1",
    citation: "CONC 3.3.1 R",
    provisionName: "CONC 3.3.1",
    provisionType: "rule",
    provisionTypeCode: "R",
    sourcebook: "CONC",
    sourcebookName: "Consumer Credit sourcebook",
    module: "Business Standards",
    chapter: "CONC 3 Financial promotions",
    section: "CONC 3.3 Clear fair and not misleading",
    subsection: "The rule",
    hierarchy: "Business Standards | CONC | CONC 3 | CONC 3.3",
    snapshotId,
    snapshotDate: "2026-08-30",
    dates: { provisionDate: "2026-01-01" },
    retrieval: { eligibility: "substantive", strategy: "whole-provision", requiresAssetReview: false },
    position: { index: 1, count: 1 },
    text: "A financial promotion must be clear, fair and not misleading.",
    searchText: "CONC 3.3.1 R\n\nA financial promotion must be clear, fair and not misleading.",
    content: { textSha256: sha("A financial promotion must be clear, fair and not misleading.") },
  };
  const canonicalText = `${JSON.stringify(canonical)}\n`;
  const chunkText = `${JSON.stringify(chunk)}\n`;
  const canonicalFile = path.join(directory, "provisions.ndjson");
  const chunkFile = path.join(directory, "chunks.ndjson");
  const manifestFile = path.join(directory, "manifest.json");
  const outputFile = path.join(directory, "index.sqlite");
  await Promise.all([
    fsp.writeFile(canonicalFile, canonicalText),
    fsp.writeFile(chunkFile, chunkText),
    fsp.writeFile(manifestFile, JSON.stringify({
      snapshotId,
      snapshotDate: "2026-08-30",
      derivedFrom: { sha256: sha(canonicalText) },
      files: { chunks: { sha256: sha(chunkText) } },
    })),
  ]);

  const result = await buildFullIndex({
    snapshotId,
    chunkFile,
    chunkManifestFile: manifestFile,
    canonicalFile,
    outputFile,
  });
  assert.equal(result.searchableCount, 1);

  const db = new DatabaseSync(outputFile, { readOnly: true });
  const found = db.prepare(`
    SELECT c.citation, c.url, c.cross_references_json
    FROM chunks_fts JOIN chunks c ON c.rowid = chunks_fts.rowid
    WHERE chunks_fts MATCH 'misleading'
  `).get();
  db.close();
  assert.equal(found.citation, "CONC 3.3.1 R");
  assert.equal(found.url, "https://handbook.fca.org.uk/handbook/conc3#p1");
  assert.equal(JSON.parse(found.cross_references_json)[0].label, "CONC 3.3.2 R");
});

