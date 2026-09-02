# End-to-end smoke test

## Purpose

This is the live gate between the retrieval benchmark and the reviewer UI. It starts with ordinary promotion text and submitted ticket context; no manually prepared search concepts are supplied. The same server-side workflow used by the app must complete:

1. structured claim and disclosure extraction;
2. applicability routing;
3. query embedding plus scoped lexical and semantic retrieval;
4. evidence-grounded structured evaluation;
5. deterministic validation of every promotional quote and cited FCA provision;
6. an advisory result with `Reviewer decision: Pending`.

The runner refuses the deterministic fixture, the small development rule pack and a missing full FCA index. A failed or timed-out model call, missing evidence group, unvalidated citation, unexpected recommendation or non-pending reviewer state fails the case.

## Cases

| Case | Purpose | Expected advisory result | Provisional evidence groups |
|---|---|---|---|
| `investment-guarantee-paraphrase` | Paraphrased assured return and full-protection claims | `Block` | COBS guarantee/protection wording |
| `credit-monthly-payment-and-cashback` | Monthly credit-cost claim plus application incentive | `Revise` or `Block` | Cost trigger, representative-example contents and cashback incentive |
| `balanced-investment-invitation` | Self-contained fund description, scoped charges and explicit downside risk | `Recommended` | Governing communication rule and capital-at-risk guidance |

The labels are engineering acceptance criteria for this work sample, not an FCA compliance opinion. An FCA financial-promotions SME must validate the expected provisions, completeness and outcome labels before these cases support any external accuracy claim.

## Retrieval strategy exercised

The extraction model supplies claims, claim types and regulatory search concepts. Runtime retrieval then creates:

- one hybrid lexical/semantic query per extracted claim;
- exact lexical query expansions derived from structured claim type and applicable sourcebook vocabulary, without adding rule IDs;
- one lexical governing-standard query;
- one omission query only when extraction identifies a claim-triggered consumer-facing omission.

High-precision regulatory-hint and governing-standard results enter the citation-deduplicated pack first. Claim searches then add paraphrase coverage. The final evaluation pack is capped at 12 provisions and every selected item retains the query IDs that retrieved it.

## Run

```powershell
npm run smoke:e2e
```

Run one case while iterating:

```powershell
npm run smoke:e2e -- --case credit-monthly-payment-and-cashback
```

The ignored local reports are written under `corpus/evals/fca-handbook-2026-08-30/` as JSON and Markdown. They include input, provider/model identifiers, extracted claims, applicability route, every retrieval query, ranked evidence, missing evidence groups, raw structured evaluation, deterministic validation, usage and stage timings. They never contain credentials.

## Current result and boundary

The final 1 September 2026 local run passed all three cases and all six provisional evidence groups using real OpenAI calls and the full local Handbook index. The final run took roughly 29 seconds for the guarantee case, 49 seconds for the multi-issue credit case and 34 seconds for the positive case. Correctness and observability are therefore demonstrated, but interactive latency is not yet at the desired production level. Query caching, concurrent scoped searches, a hosted ANN index, prompt/evidence compaction and model-tier measurement remain performance work rather than being hidden by a looser timeout or a fixture.

