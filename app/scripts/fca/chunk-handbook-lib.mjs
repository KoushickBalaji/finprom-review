import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { load } from "cheerio";

const DEFAULTS = Object.freeze({ reviewCharacters: 8_000, targetCharacters: 6_000 });
const collapse = (value) => String(value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const sortedCounts = (map) => Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)));

function elementText($, node) {
  const clone = $(node).clone();
  clone.find("script, style, noscript").remove();
  clone.find("br").replaceWith("\n");
  return collapse(clone.text());
}

function splitLongText(text, maximum, warnings, label) {
  const clean = collapse(text);
  if (clean.length <= maximum) return [clean];

  const sentences = clean.match(/[^.!?;]+(?:[.!?;]+(?=\s|$)|$)/g)?.map(collapse).filter(Boolean) ?? [clean];
  const pieces = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maximum) {
      if (current) pieces.push(current);
      current = "";
      const words = sentence.split(/\s+/);
      let forced = "";
      for (const word of words) {
        if (forced && `${forced} ${word}`.length > maximum) {
          pieces.push(forced);
          forced = word;
        } else {
          forced = forced ? `${forced} ${word}` : word;
        }
      }
      if (forced) pieces.push(forced);
      warnings.push(`${label}: forced word-boundary split because one sentence exceeded ${maximum} characters`);
      continue;
    }
    if (current && `${current} ${sentence}`.length > maximum) {
      pieces.push(current);
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

function isStructuralHeading(unit) {
  if (unit.tag.startsWith("h")) return true;
  if (!unit.strongLead) return false;
  return /^(question\s+\d|\d+(?:\.\d+)*[.):]?\s|[A-Z][.):]\s|notes?:$|purpose\b|interpreting\b)/i.test(unit.text)
    || (unit.text.length <= 180 && unit.strongText.length >= Math.min(unit.text.length, 24));
}

function narrativeUnits($, nodes, maximum, warnings, label) {
  const units = [];
  for (const node of nodes) {
    const text = elementText($, node);
    if (!text) continue;
    const tag = node.tagName?.toLowerCase() ?? "p";
    const first = $(node).children().first();
    const strongLead = first.is("strong, b");
    const strongText = strongLead ? collapse(first.text()) : "";
    const pieces = splitLongText(text, maximum, warnings, label);
    pieces.forEach((piece, index) => units.push({
      text: piece,
      tag,
      strongLead: index === 0 && strongLead,
      strongText: index === 0 ? strongText : "",
      continuation: index > 0,
    }));
  }
  return units;
}

function packNarrative(units, config, basePath) {
  const chunks = [];
  let current = [];
  let currentLength = 0;
  let heading = null;
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      strategy: "structural-narrative",
      structuralPath: [...basePath, ...(heading ? [heading] : [])],
      text: current.map((unit) => unit.text).join("\n\n"),
    });
    current = [];
    currentLength = 0;
  };

  for (const unit of units) {
    const boundary = isStructuralHeading(unit) && !unit.continuation;
    if (boundary && current.length) flush();
    if (boundary) heading = unit.text.slice(0, 240);
    const added = unit.text.length + (current.length ? 2 : 0);
    if (current.length && currentLength + added > config.targetCharacters) flush();
    current.push(unit);
    currentLength += added;
  }
  flush();
  return chunks;
}

function expandedTableRows($, table) {
  let activeSpans = new Map();
  return $(table).find("tr").toArray().map((row, rowIndex) => {
    const grid = new Map();
    for (const [column, span] of activeSpans) {
      grid.set(column, { ...span, inherited: true, column });
    }

    const newSpans = [];
    let cursor = 0;
    for (const [cellIndex, cell] of $(row).children("th, td").toArray().entries()) {
      while (grid.has(cursor)) cursor += 1;
      const colspan = Math.max(1, Number.parseInt($(cell).attr("colspan") || "1", 10) || 1);
      const rowspan = Math.max(1, Number.parseInt($(cell).attr("rowspan") || "1", 10) || 1);
      const entry = {
        text: elementText($, cell),
        header: cell.tagName?.toLowerCase() === "th",
        colspan,
        rowspan,
        inherited: false,
        column: cursor,
        originRow: rowIndex,
        spanId: `r${rowIndex}c${cursor}i${cellIndex}`,
      };
      for (let offset = 0; offset < colspan; offset += 1) {
        grid.set(cursor + offset, { ...entry, duplicate: offset > 0, column: cursor + offset });
        if (rowspan > 1) newSpans.push([cursor + offset, { ...entry, remaining: rowspan - 1 }]);
      }
      cursor += colspan;
    }

    const nextSpans = new Map();
    for (const [column, span] of activeSpans) {
      if (span.remaining > 1) nextSpans.set(column, { ...span, remaining: span.remaining - 1 });
    }
    for (const [column, span] of newSpans) nextSpans.set(column, span);
    activeSpans = nextSpans;

    const seen = new Set();
    const cells = [...grid.values()]
      .sort((a, b) => a.column - b.column)
      .filter((entry) => {
        if (entry.duplicate || seen.has(entry.spanId)) return false;
        seen.add(entry.spanId);
        return true;
      });
    return { rowIndex, cells };
  });
}

function tableRows($, table, maximum, warnings, tableLabel) {
  return expandedTableRows($, table).flatMap(({ rowIndex, cells }) => {
    if (!cells.some(({ text }) => text)) return [];
    const rowText = cells.map(({ text }) => text).join(" | ");
    const nonEmptyCells = cells.filter(({ text }) => text);
    const section = (nonEmptyCells.length === 1 && nonEmptyCells[0].text.length <= 500)
      || cells.some(({ colspan, inherited }) => !inherited && colspan > 1)
      || (cells.length === 2 && /^\d+[A-Za-z]?$/.test(cells[0].text) && cells[1].text.length < 500);
    const header = cells.some(({ header: isHeader, inherited }) => isHeader && !inherited);
    const inheritedRowspanLabels = cells
      .filter(({ inherited, text }) => inherited && text)
      .map(({ column, originRow, text }) => ({ column: column + 1, originRow: originRow + 1, text }));
    if (rowText.length <= maximum) return [{ rowIndex, cells, text: rowText, section, header, inheritedRowspanLabels }];

    const splittableIndexes = cells.map((cell, index) => ({ cell, index })).filter(({ cell }) => !cell.inherited);
    const longestIndex = (splittableIndexes.length ? splittableIndexes : cells.map((cell, index) => ({ cell, index })))
      .reduce((best, candidate) => candidate.cell.text.length > best.cell.text.length ? candidate : best).index;
    const fixedLength = cells.reduce((sum, cell, index) => index === longestIndex ? sum : sum + cell.text.length + 3, 0);
    const available = Math.max(1_000, maximum - fixedLength);
    const parts = splitLongText(cells[longestIndex].text, available, warnings, `${tableLabel} row ${rowIndex + 1}`);
    return parts.map((part, partIndex) => {
      const segmentCells = cells.map((cell, index) => index === longestIndex ? { ...cell, text: part } : cell);
      return {
        rowIndex,
        rowPart: partIndex + 1,
        rowParts: parts.length,
        cells: segmentCells,
        text: segmentCells.map(({ text }) => text).join(" | "),
        section: partIndex === 0 && section,
        header,
        inheritedRowspanLabels,
      };
    });
  });
}

function packTable($, table, tableIndex, config, basePath, warnings) {
  const tableLabel = `Table ${tableIndex}`;
  // Leave room for repeated section and column context when a long row is emitted.
  const rows = tableRows($, table, config.targetCharacters, warnings, tableLabel);
  if (!rows.length) return [];
  const initialHeaders = [];
  for (const row of rows) {
    if (!row.header) break;
    initialHeaders.push(row);
  }
  const headerText = initialHeaders.map(({ text }) => text).join("\n");
  const body = rows.slice(initialHeaders.length);
  const chunks = [];
  let group = [];
  let groupLength = 0;
  let sectionLabel = null;
  const flush = () => {
    if (!group.length) return;
    const repeatedHeader = headerText ? `Table header: ${headerText}\n\n` : "";
    const sectionContext = sectionLabel ? `Section: ${sectionLabel}\n\n` : "";
    chunks.push({
      strategy: "structural-table-row-group",
      structuralPath: [...basePath, tableLabel, ...(sectionLabel ? [sectionLabel.slice(0, 240)] : [])],
      text: `${repeatedHeader}${sectionContext}${group.map(({ text }) => text).join("\n")}`.trim(),
      table: {
        tableIndex,
        header: headerText || null,
        sourceRows: [...new Set(group.map(({ rowIndex }) => rowIndex + 1))],
        inheritedRowspanLabels: [...new Map(group
          .flatMap(({ inheritedRowspanLabels = [] }) => inheritedRowspanLabels)
          .map((label) => [`${label.column}:${label.originRow}:${label.text}`, label])).values()],
      },
    });
    group = [];
    groupLength = 0;
  };

  const candidates = body.length ? body : initialHeaders;
  for (const row of candidates) {
    if (row.section && group.length) flush();
    if (row.section) sectionLabel = row.text;
    const repeated = (headerText ? headerText.length + 15 : 0) + (sectionLabel ? sectionLabel.length + 12 : 0);
    const added = row.text.length + (group.length ? 1 : 0);
    const wouldExceedTarget = repeated + groupLength + added > config.targetCharacters;
    const wouldFitReviewLimit = repeated + groupLength + added <= config.reviewCharacters;
    const groupIsPendingSectionTitle = group.length === 1 && group[0].section;
    if (group.length && wouldExceedTarget && !(groupIsPendingSectionTitle && wouldFitReviewLimit)) flush();
    group.push(row);
    groupLength += added;
  }
  flush();
  return chunks;
}

function structuralChunks(record, config, warnings) {
  const $ = load(record.html || "", {}, false);
  const candidates = $("h1, h2, h3, h4, h5, h6, p, li, table").toArray().filter((node) => {
    const tag = node.tagName?.toLowerCase();
    if (tag === "table") return $(node).parents("table").length === 0;
    if ($(node).parents("table").length) return false;
    if (tag === "p" && $(node).parents("li").length) return false;
    return true;
  });
  if (!candidates.length) {
    return splitLongText(record.text, config.reviewCharacters, warnings, record.citation).map((text) => ({
      strategy: "structural-text-fallback",
      structuralPath: [record.citation],
      text,
    }));
  }

  const output = [];
  let narrative = [];
  const flushNarrative = () => {
    if (!narrative.length) return;
    const units = narrativeUnits($, narrative, config.reviewCharacters, warnings, record.citation);
    output.push(...packNarrative(units, config, [record.citation]));
    narrative = [];
  };
  let tableIndex = 0;
  for (const node of candidates) {
    if (node.tagName?.toLowerCase() !== "table") {
      narrative.push(node);
      continue;
    }
    flushNarrative();
    tableIndex += 1;
    output.push(...packTable($, node, tableIndex, config, [record.citation], warnings));
  }
  flushNarrative();
  return output.length ? output : [{
    strategy: "structural-text-fallback",
    structuralPath: [record.citation],
    text: record.text,
  }];
}

function chunkBase(record) {
  return {
    schemaVersion: 1,
    parentId: record.id,
    snapshotId: record.snapshotId,
    snapshotDate: record.snapshotDate,
    jurisdiction: record.jurisdiction,
    regulator: record.regulator,
    citation: record.citation,
    provisionName: record.provisionName,
    provisionType: record.provisionType,
    provisionTypeCode: record.provisionTypeCode,
    sourcebook: record.sourcebook,
    sourcebookName: record.sourcebookName,
    module: record.module,
    chapter: record.chapter,
    section: record.section,
    subsection: record.subsection,
    hierarchy: record.hierarchy,
    dates: record.dates,
    source: record.source,
    fcaIdentifiers: record.fcaIdentifiers,
    parentContent: {
      htmlSha256: record.content.htmlSha256,
      textSha256: record.content.textSha256,
      textCharacters: record.content.textCharacters,
    },
  };
}

function hasExceptionalStructure(record, config) {
  if (record.content.textCharacters <= config.targetCharacters) return false;
  const html = record.html || "";
  const tables = html.match(/<table\b/gi)?.length ?? 0;
  const rows = html.match(/<tr\b/gi)?.length ?? 0;
  const questions = html.match(/question\s+\d+(?:\.\d+)*/gi)?.length ?? 0;
  return tables > 1 || rows >= 20 || questions >= 5;
}

export function buildChunksForProvision(record, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const warnings = [];
  if (record.content.kind === "placeholder") {
    return { chunks: [], warnings, exclusion: "placeholder", structuralReview: false };
  }

  let drafts;
  if (record.content.kind === "image-only") {
    drafts = [{
      strategy: "image-discovery",
      structuralPath: [record.citation, "Image asset"],
      text: record.text || record.images?.map(({ alt }) => alt).filter(Boolean).join("\n") || record.citation,
    }];
  } else if (record.content.textCharacters <= config.reviewCharacters && !hasExceptionalStructure(record, config)) {
    drafts = [{ strategy: "whole-provision", structuralPath: [record.citation], text: record.text }];
  } else {
    drafts = structuralChunks(record, config, warnings);
  }

  const ids = drafts.map((_, index) => `${record.id}:chunk:${String(index + 1).padStart(4, "0")}`);
  const chunks = drafts.map((draft, index) => {
    const eligibility = record.content.kind === "image-only" ? "discovery-only" : "substantive";
    const contextHeader = [record.citation, ...draft.structuralPath.slice(1)].filter(Boolean).join(" > ");
    const searchText = `${contextHeader}\n\n${draft.text}`.trim();
    return {
      ...chunkBase(record),
      id: ids[index],
      retrieval: {
        eligibility,
        strategy: draft.strategy,
        structuralPath: draft.structuralPath,
        requiresAssetReview: record.content.kind === "mixed" || record.content.kind === "image-only",
      },
      position: {
        index: index + 1,
        count: drafts.length,
        previousChunkId: ids[index - 1] ?? null,
        nextChunkId: ids[index + 1] ?? null,
      },
      ...(draft.table ? { table: draft.table } : {}),
      text: draft.text,
      searchText,
      content: {
        textCharacters: draft.text.length,
        searchTextCharacters: searchText.length,
        textSha256: sha256(draft.text),
        kind: record.content.kind,
        containsTable: Boolean(draft.table),
        containsImage: record.content.containsImage,
      },
    };
  });
  return {
    chunks,
    warnings,
    exclusion: null,
    structuralReview: drafts.some(({ strategy }) => strategy.startsWith("structural-")),
  };
}

const percentile = (sorted, value) => sorted[Math.max(0, Math.ceil((value / 100) * sorted.length) - 1)] ?? 0;
const lengthSummary = (sorted) => ({
  minimum: sorted[0] ?? 0,
  p50: percentile(sorted, 50),
  p90: percentile(sorted, 90),
  p95: percentile(sorted, 95),
  p99: percentile(sorted, 99),
  maximum: sorted.at(-1) ?? 0,
});

export async function chunkHandbook({ inputPath, outputDir, snapshotId, snapshotDate, options = {} }) {
  await fsp.mkdir(outputDir, { recursive: true });
  const finalPath = path.join(outputDir, "chunks.preview.ndjson");
  const tempPath = `${finalPath}.tmp-${process.pid}`;
  const writer = fs.createWriteStream(tempPath, { encoding: "utf8" });
  const outputHash = crypto.createHash("sha256");
  const strategies = new Map();
  const kinds = new Map();
  const warnings = [];
  const excluded = [];
  const splitParents = [];
  const structurallyReviewedParents = [];
  const oversized = [];
  const chunkIds = new Set();
  const parentIds = new Set();
  const lengths = [];
  const structuralLengths = [];
  let records = 0;
  let chunkCount = 0;

  const input = readline.createInterface({ input: fs.createReadStream(inputPath, "utf8"), crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    records += 1;
    parentIds.add(record.id);
    const result = buildChunksForProvision(record, options);
    if (result.exclusion) excluded.push({ parentId: record.id, citation: record.citation, reason: result.exclusion });
    warnings.push(...result.warnings.map((message) => ({ parentId: record.id, citation: record.citation, message })));
    if (result.structuralReview) structurallyReviewedParents.push({ parentId: record.id, citation: record.citation, chunks: result.chunks.length });
    if (result.chunks.length > 1) splitParents.push({ parentId: record.id, citation: record.citation, chunks: result.chunks.length });
    for (const chunk of result.chunks) {
      if (chunkIds.has(chunk.id)) throw new Error(`Duplicate chunk id: ${chunk.id}`);
      chunkIds.add(chunk.id);
      chunkCount += 1;
      increment(strategies, chunk.retrieval.strategy);
      increment(kinds, chunk.content.kind);
      lengths.push(chunk.content.textCharacters);
      if (chunk.retrieval.strategy.startsWith("structural-")) structuralLengths.push(chunk.content.textCharacters);
      if (chunk.content.textCharacters > (options.reviewCharacters ?? DEFAULTS.reviewCharacters)) {
        oversized.push({ chunkId: chunk.id, parentId: chunk.parentId, citation: chunk.citation, characters: chunk.content.textCharacters, strategy: chunk.retrieval.strategy });
      }
      const serialized = `${JSON.stringify(chunk)}\n`;
      outputHash.update(serialized);
      if (!writer.write(serialized)) await new Promise((resolve) => writer.once("drain", resolve));
    }
  }
  writer.end();
  await new Promise((resolve, reject) => writer.on("finish", resolve).on("error", reject));
  await fsp.rename(tempPath, finalPath);

  lengths.sort((a, b) => a - b);
  structuralLengths.sort((a, b) => a - b);
  const stat = await fsp.stat(finalPath);
  const report = {
    schemaVersion: 1,
    snapshotId,
    snapshotDate,
    createdAt: new Date().toISOString(),
    configuration: { ...DEFAULTS, ...options },
    counts: {
      canonicalParents: records,
      parentsRepresented: new Set([...chunkIds].map((id) => id.replace(/:chunk:\d{4}$/, ""))).size,
      chunks: chunkCount,
      structurallyReviewedParents: structurallyReviewedParents.length,
      splitParents: splitParents.length,
      excludedPlaceholders: excluded.length,
      warnings: warnings.length,
      oversizedChunks: oversized.length,
    },
    strategies: sortedCounts(strategies),
    contentKinds: sortedCounts(kinds),
    chunkTextCharacters: lengthSummary(lengths),
    structuralChunkTextCharacters: lengthSummary(structuralLengths),
    splitParents,
    structurallyReviewedParents,
    excluded,
    oversized,
    warnings,
  };
  const reportPath = path.join(outputDir, "chunking-report.json");
  await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const manifest = {
    schemaVersion: 1,
    snapshotId,
    snapshotDate,
    createdAt: report.createdAt,
    derivedFrom: { path: path.resolve(inputPath), sha256: await hashFile(inputPath) },
    files: {
      chunks: { path: path.basename(finalPath), sha256: outputHash.digest("hex"), bytes: stat.size },
      report: { path: path.basename(reportPath) },
    },
    counts: report.counts,
    configuration: report.configuration,
  };
  await fsp.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { finalPath, reportPath, manifest, report };
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  for await (const part of fs.createReadStream(filePath)) hash.update(part);
  return hash.digest("hex");
}

