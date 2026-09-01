import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractContentLinks,
  extractImageReferences,
  htmlToPlainText,
  normalizeProvision,
} from "../scripts/fca/normalize-handbook-lib.mjs";

const sampleHtml = `
  <div class="section-content">
    <p>A firm must be fair &amp; clear. See
      <a href="/handbook/cobs4">COBS 4</a> and
      <a href="/glossary/G430">firm</a>.
    </p>
    <ul><li>First item</li><li>Second item</li></ul>
    <table><tr><th>Claim</th><th>Requirement</th></tr><tr><td>Return</td><td>Balanced</td></tr></table>
  </div>
`;

test("converts FCA HTML into readable deterministic text", () => {
  const text = htmlToPlainText(sampleHtml);
  assert.match(text, /A firm must be fair & clear/);
  assert.match(text, /• First item/);
  assert.match(text, /Claim \| Requirement/);
  assert.doesNotMatch(text, /<[^>]+>/);
});

test("classifies and resolves FCA content links", () => {
  const links = extractContentLinks(sampleHtml);
  assert.deepEqual(
    links.map(({ kind, url }) => ({ kind, url })),
    [
      { kind: "handbook", url: "https://handbook.fca.org.uk/handbook/cobs4" },
      { kind: "glossary", url: "https://handbook.fca.org.uk/glossary/G430" },
    ],
  );
});

test("preserves image-only FCA provisions as searchable references", () => {
  const html = '<div class="graphic"><img alt="PERG decision flowchart" src="/files/graphic/perg.png"></div>';
  assert.equal(htmlToPlainText(html), "[Image: PERG decision flowchart]");
  assert.deepEqual(extractImageReferences(html), [
    {
      alt: "PERG decision flowchart",
      url: "https://handbook.fca.org.uk/files/graphic/perg.png",
    },
  ]);
});

test("maps an FCA API provision into the canonical snapshot schema", () => {
  const record = normalizeProvision(
    {
      Id: 12345,
      ProvisionName: "COBS 4.2.1",
      ProvisionType: "Rules",
      ProvisionId: "p123",
      Content: sampleHtml,
      ProvisionDate: "2026-08-30",
      SubSectionName: "Fair, clear and not misleading",
      SectionName: "COBS 4.2",
      ChapterName: "COBS 4",
      SourcebookName: "COBS Conduct of Business Sourcebook",
      BlockName: "Business Standards",
      HandbookTreeHierarchy: "Business Standards | COBS | COBS 4 | COBS 4.2",
      TimeLine: "2026-08-30",
      metaData: [
        { Tag: "Policy Statements", name: "Example", link: "/files/example.pdf" },
      ],
    },
    {
      snapshotDate: "2026-08-30",
      snapshotId: "fca-handbook-2026-08-30",
      chapterId: "cobs4",
      rawFile: "chapters/0001__cobs4.json",
      downloadedAt: "2026-08-30T12:00:00.000Z",
    },
  );

  assert.equal(record.id, "fca-handbook:2026-08-30:12345");
  assert.equal(record.citation, "COBS 4.2.1 R");
  assert.equal(record.sourcebook, "COBS");
  assert.equal(record.provisionType, "rule");
  assert.equal(record.fcaIdentifiers.provisionId, "p123");
  assert.equal(record.source.chapterUrl, "https://handbook.fca.org.uk/handbook/cobs4");
  assert.equal(record.metadata[0].url, "https://handbook.fca.org.uk/files/example.pdf");
  assert.match(record.content.textSha256, /^[a-f0-9]{64}$/);
});

