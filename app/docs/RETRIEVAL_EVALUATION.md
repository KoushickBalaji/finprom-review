# Full-Handbook retrieval evaluation

## Purpose

This is the measured retrieval gate between the completed FCA corpus index and the evidence-grounded reviewer workflow. Version 2 tests whether a promotion and its submitted product context retrieve evidence for each material claim or disclosure issue identified in the case. It does **not** score the final `Recommended`, `Revise` or `Block` decision; those remain covered by the separate end-to-end review evaluations.

The cases are frozen before retrieval tuning. Labels may be corrected when primary FCA text disproves an applicability assumption, but the correction and its reason must be recorded rather than silently changing a score.

## Label authority and SME boundary

The labels are **provisional engineering desk-review labels**, checked against the dated FCA snapshot and current official FCA Handbook pages. They are suitable for this portfolio demo and for detecting retrieval regressions. They are not an FCA compliance opinion and must not be described as an expert-labelled gold set.

Further improvement requires an FCA financial-promotions subject-matter expert to confirm:

- whether every material issue in each promotion has been identified;
- product, firm, communication and customer assumptions governing applicability;
- acceptable alternative or supporting provisions;
- relevance grades for unjudged results in the top ten; and
- whether the set is representative enough for a production quality claim.

That SME exercise is deliberately outside this demo's scope. The benchmark records this limitation in its machine-readable output.

## Fixed data and model contract

- Snapshot: `fca-handbook-2026-08-30`
- Searchable chunks: 35,628 substantive chunks
- Chunk SHA-256: `21f2d8381e5f6bf6db8e2006cf422ede634077d7c511d838f030599179914a21`
- Canonical SHA-256: `3550459c39889180351d37168a710da62da53c0ba7603757fced65261721d274`
- Embedding run: `emb_6fe886733ffe1849834a`
- Provider: OpenAI direct
- Model: `text-embedding-3-small`
- Dimensions: 1,536

Every mode uses the same product-derived hard scope. The permitted scope contains every principal sourcebook mapped to the selected product plus the targeted shared `PRIN` and `GEN` lanes. It never falls back to the whole Handbook.

## Frozen cases and evidence groups

The ten cases cover investments, consumer credit and mortgages as the three prepared reviewer journeys, plus cryptoasset and structured-deposit route checks. They include exact wording and paraphrases for guarantees, capital risk, credit triggers, representative examples, availability claims, comparisons, risk summaries and protection claims.

The ten cases now contain 15 required evidence groups. Each group represents a distinct claim or disclosure issue and records one or more defensible citations. A case is complete only when every required group is represented; it may also be partial or have no coverage. This prevents a multi-issue promotion from passing merely because one convenient citation was returned.

The version 2 definitions live in `evals/fca-retrieval-cases-v2.mjs`. They also record assumptions, citation rationales, relevance type and the explicit SME-review boundary.

## Compared modes

1. **Lexical:** SQLite FTS5/BM25 over exact provision text, citation and hierarchy fields.
2. **Semantic:** cosine similarity over the completed route-scoped OpenAI vectors.
3. **Hybrid:** a legal-search-specific policy that preserves up to five unique strongest lexical citations, then fills the remaining evidence slots from weighted reciprocal-rank fusion. Lexical ranking has twice the fusion weight of semantic ranking.

The lexical anchors are intentional. In legal review, an exact mandatory phrase or provision reference should not be buried merely because a broad semantic neighbour scores well. Semantic search supplies additional recall and context; it does not receive equal authority by assumption.

## Results — 1 September 2026

Hybrid is the product methodology. Lexical and semantic modes remain only as diagnostic ablations so a future tuning change cannot hide where gains or regressions came from.

| Hybrid measure | Result |
| --- | ---: |
| Cases with complete evidence coverage at 5/10 | 7 of 10 |
| Cases with partial coverage at 10 | 2 of 10 |
| Cases with no coverage at 10 | 1 of 10 |
| Required evidence groups retrieved at 5/10 | 12 of 15 (80%) |
| Mean per-case group coverage at 10 | 81.67% |
| Route leakage | 0 |
| Mean warm retrieval time | 1,000 ms |

| Case | Hybrid coverage | Retrieved evidence |
| --- | ---: | --- |
| Investment guarantee — exact | 1/1 | `COBS 4.2.5 G` at rank 2 |
| Investment guarantee — paraphrase | 0/1 | Missing the similar guarantee/protection wording group |
| Investment capital risk | 1/1 | `COBS 4.2.4 G` at rank 5 |
| Credit monthly payment and cashback | 3/3 | `CONC 3.5.3 R`, `3.5.5 R` and `3.5.7 R` at ranks 1, 3 and 4 |
| Credit representative example | 1/1 | `CONC 3.5.5 R` at rank 1 |
| Credit unlimited availability | 1/1 | Specific `CONC 3.3.10 G` at rank 2 |
| Mortgage comparison | 1/1 | `MCOB 3A.3.1 R` at rank 1 |
| Mortgage false availability | 1/1 | `MCOB 3A.2.4 R` at rank 1 |
| Crypto risk and protection | 2/3 | Warning and summary retrieved; `COBS 4.2.5 G` protection-claim evidence missing |
| Structured-deposit return and protection | 1/2 | `COBS 4.6.7 R` retrieved; `BCOBS 2.2.5 G` protection wording missing |

The ten query embeddings used 312 input tokens in one OpenAI request. Route leakage was zero in all modes.

The original single-anchor benchmark was retired as a quality headline after review found one incorrect applicability label and one false negative caused by accepting only a parent rule. In particular, structured-deposit promotion wording belongs under `BCOBS 2`, with `COBS 4.6` applying to performance, while `CONC 3.3.10 G` is valid specific support for misleading credit availability. Version 2 preserves those corrections transparently.

## What the result means

- The product registry and hard applicability router are behaving as intended: no result escaped its permitted principal/shared lanes.
- Exact FCA language is currently the strongest signal for known provisions.
- The vector index is valid and fast once a route is warm, but the present query representation retrieves broad conceptual neighbours more often than the precise expected rule.
- Hybrid retrieval is now safe to keep as the prototype policy because it does not sacrifice the strong legal-text matches. This evaluation does not yet demonstrate a recall gain from semantic search.
- The remaining engineering targets are specific: paraphrased guarantee wording, the crypto protection claim and the structured-deposit protection wording.

## Next retrieval gate

For this demo, retrieval tuning may continue against the three missing evidence groups using transparent signals such as section-heading or provision-type boosts and claim-to-rule concept expansion. `text-embedding-3-large`, a learned reranker or an ANN service should be adopted only if the same provisional set demonstrates a material gain.

Expanding the cases, declaring production-quality precision/recall, or adjudicating every apparently relevant top-ten result is blocked on SME input and is not necessary for the portfolio demo.

Run the gate locally with:

```powershell
npm run corpus:evaluate-retrieval
```

The detailed machine-readable report is written under `corpus/evals/` and remains a rebuildable, Git-ignored artifact.

