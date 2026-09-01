import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "../..");
const defaultSnapshot = path.join(
  appRoot,
  "corpus",
  "snapshots",
  "fca-handbook-2026-08-30",
  "provisions.ndjson",
);

const targetNames = new Set([
  "COBS 4.2.5",
  "COBS 4 Annex 1R",
  "SUP 16 Annex 21",
  "PERG 16.2",
  "PERG 4.18",
  "APER App 1.1.1",
]);

const count = ($, selector) => $(selector).length;

function inspect(record) {
  const $ = load(record.html || "", {}, false);
  const rows = $("tr").toArray();
  const rowCellCounts = rows.map((row) => $(row).find("th, td").length);
  const tableSummaries = $("table")
    .toArray()
    .map((table, tableIndex) => {
      const tableRows = $(table).find("tr").toArray();
      return {
        tableIndex: tableIndex + 1,
        rows: tableRows.length,
        cells: $(table).find("th, td").length,
        headerCells: $(table).find("th").length,
        colspanCells: $(table).find("[colspan]").length,
        rowspanCells: $(table).find("[rowspan]").length,
        firstRows: tableRows.slice(0, 4).map((row) =>
          $(row)
            .find("th, td")
            .toArray()
            .map((cell) => $(cell).text().replace(/\s+/g, " ").trim().slice(0, 180)),
        ),
      };
    });
  const headingTexts = $("h1, h2, h3, h4, h5, h6")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const strongLeadParagraphs = $("p")
    .toArray()
    .filter((node) => $(node).children().first().is("strong, b"))
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    citation: record.citation,
    provisionName: record.provisionName,
    provisionType: record.provisionType,
    contentKind: record.content.kind,
    textCharacters: record.content.textCharacters,
    htmlCharacters: record.content.htmlCharacters,
    structure: {
      headings: headingTexts.length,
      headingExamples: headingTexts.slice(0, 5),
      strongLeadParagraphs: strongLeadParagraphs.length,
      strongLeadExamples: strongLeadParagraphs.slice(0, 8),
      paragraphs: count($, "p"),
      orderedLists: count($, "ol"),
      unorderedLists: count($, "ul"),
      listItems: count($, "li"),
      tables: count($, "table"),
      tableRows: rows.length,
      tableCells: count($, "th, td"),
      maximumCellsInRow: rowCellCounts.length ? Math.max(...rowCellCounts) : 0,
      colspanCells: count($, "[colspan]"),
      rowspanCells: count($, "[rowspan]"),
      images: record.images.length,
      links: record.links.length,
    },
    tableSummaries,
    source: record.source,
    firstHtml: record.html.slice(0, 700),
    firstText: record.text.slice(0, 700),
    lastText: record.text.slice(-500),
    images: record.images,
  };
}

const inputPath = path.resolve(process.argv[2] || defaultSnapshot);
const stream = fs.createReadStream(inputPath, { encoding: "utf8" });
const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
const found = new Map();
const lengths = [];
const bins = [
  { label: "0-1,999", minimum: 0, maximum: 1_999, records: 0, tables: 0 },
  { label: "2,000-3,999", minimum: 2_000, maximum: 3_999, records: 0, tables: 0 },
  { label: "4,000-7,999", minimum: 4_000, maximum: 7_999, records: 0, tables: 0 },
  { label: "8,000-11,999", minimum: 8_000, maximum: 11_999, records: 0, tables: 0 },
  { label: "12,000-19,999", minimum: 12_000, maximum: 19_999, records: 0, tables: 0 },
  { label: "20,000-49,999", minimum: 20_000, maximum: 49_999, records: 0, tables: 0 },
  { label: "50,000+", minimum: 50_000, maximum: Infinity, records: 0, tables: 0 },
];
const kinds = new Map();

for await (const line of lines) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  const length = record.content.textCharacters;
  lengths.push(length);
  const bin = bins.find((candidate) => length >= candidate.minimum && length <= candidate.maximum);
  bin.records += 1;
  if (record.content.containsTable) bin.tables += 1;
  kinds.set(record.content.kind, (kinds.get(record.content.kind) || 0) + 1);
  if (targetNames.has(record.provisionName)) {
    found.set(record.provisionName, inspect(record));
  }
}

const missing = [...targetNames].filter((name) => !found.has(name));
if (missing.length) {
  throw new Error(`Missing normalized sample records: ${missing.join(", ")}`);
}

lengths.sort((a, b) => a - b);
const percentile = (value) => lengths[Math.ceil((value / 100) * lengths.length) - 1];
console.log(JSON.stringify({
  corpusSummary: {
    records: lengths.length,
    contentKinds: Object.fromEntries([...kinds.entries()].sort()),
    textCharacterPercentiles: {
      p50: percentile(50),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      maximum: lengths.at(-1),
    },
    lengthBins: bins.map(({ label, records, tables }) => ({ label, records, tables })),
  },
  samples: [...found.values()],
}, null, 2));

