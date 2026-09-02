import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChunksForProvision } from "../scripts/fca/chunk-handbook-lib.mjs";

function record(overrides = {}) {
  const text = overrides.text ?? "A firm must ensure that a communication is fair, clear and not misleading.";
  return {
    id: "fca-handbook:2026-08-30:1",
    snapshotId: "fca-handbook-2026-08-30",
    snapshotDate: "2026-08-30",
    jurisdiction: "United Kingdom",
    regulator: "Financial Conduct Authority",
    citation: "COBS 4.2.1 R",
    provisionName: "COBS 4.2.1",
    provisionType: "rule",
    provisionTypeCode: "R",
    sourcebook: "COBS",
    sourcebookName: "COBS Conduct of Business Sourcebook",
    module: "Business Standards",
    chapter: "COBS 4",
    section: "COBS 4.2",
    subsection: "Fair, clear and not misleading",
    hierarchy: "Business Standards | COBS | COBS 4 | COBS 4.2",
    dates: { snapshotDate: "2026-08-30" },
    source: { rawFile: "chapters/cobs4.json", chapterUrl: "https://handbook.fca.org.uk/handbook/cobs4" },
    fcaIdentifiers: { numericId: 1, provisionId: "p1" },
    html: overrides.html ?? `<div><p>${text}</p></div>`,
    text,
    images: overrides.images ?? [],
    content: {
      kind: overrides.kind ?? "text",
      textCharacters: text.length,
      htmlSha256: "a".repeat(64),
      textSha256: "b".repeat(64),
      containsImage: overrides.kind === "mixed" || overrides.kind === "image-only",
    },
  };
}

test("keeps an ordinary provision as one linked retrieval unit", () => {
  const { chunks } = buildChunksForProvision(record());
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].retrieval.strategy, "whole-provision");
  assert.equal(chunks[0].parentId, "fca-handbook:2026-08-30:1");
  assert.equal(chunks[0].position.previousChunkId, null);
  assert.equal(chunks[0].position.nextChunkId, null);
  assert.match(chunks[0].searchText, /^COBS 4\.2\.1 R/);
});

test("splits a large question-and-answer provision at question boundaries", () => {
  const answer = "This is a regulatory explanation with relevant qualifications. ".repeat(75);
  const html = `<div><p><strong>Question 1.1: First question?</strong></p><p>${answer}</p><p><strong>Question 1.2: Second question?</strong></p><p>${answer}</p></div>`;
  const text = `Question 1.1: First question? ${answer} Question 1.2: Second question? ${answer}`;
  const { chunks } = buildChunksForProvision(record({ html, text }), { reviewCharacters: 1_000, targetCharacters: 700 });
  assert.ok(chunks.length > 2);
  assert.ok(chunks.some((chunk) => chunk.retrieval.structuralPath.some((part) => part.startsWith("Question 1.1"))));
  assert.ok(chunks.some((chunk) => chunk.retrieval.structuralPath.some((part) => part.startsWith("Question 1.2"))));
  for (let index = 0; index < chunks.length; index += 1) {
    assert.equal(chunks[index].position.index, index + 1);
    assert.equal(chunks[index].position.nextChunkId, chunks[index + 1]?.id ?? null);
  }
});

test("splits a table by coherent row groups and repeats its header", () => {
  const rows = Array.from({ length: 8 }, (_, index) => `<tr><td>Field ${index + 1}</td><td>${"Detailed note. ".repeat(20)}</td></tr>`).join("");
  const html = `<table><tr><th>Data reporting field</th><th>Notes</th></tr>${rows}</table>`;
  const text = "Data reporting field Notes " + "Detailed note. ".repeat(160);
  const { chunks } = buildChunksForProvision(record({ html, text }), { reviewCharacters: 600, targetCharacters: 500 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.retrieval.strategy === "structural-table-row-group"));
  assert.ok(chunks.every((chunk) => chunk.text.startsWith("Table header: Data reporting field | Notes")));
  assert.deepEqual(chunks[0].table.sourceRows, [2]);
});

test("keeps a numbered table section title with its following content", () => {
  const details = "Risk wording and qualification. ".repeat(90);
  const html = `<table><tr><td>1</td><td>Risk summary for a high-risk investment</td></tr><tr><td></td><td>${details}</td></tr><tr><td>2</td><td>Risk summary for another investment</td></tr><tr><td></td><td>${details}</td></tr></table>`;
  const text = `1 Risk summary for a high-risk investment ${details} 2 Risk summary for another investment ${details}`;
  const { chunks } = buildChunksForProvision(record({ html, text }), { reviewCharacters: 1_500, targetCharacters: 1_000 });
  assert.ok(chunks.length >= 4);
  assert.equal(chunks[0].table.sourceRows[0], 1);
  assert.ok(chunks[0].table.sourceRows.includes(2));
  assert.match(chunks[0].text, /Section: 1 \| Risk summary for a high-risk investment/);
  const secondSection = chunks.find((chunk) => chunk.retrieval.structuralPath.some((part) => part.startsWith("2 | Risk summary")));
  assert.ok(secondSection);
  assert.ok(secondSection.table.sourceRows.includes(4));
});

test("expands a rowspan label into a chunk that starts on a continuation row", () => {
  const first = "First-row qualification. ".repeat(12);
  const second = "Continuation-row qualification. ".repeat(12);
  const html = `<table><tr><th>Category</th><th>Requirement</th></tr><tr><td rowspan="2">Retail investments</td><td>${first}</td></tr><tr><td>${second}</td></tr></table>`;
  const text = `Category Requirement Retail investments ${first} ${second}`;
  const { chunks } = buildChunksForProvision(record({ html, text }), { reviewCharacters: 500, targetCharacters: 350 });
  const continuation = chunks.find((chunk) => chunk.table.sourceRows.length === 1 && chunk.table.sourceRows[0] === 3);
  assert.ok(continuation, "expected a child beginning on the rowspan continuation row");
  assert.match(continuation.text, /Retail investments \| Continuation-row qualification/);
  assert.deepEqual(continuation.table.inheritedRowspanLabels, [{
    column: 1,
    originRow: 2,
    text: "Retail investments",
  }]);
});

test("structurally reviews a complex provision below the 8,000-character trigger", () => {
  const body = "A qualified regulatory explanation. ".repeat(40);
  const html = `<table><tr><td>${body}</td></tr></table><table><tr><td>${body}</td></tr></table>`;
  const text = `${body} ${body}`;
  const result = buildChunksForProvision(record({ html, text }), { reviewCharacters: 8_000, targetCharacters: 1_000 });
  assert.equal(result.structuralReview, true);
  assert.ok(result.chunks.every((chunk) => chunk.retrieval.strategy === "structural-table-row-group"));
});

test("excludes placeholders and limits image-only records to discovery", () => {
  assert.deepEqual(buildChunksForProvision(record({ text: "", html: "<p></p>", kind: "placeholder" })).chunks, []);
  const image = buildChunksForProvision(record({
    text: "[Image: decision flowchart]",
    html: '<img alt="decision flowchart" src="flow.png">',
    kind: "image-only",
    images: [{ alt: "decision flowchart", url: "https://example.test/flow.png" }],
  })).chunks[0];
  assert.equal(image.retrieval.eligibility, "discovery-only");
  assert.equal(image.retrieval.requiresAssetReview, true);
});

test("flags mixed provisions while keeping verified text searchable", () => {
  const mixed = buildChunksForProvision(record({ kind: "mixed" })).chunks[0];
  assert.equal(mixed.retrieval.eligibility, "substantive");
  assert.equal(mixed.retrieval.requiresAssetReview, true);
});

