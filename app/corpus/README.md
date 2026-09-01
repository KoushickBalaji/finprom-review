# FCA corpus workspace

This directory is the local workspace for authenticated FCA Handbook ingestion. Raw API responses, normalized snapshots and generated indexes are intentionally excluded from Git. The full local retrieval adapter is connected; the small pack in `lib/regulatory-pack.js` remains a deterministic fallback for tests and deployments that do not yet have the private index.

## Storage roles

- `raw/`: immutable API transport responses.
- `snapshots/`: canonical dated NDJSON records plus provenance and validation.
- `chunks/`: disposable structural chunk previews derived from a canonical snapshot.
- `index/`: disposable SQLite/vector indexes that can be rebuilt from a snapshot.

## Canonical normalized record

Each line in a snapshot's `provisions.ndjson` is one canonical provision. NDJSON is the portable source for downstream indexes; SQLite and future vector indexes are derived and rebuildable.

```json
{
  "schemaVersion": 1,
  "id": "fca-handbook:2026-08-30:12345",
  "snapshotId": "fca-handbook-2026-08-30",
  "snapshotDate": "2026-08-30",
  "citation": "COBS 4.2.1 R",
  "sourcebook": "COBS",
  "sourcebookName": "COBS Conduct of Business Sourcebook",
  "module": "Business Standards",
  "chapter": "COBS 4",
  "section": "COBS 4.2",
  "subsection": "Fair, clear and not misleading",
  "provisionType": "rule",
  "provisionTypeCode": "R",
  "html": "<div>...</div>",
  "text": "A firm must ensure…",
  "dates": { "provisionDate": "2026-08-30", "snapshotDate": "2026-08-30" },
  "source": { "chapterId": "cobs4", "rawFile": "chapters/0123__cobs4.json" },
  "fcaIdentifiers": { "numericId": 12345, "provisionId": "p48502" },
  "crossReferences": [],
  "glossaryReferences": [],
  "metadata": [],
  "neighbours": { "previousId": null, "nextId": null },
  "content": { "htmlSha256": "...", "textSha256": "...", "containsTable": false }
}
```

The normalizer maps authenticated FCA chapter responses into this contract without an LLM. It preserves original HTML, produces deterministic plain text, resolves links, records provenance and validates unique internal identifiers. Indexing remains downstream so the search layer does not depend on the FCA transport shape.

## Commands

```powershell
npm run corpus:seed
npm run corpus:normalize
npm run corpus:inspect-normalized
npm run corpus:chunk-preview
npm run corpus:index
npm run corpus:inspect -- "guaranteed protected secure"
npm run corpus:index-full
npm run corpus:inspect-full
npm run corpus:embed-full
npm run corpus:evaluate-retrieval
```

`corpus:normalize` reads `raw/2026-08-30`, creates `snapshots/fca-handbook-2026-08-30/provisions.ndjson`, and writes a manifest and validation report. `corpus:chunk-preview` creates the structural derivative without rewriting that canonical snapshot. `corpus:index` continues to build the eight-rule test fixture; `corpus:index-full` builds the real chunk-level SQLite/FTS5 index and verifies both canonical and chunk checksums before publishing it atomically.

`corpus:embed-full` adds compact Float32 vectors to that SQLite file. It is resumable, uses batches of 64 by default, retries transient failures, and records the provider path, OpenAI model, dimensions, snapshot, corpus checksum, run ID, usage and progress. It accepts either `OPENAI_API_KEY` for direct OpenAI access or Vercel AI Gateway authentication through `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN`; do not put any credential in source control. The current 23.4 million search characters are estimated at 5.2–6.7 million embedding tokens.

The resulting local file is `index/fca-handbook-2026-08-30.sqlite`. It is derived and rebuildable, so it stays Git-ignored. Runtime retrieval uses the exact same applicability scope for FTS and vectors, preserves the strongest citation-deduplicated lexical anchors before weighted rank fusion, and follows at most one bounded outgoing reference hop.

`corpus:evaluate-retrieval` embeds the ten frozen query cases with the same model and dimensions recorded in the completed index, scores 15 claim-level evidence groups, compares lexical, semantic and hybrid modes, checks route leakage, and writes a rebuildable report under `evals/`. Labels are provisional desk-review labels for this demo; production-quality validation requires an FCA financial-promotions SME. The evaluation design, boundary and latest measured results are recorded in `docs/RETRIEVAL_EVALUATION.md`.

