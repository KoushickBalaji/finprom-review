# FCA normalized corpus inspection

**Snapshot:** `fca-handbook-2026-08-30`  
**Inspected:** 31 August 2026  
**Purpose:** Check whether normalization preserved enough FCA structure to support reliable retrieval, then define the chunking policy before implementing it.

## Outcome

The normalization is fit to continue. Ordinary provisions retain their citation, hierarchy, prose, list numbering, links and source provenance. Tables remain available as original HTML as well as readable plain text. Exceptional records are identifiable rather than silently flattened or discarded.

Chunking should now be a **derived indexing step**, not a rewrite of the canonical snapshot. The default retrieval unit will be one FCA provision. Only the small exceptional tail of large or structurally complex records will be split, using FCA document structure rather than blind character windows.

No chunks or embeddings were created during this inspection.

## Corpus shape

| Measure | Result |
|---|---:|
| Canonical provisions | 24,951 |
| Median text length | 392 characters |
| 90th percentile | 1,363 characters |
| 95th percentile | 2,101 characters |
| 99th percentile | 6,115 characters |
| Records over 8,000 characters | 168 (0.67%) |
| Records over 8,000 characters that contain tables | 143 |
| Largest record | 340,661 characters |
| Text records | 24,892 |
| Mixed text/image records | 42 |
| Image-only records | 7 |
| Empty placeholder records | 10 |

The distribution supports a provision-first design: 99% of the Handbook already arrives at a useful regulatory boundary. Applying fixed-size chunking to every record would break many short rules without solving a real problem.

## Representative checks

### 1. Ordinary guidance — `COBS 4.2.5 G`

- 453 text characters, three paragraphs and a two-item ordered list.
- The normalized text retains the operative wording, item numbers and the distinction between the two conditions.
- Both glossary links remain available in the structured `links` collection even though the plain text is clean.
- Decision: keep as one retrieval unit.

### 2. FinProm table — `COBS 4 Annex 1R R`

- 30,392 text characters in one table with 18 rows and 36 cells.
- The table contains nine alternative risk-summary sections. The section number/title row and the following risk-summary row form a natural pair.
- The original HTML preserves the rowspans and all cell boundaries. The plain text is readable, but a single embedding for the entire annex would mix unrelated investment types and weaken retrieval precision.
- Decision: create one child unit per risk-summary section, carrying the annex citation, section title and parent context. If an individual summary is still too large, split at its bold numbered risk headings.

### 3. Very large reporting annex — `SUP 16 Annex 21 R`

- 340,661 text characters across 11 tables, 617 rows and 2,054 cells.
- It has strong table boundaries and repeatable column headers such as `Data reporting field`, `Code` and `Notes`.
- Treating this as one unit is unsuitable; fixed windows would detach values from their column meanings.
- Decision: split first by titled section/table, then by coherent row groups. Repeat the table header and section label in every child unit. A very long row must be split inside its notes cell at paragraph or enumerated-subparagraph boundaries while retaining the row label and column name.

### 4. Long narrative guidance — `PERG 16.2 G`

- 74,833 text characters and 608 paragraphs, with no table.
- The FCA HTML does not use heading tags here, but 74 bold lead paragraphs expose question boundaries such as `Question 2.1` and `Question 2.2`.
- Decision: split by question-and-answer section. Merge unusually short neighbouring sections; split an oversized answer at paragraph or numbered-subparagraph boundaries.

### 5. Image-only material — `PERG 4.18`

- The canonical record correctly retains the FCA image URL and alt identifier.
- The alt value is an asset identifier, not a trustworthy textual rendering of the flowchart.
- Decision: retain it in the snapshot and make it discoverable as `asset review required`, but exclude it from substantive text-only rule evaluation. OCR or a verified manual transcription can be added later as a separately sourced derivative.

### 6. Empty placeholder — `APER App 1.1.1`

- The API supplied an empty paragraph; normalization did not invent content.
- Decision: retain it for snapshot completeness and version comparison, but exclude it from lexical and semantic retrieval.

## Chunking policy for the first index

### Canonical parent record

`provisions.ndjson` remains unchanged and authoritative. Every derived child unit points back to its parent record and inherits:

- snapshot ID and date;
- FCA numeric ID and provision citation;
- sourcebook and full hierarchy;
- provision type;
- source URL and raw-file provenance;
- content hashes and relevant cross-references.

The reviewer-facing citation remains the FCA provision or annex. The child path only explains which part of that source was retrieved.

### Default rule

Keep one provision as one retrieval unit when it is at most 8,000 text characters and has no exceptional structure requiring a split. This covers more than 99% of the corpus and preserves the FCA-authored boundary.

The 8,000-character value is a **review trigger**, not a licence to cut text at character 8,000. It identifies the exceptional 0.67% that needs structural handling.

### Structural splitting rules

Use the first applicable boundary:

1. explicit question, section or titled block;
2. separate table;
3. logical table row or row group, with its header repeated;
4. numbered or bold subheading;
5. paragraph or enumerated subparagraph.

Aim for roughly 2,000–6,000 characters per child and treat 8,000 characters as the normal maximum. Never split mid-sentence, detach a table value from its label, or discard qualifying language merely to meet the target. A coherent unit may exceed the target when preserving legal meaning requires it.

Do not add blind sliding-window overlap. Instead, repeat only the structural context needed to interpret the child—citation, section title, table header and parent path—and store previous/next child IDs. The retrieval layer can expand to adjacent children or the full parent when context is needed. This keeps the evidence pack readable and avoids duplicate near-identical search hits.

### Retrieval eligibility

| Record kind | Lexical/semantic index behaviour |
|---|---|
| Ordinary text provision | Index the full provision |
| Oversized or complex text/table | Index structural children; retain parent for display and expansion |
| Mixed text and image | Index verified text; flag that an image is also present |
| Image-only | Discovery metadata only; do not use as substantive textual evidence |
| Placeholder | Exclude from ordinary retrieval; retain in canonical snapshot |

## Next controlled step

Build a deterministic chunk-preview generator that writes a separate derived NDJSON file. Before creating embeddings, inspect:

- the number and size distribution of child units;
- a sample from each splitting strategy;
- whether every child maps back to exactly one canonical parent;
- whether table headers, citations and qualifying text survive;
- whether the agreed FinProm evaluation cases retrieve the expected source material lexically.

Only after that preview passes should the project choose embedding and hybrid-index parameters.

