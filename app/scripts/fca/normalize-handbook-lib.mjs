import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { load } from "cheerio";

const HANDBOOK_ORIGIN = "https://handbook.fca.org.uk";

const BLOCK_ELEMENTS = [
  "address", "article", "aside", "blockquote", "dd", "div", "dl", "dt",
  "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
  "header", "hr", "main", "nav", "ol", "p", "pre", "section", "table",
  "tbody", "tfoot", "thead", "tr", "ul",
];

const TYPE_MAP = new Map([
  ["rules", { name: "rule", code: "R" }],
  ["guidance", { name: "guidance", code: "G" }],
  ["directions", { name: "direction", code: "D" }],
  ["evidential provisions", { name: "evidential", code: "E" }],
  ["uk legislation", { name: "uk-legislation", code: "UK" }],
  ["eu legislation", { name: "eu-legislation", code: "EU" }],
]);

const normalizeWhitespace = (value) =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export function htmlToPlainText(html, { includeImageAlt = true } = {}) {
  if (!html) return "";
  const $ = load(String(html), {}, false);

  $("script, style, noscript").remove();
  $("img").each((_, element) => {
    const alt = normalizeWhitespace($(element).attr("alt"));
    $(element).replaceWith(includeImageAlt && alt ? `\n[Image: ${alt}]\n` : "");
  });
  $("br").replaceWith("\n");
  $("li").each((_, element) => {
    $(element).prepend("• ");
    $(element).append("\n");
  });
  $("tr").each((_, row) => {
    $(row)
      .find("th, td")
      .each((index, cell) => {
        if (index > 0) $(cell).prepend(" | ");
      });
    $(row).append("\n");
  });
  $(BLOCK_ELEMENTS.join(",")).each((_, element) => {
    $(element).append("\n");
  });

  return normalizeWhitespace($.root().text());
}

export function extractImageReferences(html) {
  if (!html) return [];
  const $ = load(String(html), {}, false);
  const seen = new Set();
  const images = [];
  $("img[src]").each((_, element) => {
    const url = resolveFcaUrl($(element).attr("src"));
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({
      alt: normalizeWhitespace($(element).attr("alt")) || null,
      url,
    });
  });
  return images;
}

export function resolveFcaUrl(value) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  try {
    return new URL(candidate, `${HANDBOOK_ORIGIN}/`).toString();
  } catch {
    return null;
  }
}

export function extractContentLinks(html) {
  if (!html) return [];
  const $ = load(String(html), {}, false);
  const seen = new Set();
  const links = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    const url = resolveFcaUrl(href);
    if (!url) return;
    const label = normalizeWhitespace($(element).text());
    const pathname = new URL(url).pathname.toLowerCase();
    const kind = pathname.startsWith("/handbook/")
      ? "handbook"
      : pathname.startsWith("/glossary/")
        ? "glossary"
        : new URL(url).origin === HANDBOOK_ORIGIN
          ? "fca-internal"
          : "external";
    const key = `${kind}\n${url}\n${label}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ kind, label: label || null, url });
  });
  return links;
}

export function normalizeProvisionType(value) {
  const original = normalizeWhitespace(value);
  return {
    original: original || null,
    ...(TYPE_MAP.get(original.toLowerCase()) ?? { name: "other", code: null }),
  };
}

export function sourcebookCodeFromName(value) {
  return normalizeWhitespace(value).match(/^([A-Z][A-Z0-9-]*)\b/)?.[1] ?? null;
}

export function makeRecordId(snapshotDate, numericId) {
  return `fca-handbook:${snapshotDate}:${numericId}`;
}

export function normalizeMetadata(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    tag: normalizeWhitespace(item?.Tag) || null,
    name: normalizeWhitespace(item?.name) || null,
    url: resolveFcaUrl(item?.link),
    originalLink: normalizeWhitespace(item?.link) || null,
  }));
}

export function normalizeProvision(rawProvision, context) {
  const numericId = Number(rawProvision?.Id);
  if (!Number.isInteger(numericId)) {
    throw new Error(`Provision has an invalid numeric Id in ${context.rawFile}`);
  }

  const provisionName = normalizeWhitespace(rawProvision.ProvisionName);
  if (!provisionName) {
    throw new Error(`Provision ${numericId} has no ProvisionName in ${context.rawFile}`);
  }

  const html = String(rawProvision.Content ?? "");
  const images = extractImageReferences(html);
  const visibleText = htmlToPlainText(html, { includeImageAlt: false });
  const text = htmlToPlainText(html);
  const contentKind = visibleText
    ? images.length ? "mixed" : "text"
    : images.length ? "image-only" : "placeholder";
  const provisionType = normalizeProvisionType(rawProvision.ProvisionType);
  const sourcebookName = normalizeWhitespace(rawProvision.SourcebookName);
  const links = extractContentLinks(html);
  const chapterUrl = resolveFcaUrl(`/handbook/${context.chapterId}`);
  const recordId = makeRecordId(context.snapshotDate, numericId);

  return {
    schemaVersion: 1,
    id: recordId,
    snapshotId: context.snapshotId,
    snapshotDate: context.snapshotDate,
    jurisdiction: "United Kingdom",
    regulator: "Financial Conduct Authority",
    citation: provisionType.code
      ? `${provisionName} ${provisionType.code}`
      : provisionName,
    provisionName,
    provisionType: provisionType.name,
    provisionTypeCode: provisionType.code,
    provisionTypeOriginal: provisionType.original,
    sourcebook: sourcebookCodeFromName(sourcebookName),
    sourcebookName: sourcebookName || null,
    module: normalizeWhitespace(rawProvision.BlockName) || null,
    chapter: normalizeWhitespace(rawProvision.ChapterName) || null,
    section: normalizeWhitespace(rawProvision.SectionName) || null,
    subsection: normalizeWhitespace(rawProvision.SubSectionName) || null,
    hierarchy: normalizeWhitespace(rawProvision.HandbookTreeHierarchy) || null,
    html,
    text,
    dates: {
      provisionDate: normalizeWhitespace(rawProvision.ProvisionDate) || null,
      timelineStartDate: normalizeWhitespace(rawProvision.TimeLine) || null,
      snapshotDate: context.snapshotDate,
    },
    source: {
      chapterId: context.chapterId,
      chapterUrl,
      rawFile: context.rawFile,
      downloadedAt: context.downloadedAt ?? null,
    },
    fcaIdentifiers: {
      numericId,
      provisionId: normalizeWhitespace(rawProvision.ProvisionId) || null,
    },
    links,
    crossReferences: links.filter((link) => link.kind === "handbook"),
    glossaryReferences: links.filter((link) => link.kind === "glossary"),
    images,
    metadata: normalizeMetadata(rawProvision.metaData),
    neighbours: {
      previousId: null,
      nextId: null,
    },
    content: {
      htmlSha256: crypto.createHash("sha256").update(html).digest("hex"),
      textSha256: crypto.createHash("sha256").update(text).digest("hex"),
      htmlCharacters: html.length,
      textCharacters: text.length,
      containsTable: /<table\b/i.test(html),
      containsImage: images.length > 0,
      kind: contentKind,
    },
  };
}

async function replaceGeneratedFile(tempPath, finalPath) {
  try {
    await fsp.access(finalPath);
    const backupPath = `${finalPath}.previous-${Date.now()}`;
    await fsp.rename(finalPath, backupPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await fsp.rename(tempPath, finalPath);
}

const increment = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const sortedCounts = (map) =>
  Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));

export async function normalizeHandbook({ rawRoot, outputDir, snapshotDate, snapshotId }) {
  const chapterDir = path.join(rawRoot, "chapters");
  const files = (await fsp.readdir(chapterDir))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (!files.length) throw new Error(`No chapter JSON files found in ${chapterDir}`);

  await fsp.mkdir(outputDir, { recursive: true });
  const provisionsPath = path.join(outputDir, "provisions.ndjson");
  const tempProvisionsPath = `${provisionsPath}.tmp-${process.pid}`;
  const output = fs.createWriteStream(tempProvisionsPath, { encoding: "utf8" });
  const outputHash = crypto.createHash("sha256");

  const recordIds = new Set();
  const numericIds = new Set();
  const fcaProvisionIds = new Map();
  const provisionNames = new Map();
  const sourcebookCounts = new Map();
  const typeCounts = new Map();
  const notFound = [];
  const emptyText = [];
  const largeRecords = [];
  let provisionCount = 0;
  let metadataRecordCount = 0;
  let crossReferenceCount = 0;
  let glossaryReferenceCount = 0;
  let totalTextCharacters = 0;
  let tableRecordCount = 0;
  let imageOnlyRecordCount = 0;
  let placeholderRecordCount = 0;

  try {
    for (const fileName of files) {
      const absoluteFile = path.join(chapterDir, fileName);
      const envelope = JSON.parse(await fsp.readFile(absoluteFile, "utf8"));
      const status = Number(envelope?.response?.status);
      const chapterId = normalizeWhitespace(envelope?.request?.chapter_id);
      const relativeRawFile = path.posix.join("chapters", fileName);

      if (status === 404) {
        notFound.push({
          chapterId: chapterId || null,
          rawFile: relativeRawFile,
          detail: normalizeWhitespace(envelope?.response?.body?.detail) || null,
        });
        continue;
      }
      if (status !== 200) {
        throw new Error(`Unexpected status ${status} in ${relativeRawFile}`);
      }

      const provisions = envelope?.response?.body?.provision;
      if (!Array.isArray(provisions)) {
        throw new Error(`Missing provision array in ${relativeRawFile}`);
      }

      const chapterRecords = provisions.map((rawProvision) =>
        normalizeProvision(rawProvision, {
          snapshotDate,
          snapshotId,
          chapterId,
          rawFile: relativeRawFile,
          downloadedAt: envelope.downloadedAt,
        }),
      );

      for (let index = 0; index < chapterRecords.length; index += 1) {
        chapterRecords[index].neighbours.previousId = chapterRecords[index - 1]?.id ?? null;
        chapterRecords[index].neighbours.nextId = chapterRecords[index + 1]?.id ?? null;
      }

      for (const record of chapterRecords) {
        if (recordIds.has(record.id)) throw new Error(`Duplicate record id: ${record.id}`);
        recordIds.add(record.id);
        numericIds.add(record.fcaIdentifiers.numericId);

        const fcaProvisionId = record.fcaIdentifiers.provisionId;
        if (fcaProvisionId) {
          const occurrences = fcaProvisionIds.get(fcaProvisionId) ?? [];
          occurrences.push({ id: record.id, citation: record.citation });
          fcaProvisionIds.set(fcaProvisionId, occurrences);
        }
        const nameOccurrences = provisionNames.get(record.provisionName) ?? [];
        nameOccurrences.push(record.id);
        provisionNames.set(record.provisionName, nameOccurrences);

        increment(sourcebookCounts, record.sourcebook ?? "UNKNOWN");
        increment(typeCounts, record.provisionType);
        if (record.metadata.length) metadataRecordCount += 1;
        crossReferenceCount += record.crossReferences.length;
        glossaryReferenceCount += record.glossaryReferences.length;
        totalTextCharacters += record.content.textCharacters;
        if (record.content.containsTable) tableRecordCount += 1;
        if (record.content.kind === "image-only") imageOnlyRecordCount += 1;
        if (record.content.kind === "placeholder") placeholderRecordCount += 1;
        if (!record.text) emptyText.push({ id: record.id, citation: record.citation });
        if (record.content.textCharacters >= 20_000) {
          largeRecords.push({
            id: record.id,
            citation: record.citation,
            textCharacters: record.content.textCharacters,
            htmlCharacters: record.content.htmlCharacters,
            containsTable: record.content.containsTable,
          });
        }

        const line = `${JSON.stringify(record)}\n`;
        output.write(line);
        outputHash.update(line);
        provisionCount += 1;
      }
    }
  } catch (error) {
    output.destroy();
    await fsp.rm(tempProvisionsPath, { force: true });
    throw error;
  }

  await new Promise((resolve, reject) => {
    output.on("error", reject);
    output.end(resolve);
  });

  if (provisionCount !== recordIds.size || provisionCount !== numericIds.size) {
    await fsp.rm(tempProvisionsPath, { force: true });
    throw new Error("Normalized record identifiers are not unique");
  }

  const duplicateFcaProvisionIds = [...fcaProvisionIds.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([provisionId, occurrences]) => ({ provisionId, occurrences }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length);
  const duplicateProvisionNames = [...provisionNames.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([provisionName, ids]) => ({ provisionName, ids }))
    .sort((a, b) => b.ids.length - a.ids.length);
  largeRecords.sort((a, b) => b.textCharacters - a.textCharacters);

  await replaceGeneratedFile(tempProvisionsPath, provisionsPath);
  const fileStat = await fsp.stat(provisionsPath);
  const provisionsSha256 = outputHash.digest("hex");
  const rawManifestPath = path.join(rawRoot, "download-manifest.json");
  let rawManifestSha256 = null;
  try {
    rawManifestSha256 = crypto
      .createHash("sha256")
      .update(await fsp.readFile(rawManifestPath))
      .digest("hex");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const createdAt = new Date().toISOString();
  const manifest = {
    schemaVersion: 1,
    snapshotId,
    snapshotDate,
    createdAt,
    source: {
      name: "FCA Handbook API",
      rawRoot,
      rawManifestSha256,
    },
    files: {
      provisions: {
        path: "provisions.ndjson",
        sha256: provisionsSha256,
        bytes: fileStat.size,
      },
      report: { path: "normalization-report.json" },
    },
    counts: {
      rawChapterResponses: files.length,
      successfulChapters: files.length - notFound.length,
      notFoundChapters: notFound.length,
      provisions: provisionCount,
      uniqueRecordIds: recordIds.size,
      sourcebooks: sourcebookCounts.size,
    },
  };

  const report = {
    schemaVersion: 1,
    snapshotId,
    snapshotDate,
    createdAt,
    validation: {
      passed:
        recordIds.size === provisionCount &&
        numericIds.size === provisionCount &&
        emptyText.length === placeholderRecordCount,
      uniqueRecordIds: recordIds.size === provisionCount,
      uniqueNumericFcaIds: numericIds.size === provisionCount,
      nonEmptyText: provisionCount - emptyText.length,
      emptyText: emptyText.length,
    },
    counts: {
      provisions: provisionCount,
      metadataRecords: metadataRecordCount,
      tableRecords: tableRecordCount,
      imageOnlyRecords: imageOnlyRecordCount,
      placeholderRecords: placeholderRecordCount,
      crossReferences: crossReferenceCount,
      glossaryReferences: glossaryReferenceCount,
      totalTextCharacters,
      largeRecordsAtLeast20000Characters: largeRecords.length,
      duplicateFcaProvisionIdGroups: duplicateFcaProvisionIds.length,
      duplicateProvisionNameGroups: duplicateProvisionNames.length,
    },
    sourcebooks: sortedCounts(sourcebookCounts),
    provisionTypes: sortedCounts(typeCounts),
    notFoundChapters: notFound,
    anomalies: {
      emptyText,
      duplicateFcaProvisionIds,
      duplicateProvisionNames,
      largeRecords,
    },
  };

  await fsp.writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  await fsp.writeFile(
    path.join(outputDir, "normalization-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  return { manifest, report, provisionsPath };
}

