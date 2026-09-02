# FCA Handbook chunk preview

**Snapshot:** `fca-handbook-2026-08-30`  
**Generated:** 31 August 2026  
**Status:** Local derived preview; not indexed or embedded

## Outcome

The deterministic chunk-preview pass completed over all 24,951 canonical FCA provisions. It produced 35,635 searchable records while leaving the canonical `provisions.ndjson` byte-for-byte unchanged. The preview has no unresolved warnings and no child over the 8,000-character review ceiling.

The generated files are deliberately ignored by Git:

- `corpus/chunks/fca-handbook-2026-08-30/chunks.preview.ndjson`
- `corpus/chunks/fca-handbook-2026-08-30/manifest.json`
- `corpus/chunks/fca-handbook-2026-08-30/chunking-report.json`

The chunk manifest records the canonical input SHA-256 as `3550459c39889180351d37168a710da62da53c0ba7603757fced65261721d274`, which matches the normalization manifest. The canonical snapshot was read, not rewritten.

## Results

| Measure | Result |
|---|---:|
| Canonical parents | 24,951 |
| Parents represented in retrieval | 24,941 |
| Generated chunks | 35,635 |
| Whole-provision chunks | 24,724 |
| Structurally reviewed parents | 210 |
| Parents producing multiple children | 209 |
| Narrative children | 907 |
| Table/row-group children | 9,997 |
| Image discovery records | 7 |
| Excluded placeholders | 10 |
| Warnings | 0 |
| Chunks over 8,000 characters | 0 |

Overall chunk text has a median of 359 characters, a 99th percentile of 4,752 and a maximum of 7,985. Structural children have a 99th percentile of 5,755 and a maximum of 7,516. The low median is expected because the majority of FCA provisions—and many individual schedule rows—are already short, legally meaningful units. We do not pad or merge unrelated rules merely to approach a token target.

## Strategies implemented

### Whole provision

An ordinary provision remains one chunk. Its FCA-authored boundary is usually more meaningful than a generic token window.

### Narrative structure

Large narrative provisions split at explicit questions, headings, bold/numbered lead paragraphs and then paragraph boundaries. A single unusually long paragraph is split at sentences; a word-boundary fallback exists only for a sentence that itself exceeds the ceiling and is reported as a warning.

`PERG 16.2 G` produces 74 question-oriented children.

### Table structure

Tables split by table, section/title row and coherent row group. Column headers and the current section label repeat in every child so a retrieved value does not lose its meaning. Long individual rows split inside their longest cell while retaining the other cell labels.

The parser also expands HTML `rowspan` values into an explicit logical grid before grouping. A chunk beginning on a continuation row therefore repeats the category or rule label inherited visually from an earlier row. The chunk metadata records each inherited label, its column and its originating source row. This is material for 43 large table records, including `SYSC 23 Annex 1`, `TC App 4.1.1D` and `FEES 5 Annex 3R`.

`COBS 4 Annex 1R R` now produces ten children: one preamble and one complete child for each of its nine numbered risk summaries. The numbered title row is kept with its following risk-summary row. `SUP 16 Annex 21 R` produces 133 children across its 11 tables.

### Images and placeholders

The seven image-only provisions produce discovery-only records and cannot support a substantive text finding. Mixed text/image records keep their verified text searchable and carry `requiresAssetReview: true`. The ten empty placeholders remain in the canonical snapshot but produce no retrieval chunk.

## Chunk contract

Every chunk contains:

- a stable chunk ID and canonical `parentId`;
- snapshot, citation, hierarchy, dates and FCA identifiers;
- source URL and raw-file provenance;
- parent HTML/text hashes;
- strategy and structural path;
- position plus previous/next child IDs;
- original child text and context-prefixed `searchText`;
- substantive or discovery-only retrieval eligibility;
- table index, repeated header and source row numbers when applicable.

This separates three concerns cleanly: the canonical record remains the auditable source, the child text is the search unit, and `searchText` repeats only the context required for retrieval.

## Reproduce and validate

```powershell
npm run corpus:chunk-preview
npm run test:chunking
```

The next gate is retrieval inspection, not embeddings. A lexical preview should test exact citations, paraphrased marketing claims and expected FinProm rules against these chunks. Embedding-model and hybrid-ranking choices should be made only after the chunk boundaries retrieve sensible evidence.

