# Zango FinProm review copilot

A focused work sample for an FCA financial-promotion review workflow. It is built for the compliance reviewer, not the copywriter: submissions arrive as review tickets, the AI prepares grounded findings, and the reviewer retains the decision.

## What works

- Four realistic review tickets plus arbitrary free-text submissions.
- Thirty-four promotion-relevant FCA product/service families; UK retail context; website, social and email channels.
- Staged analysis: context validation, structured claim extraction, hybrid retrieval, evidence-grounded evaluation, deterministic validation and an auditable recommendation.
- Outcome-specific reviewer guidance for `Recommended for approval`, `Revise` and `Block`.
- Exact FCA links and stored quotations, highlighted promotional phrases, disclosure and substantiation status, remediation and safe rewrites.
- Fail-closed handling when the model, retrieval or validation layer cannot support a grounded conclusion.
- A provisional ten-case/15-group retrieval benchmark plus a three-case live end-to-end smoke gate. The live gate refuses fixture mode and the small rule pack.

## AI workflow

The review workflow uses OpenAI through Vercel AI Gateway for extraction/evaluation and an identical OpenAI embedding model for the stored corpus and each live query:

1. GPT-5.6 Luna extracts claims, context signals and regulatory search concepts into a Zod-validated structure.
2. A ticket-context router selects product-specific and targeted shared FCA lanes. Each claim gets its own hybrid search; structured claim type adds auditable regulatory vocabulary, while exact governing-standard queries remain lexical.
3. A citation-deduplicated evidence pack of at most 12 provisions is evaluated by GPT-5.6 Terra into a second structured result.
4. The application verifies promotional quotations and rule identifiers, inserts exact stored FCA quotations, derives the overall recommendation and writes the audit trace.

Model identifiers are configurable in the environment. The deterministic local fixture is only a development and test fallback; hosted analysis fails closed if the real AI path is unavailable.

## Regulatory corpus state

The authenticated FCA API corpus is downloaded locally: 24,951 canonical provisions were normalized into 35,635 structural chunks. A checksum-bound SQLite index contains all chunks, with 35,628 substantive chunks in FTS5/BM25 search and a complete 1,536-dimensional `text-embedding-3-small` vector set. It preserves FCA hierarchy, exact text, effective date, source URL and outbound Handbook references.

The local demo can use this index with `FCA_RETRIEVAL_MODE=auto` or `full`. The hosted preview uses a scalar-quantized deployment derivative containing the same 35,628 embeddings and an identical lexical index. It is held as 12 private Vercel Blob parts, reconstructed and manifest-validated in temporary function storage, and never shipped to the browser:

`FCA API -> immutable private snapshot -> private full-text + vector index -> lean review function`

That preserves full coverage and source versions without exposing the source corpus. A cold function must first fetch the 182.5 MB index; the warm-instance cache avoids repeating that transfer. Moving the same contract to a continuously available database/vector service is the production latency path.

## Run and verify

```powershell
npm install
npm run check
npm run dev
```

Vercel review calls prefer Gateway/OIDC. Local review calls use Gateway credentials when present and otherwise use the server-side `OPENAI_API_KEY` directly; the deterministic fixture remains available only when neither exists. The one-time corpus embedding command also uses `OPENAI_API_KEY`, is resumable and records model, dimensions, corpus checksums and run ID in SQLite. No secret is committed.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the request path, [END_TO_END_SMOKE_TEST.md](docs/END_TO_END_SMOKE_TEST.md) for the live gate and trace contract, and [design-qa.md](design-qa.md) for the visual verification record.

The complete corpus workflow and exact commands are in [corpus/README.md](corpus/README.md). The eight-rule pack remains only as a deterministic local-test fallback; Vercel forces full-corpus mode and fails closed if the private artifact is unavailable.

