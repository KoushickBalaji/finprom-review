import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { matchingRouteLanes } from "./applicability-router.js";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INDEX_PATH = path.resolve(
  moduleDir,
  "../corpus/index/fca-handbook-2026-08-30.sqlite",
);
const EMBEDDING_MODEL = process.env.FCA_EMBEDDING_MODEL || "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = Number.parseInt(
  process.env.FCA_EMBEDDING_DIMENSIONS || "1536",
  10,
);
const RETRIEVAL_MODES = new Set(["lexical", "semantic", "hybrid"]);
const DEFAULT_BLOB_PATH = "fca-handbook/2026-08-30/fca-handbook-2026-08-30-int8.sqlite";
const DEFAULT_BLOB_PART_PREFIX = "fca-handbook-2026-08-30-int8.sqlite.part";
const DEFAULT_BLOB_PART_COUNT = 12;
const DEPLOYMENT_INDEX_SIZE_BYTES = 191_381_504;
const vectorCache = new Map();
let remoteIndexPath = null;
let remoteIndexPromise = null;
const lexicalStopWords = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "its", "of", "on", "or", "our", "that", "the", "their",
  "this", "to", "was", "were", "will", "with", "your",
]);

export function fullCorpusIndexPath() {
  return process.env.FCA_INDEX_PATH || remoteIndexPath || DEFAULT_INDEX_PATH;
}

export function fullCorpusIndexAvailable() {
  try {
    return fs.statSync(fullCorpusIndexPath()).isFile();
  } catch {
    return false;
  }
}

function validateDownloadedIndex(indexPath) {
  const { size } = fs.statSync(indexPath);
  if (size !== DEPLOYMENT_INDEX_SIZE_BYTES) {
    throw new Error(`Downloaded FCA index has an unexpected size (${size})`);
  }
  const db = new DatabaseSync(indexPath, { readOnly: true });
  try {
    const manifest = db.prepare("SELECT * FROM index_manifest LIMIT 1").get();
    if (!manifest || manifest.snapshot_id !== "fca-handbook-2026-08-30") {
      throw new Error("Downloaded FCA index has an unexpected snapshot manifest");
    }
    if (manifest.searchable_count !== 35_628 || manifest.schema_version < 3) {
      throw new Error("Downloaded FCA index failed deployment-profile validation");
    }
  } finally {
    db.close();
  }
}

export async function prepareFullCorpusIndex() {
  if (fullCorpusIndexAvailable()) return true;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return false;
  if (remoteIndexPromise) return remoteIndexPromise;

  remoteIndexPromise = (async () => {
    const directory = path.join(os.tmpdir(), "zango-fca-index");
    const destination = path.join(
      directory,
      "fca-handbook-2026-08-30-int8.sqlite",
    );
    await fsp.mkdir(directory, { recursive: true });
    try {
      validateDownloadedIndex(destination);
      remoteIndexPath = destination;
      return true;
    } catch {
      await fsp.rm(destination, { force: true });
    }

    const temporary = `${destination}.${process.pid}.download`;
    await fsp.rm(temporary, { force: true });
    const { get } = await import("@vercel/blob");

    const downloadPart = async (blobPath, flags) => {
      const result = await get(blobPath, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new Error(
          `Private FCA index blob could not be read (${result?.statusCode ?? "unavailable"}): ${blobPath}`,
        );
      }
      const source =
        typeof result.stream.getReader === "function"
          ? Readable.fromWeb(result.stream)
          : result.stream;
      await pipeline(source, fs.createWriteStream(temporary, { flags }));
    };

    try {
      if (process.env.FCA_INDEX_BLOB_PATH) {
        await downloadPart(process.env.FCA_INDEX_BLOB_PATH, "wx");
      } else {
        const prefix =
          process.env.FCA_INDEX_BLOB_PART_PREFIX || DEFAULT_BLOB_PART_PREFIX;
        const count = Number.parseInt(
          process.env.FCA_INDEX_BLOB_PART_COUNT || String(DEFAULT_BLOB_PART_COUNT),
          10,
        );
        if (!Number.isInteger(count) || count < 1 || count > 100) {
          throw new Error("FCA_INDEX_BLOB_PART_COUNT must be between 1 and 100");
        }
        for (let index = 0; index < count; index += 1) {
          const suffix = String(index).padStart(2, "0");
          await downloadPart(`${prefix}-${suffix}`, index === 0 ? "wx" : "a");
        }
      }
      validateDownloadedIndex(temporary);
      await fsp.rename(temporary, destination);
    } finally {
      await fsp.rm(temporary, { force: true });
    }
    remoteIndexPath = destination;
    return true;
  })().catch((error) => {
    remoteIndexPromise = null;
    throw error;
  });
  return remoteIndexPromise;
}

function ftsQuery(value) {
  const terms = String(value)
    .toLowerCase()
    .match(/[a-z0-9£%]+/g)
    ?.filter((term) => term.length > 1 && !lexicalStopWords.has(term))
    .slice(0, 32) ?? [];
  return [...new Set(terms)].map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
}

function ftsPhraseQuery(values) {
  const phrases = values.flatMap((value) => {
    const terms = String(value).toLowerCase().match(/[a-z0-9£%]+/g) ?? [];
    return terms.length > 1 ? [terms.join(" ")] : [];
  });
  return [...new Set(phrases)]
    .slice(0, 16)
    .map((phrase) => `"${phrase.replaceAll('"', '""')}"`)
    .join(" OR ");
}

function selectorSql(route, alias = "c") {
  const clauses = [];
  const parameters = [];
  for (const lane of route.lanes) {
    for (const selector of lane.selectors) {
      const parts = [];
      if (selector.sourcebook) {
        parts.push(`${alias}.sourcebook = ?`);
        parameters.push(selector.sourcebook);
      }
      if (selector.module) {
        parts.push(`${alias}.module = ?`);
        parameters.push(selector.module);
      }
      for (const [field, prefixes] of [
        ["chapter", selector.chapterPrefixes],
        ["section", selector.sectionPrefixes],
        ["provision_name", selector.provisionPrefixes],
      ]) {
        if (!prefixes?.length) continue;
        const prefixParts = [];
        for (const prefix of prefixes) {
          prefixParts.push(`(${alias}.${field} = ? OR ${alias}.${field} LIKE ? OR ${alias}.${field} LIKE ?)`);
          parameters.push(prefix, `${prefix} %`, `${prefix}.%`);
        }
        parts.push(`(${prefixParts.join(" OR ")})`);
      }
      if (parts.length) clauses.push(`(${parts.join(" AND ")})`);
    }
  }
  if (!clauses.length) throw new Error(`Route ${route.scopeId} has no selectors`);
  return { clause: `(${clauses.join(" OR ")})`, parameters };
}

function rowToEvidence(row, route) {
  const record = {
    id: row.citation,
    chunkId: row.chunk_id,
    parentId: row.parent_id,
    citation: row.citation,
    provisionName: row.provision_name,
    sourcebook: row.sourcebook,
    module: row.module,
    chapter: row.chapter,
    section: row.section,
    heading: row.subsection || row.section || row.chapter || row.citation,
    provisionType: row.provision_type
      ? `${row.provision_type[0].toUpperCase()}${row.provision_type.slice(1)}`
      : "Provision",
    quote: row.text,
    url: row.url,
    effectiveDate: row.effective_date,
    snapshotId: row.snapshot_id,
    eligibility: row.eligibility,
    crossReferences: JSON.parse(row.cross_references_json || "[]"),
    scopeLanes: matchingRouteLanes({
      sourcebook: row.sourcebook,
      module: row.module,
      chapter: row.chapter,
      section: row.section,
      provisionName: row.provision_name,
    }, route),
  };
  return record;
}

function dotSimilarity(query, candidate, candidateNorm, queryNorm, scale = 1) {
  let dot = 0;
  for (let index = 0; index < query.length; index += 1) {
    dot += query[index] * candidate[index] * scale;
  }
  const denominator = queryNorm * candidateNorm;
  return denominator ? dot / denominator : 0;
}

function reciprocalRankFusion(weightedLists) {
  const scores = new Map();
  for (const { list, weight } of weightedLists) {
    list.forEach((item, index) => {
      scores.set(
        item.chunk_id,
        (scores.get(item.chunk_id) ?? 0) + weight / (60 + index + 1),
      );
    });
  }
  return scores;
}

function loadScopedVectors(db, route, manifest) {
  const quantized = manifest.schema_version >= 3;
  const int16 = manifest.schema_version >= 4;
  const cacheKey = `${manifest.chunk_sha256}:${manifest.schema_version}:${route.scopeId}:${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}`;
  if (vectorCache.has(cacheKey)) return vectorCache.get(cacheKey);
  const scope = selectorSql(route);
  const rows = db.prepare(`
    SELECT c.chunk_id, c.sourcebook, e.vector, e.norm${quantized ? ", e.scale" : ""}
    FROM embeddings e
    JOIN chunks c ON c.chunk_id = e.chunk_id
    WHERE e.model = ? AND e.dimensions = ?
      AND c.eligibility = 'substantive' AND ${scope.clause}
  `).all(EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, ...scope.parameters);
  const vectors = rows.map((row) => ({
    chunk_id: row.chunk_id,
    sourcebook: row.sourcebook,
    norm: row.norm,
    vector: quantized
      ? int16
        ? new Int16Array(
            row.vector.buffer,
            row.vector.byteOffset,
            row.vector.byteLength / Int16Array.BYTES_PER_ELEMENT,
          )
        : new Int8Array(row.vector.buffer, row.vector.byteOffset, row.vector.byteLength)
      : new Float32Array(
          row.vector.buffer,
          row.vector.byteOffset,
          row.vector.byteLength / Float32Array.BYTES_PER_ELEMENT,
        ),
    scale: quantized ? row.scale : 1,
  }));
  vectorCache.set(cacheKey, vectors);
  return vectors;
}

function lexicalRanks(db, query, route, phrases = [], limit = 80) {
  const scope = selectorSql(route);
  const match = [ftsPhraseQuery(phrases), ftsQuery(query)].filter(Boolean).join(" OR ");
  if (!match) return [];
  return db.prepare(`
    SELECT c.*, bm25(chunks_fts, 0, 7, 2, 1, 5) AS lexical_score
    FROM chunks_fts
    JOIN chunks c ON c.rowid = chunks_fts.rowid
    WHERE chunks_fts MATCH ? AND c.eligibility = 'substantive' AND ${scope.clause}
    ORDER BY lexical_score ASC
    LIMIT ?
  `).all(match, ...scope.parameters, limit);
}

function semanticRanks(db, queryEmbedding, route, manifest, limit = 80) {
  if (!queryEmbedding?.length) return [];
  const vectors = loadScopedVectors(db, route, manifest);
  if (!vectors.length) return [];
  const queryNorm = Math.sqrt(queryEmbedding.reduce((sum, value) => sum + value * value, 0));
  return vectors
    .map((item) => ({
      chunk_id: item.chunk_id,
      sourcebook: item.sourcebook,
      semantic_score: dotSimilarity(queryEmbedding, item.vector, item.norm, queryNorm, item.scale),
    }))
    .sort((a, b) => b.semantic_score - a.semantic_score)
    .slice(0, limit);
}

function fetchRowsByIds(db, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM chunks WHERE chunk_id IN (${placeholders})`).all(...ids);
  const byId = new Map(rows.map((row) => [row.chunk_id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function citationKey(value) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9.]/g, "");
}

function lexicalAnchorIds(db, lexical, evidenceLimit) {
  const maximum = Math.min(5, Math.max(1, evidenceLimit - 1));
  const anchors = [];
  const citations = new Set();
  for (const item of lexical) {
    if (anchors.length >= maximum) break;
    const row = fetchRowsByIds(db, [item.chunk_id])[0];
    if (!row) continue;
    const key = citationKey(row.citation);
    if (citations.has(key)) continue;
    citations.add(key);
    anchors.push(item.chunk_id);
  }
  return anchors;
}

function expandReferences(db, seeds, route, selectedCitations, maximum = 2) {
  const expanded = [];
  for (const seed of seeds) {
    const references = seed.crossReferences.slice(0, route.referenceExpansion.maximumTargetsPerSeed);
    for (const reference of references) {
      if (expanded.length >= maximum) return expanded;
      const key = citationKey(reference.label);
      if (!key || selectedCitations.has(key)) continue;
      const target = db.prepare(`
        SELECT * FROM chunks
        WHERE citation_key = ? AND snapshot_id = ? AND eligibility = 'substantive'
        ORDER BY position_index LIMIT 1
      `).get(key, seed.snapshotId);
      if (!target) continue;
      const evidence = rowToEvidence(target, route);
      evidence.scopeLanes = [`reference-from:${seed.id}`];
      evidence.referenceExpansion = { from: seed.id, label: reference.label };
      expanded.push(evidence);
      selectedCitations.add(key);
    }
  }
  return expanded;
}

export async function retrieveFullCorpusEvidence({
  query,
  route,
  queryEmbedding,
  lexicalPhrases = [],
  retrievalMode = "hybrid",
  evidenceLimit = 6,
  expandReferenceLimit = 2,
}) {
  if (!(await prepareFullCorpusIndex())) return null;
  if (!RETRIEVAL_MODES.has(retrievalMode)) {
    throw new Error(`Unsupported full-corpus retrieval mode: ${retrievalMode}`);
  }
  if (!Number.isInteger(evidenceLimit) || evidenceLimit <= 0) {
    throw new Error("evidenceLimit must be a positive integer");
  }
  if (retrievalMode === "semantic" && !queryEmbedding?.length) {
    throw new Error("Semantic retrieval requires a query embedding");
  }
  const db = new DatabaseSync(fullCorpusIndexPath(), { readOnly: true });
  try {
    const manifest = db.prepare("SELECT * FROM index_manifest LIMIT 1").get();
    if (!manifest) throw new Error("Full FCA index has no manifest");
    const lexical = retrievalMode === "semantic"
      ? []
      : lexicalRanks(db, query, route, lexicalPhrases);
    const semantic = retrievalMode === "lexical"
      ? []
      : semanticRanks(db, queryEmbedding, route, manifest);
    const fused = reciprocalRankFusion([
      { list: lexical, weight: retrievalMode === "hybrid" ? 2 : 1 },
      { list: semantic, weight: 1 },
    ]);
    const principal = new Set(route.principalSourcebooks);
    const rankedIds = [...new Set([...lexical, ...semantic].map((item) => item.chunk_id))]
      .map((chunkId) => ({
        chunkId,
        score: (fused.get(chunkId) ?? 0) + (
          [...lexical, ...semantic].find((item) => item.chunk_id === chunkId && principal.has(item.sourcebook))
            ? 0.0125
            : 0
        ),
      }))
      .sort((a, b) => b.score - a.score);

    // Legal retrieval rewards precision differently from general semantic search:
    // preserve the strongest citation-deduplicated text matches, then let fusion
    // fill the remaining evidence slots with semantically useful context.
    const anchorIds = retrievalMode === "hybrid"
      ? lexicalAnchorIds(db, lexical, evidenceLimit)
      : [];
    const candidateOrder = [
      ...anchorIds.map((chunkId) => ({
        chunkId,
        score: rankedIds.find((item) => item.chunkId === chunkId)?.score ?? 0,
      })),
      ...rankedIds.filter((item) => !anchorIds.includes(item.chunkId)),
    ];

    const lexicalRank = new Map(lexical.map((item, index) => [item.chunk_id, index + 1]));
    const semanticRank = new Map(semantic.map((item, index) => [item.chunk_id, index + 1]));
    const evidence = [];
    const citations = new Set();
    for (const item of candidateOrder) {
      if (evidence.length >= evidenceLimit) break;
      const row = fetchRowsByIds(db, [item.chunkId])[0];
      if (!row) continue;
      const key = citationKey(row.citation);
      if (citations.has(key)) continue;
      citations.add(key);
      evidence.push({
        ...rowToEvidence(row, route),
        lexicalRank: lexicalRank.get(item.chunkId) ?? null,
        semanticRank: semanticRank.get(item.chunkId) ?? null,
        fusedScore: item.score,
      });
    }
    if (expandReferenceLimit > 0) {
      evidence.push(...expandReferences(db, evidence, route, citations, expandReferenceLimit));
    }
    if (!evidence.length) throw new Error(`Full FCA index returned no evidence for ${route.scopeId}`);

    return {
      evidence,
      snapshot: {
        id: manifest.snapshot_id,
        asOf: manifest.snapshot_date,
        scope: `Full FCA Handbook retrieval index (${manifest.searchable_count} searchable chunks)`,
        corpusMode: manifest.deployment_profile || "full-handbook-local-index",
        chunkSha256: manifest.chunk_sha256,
        canonicalSha256: manifest.canonical_sha256,
        semanticSearch: semantic.length > 0,
        embeddingModel: semantic.length > 0 ? EMBEDDING_MODEL : null,
        embeddingDimensions: semantic.length > 0 ? EMBEDDING_DIMENSIONS : null,
      },
      retrieval: {
        mode: retrievalMode,
        fusionPolicy: retrievalMode === "hybrid" ? "lexical-anchored-rrf" : null,
        lexicalAnchors: anchorIds.length,
        lexicalCandidates: lexical.length,
        semanticCandidates: semantic.length,
        evidenceLimit,
        referenceExpansionLimit: expandReferenceLimit,
      },
    };
  } finally {
    db.close();
  }
}

