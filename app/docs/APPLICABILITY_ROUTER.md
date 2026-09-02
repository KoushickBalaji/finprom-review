# Applicability router

## What the router decides

The router turns the context already present on a marketer's submission into a **permitted regulatory search scope**. It runs before lexical or semantic retrieval.

It does not decide that a rule has been breached, and it does not assume that every rule admitted to the scope applies. Those are later evidence and evaluation decisions. Its job is to retain plausible applicable material while preventing irrelevant parts of the Handbook from dominating retrieval.

## Route shape

Every supported UK-retail route contains three layers:

1. **Principal product lane** — one or more complete product and specialist sourcebooks selected from the 34-family FCA product registry. Examples include investments → `COBS`, non-investment insurance → `ICOBS`, retail banking → `BCOBS`, consumer credit → `CONC`, mortgages → `MCOB`, funeral plans → `FPCOB`, and structured deposits → `BCOBS + COBS + DISC`.
2. **Cross-cutting communication lane** — the relevant application, cross-cutting-duty and consumer-understanding sections in `PRIN`: `PRIN 2A.1`, `PRIN 2A.2`, `PRIN 2A.5` and `PRIN 3.2`.
3. **General status and branding lane** — `GEN 4.5` and `GEN 5.1`, covering status/authorisation statements and FCA-logo controls.

This is a union, not a winner-takes-all classification. Selecting structured deposits, for example, produces `BCOBS + COBS + DISC + targeted PRIN + targeted GEN`. The complete mapping is recorded in `docs/FCA_PRODUCT_REGISTRY.md`.

The shared lanes are deliberately section-level rather than the whole of `PRIN` or `GEN`. This keeps cross-cutting duties available without flooding a promotion review with unrelated high-level or administrative material.

## Cross-product references

After initial retrieval, strong candidate provisions may expand their outgoing Handbook cross-references. The first version permits:

- one expansion hop;
- at most six targets per seed provision;
- targets in another sourcebook;
- substantive records only; and
- records from the same dated snapshot only.

This catches definitions, linked conditions and genuine cross-product dependencies without turning a single reference into an unbounded graph crawl. Cross-reference expansion is represented in the route contract now; executing it over the full chunk set belongs in the full-corpus retrieval adapter.

## One scope for both retrieval methods

Lexical and semantic search must receive the same candidate IDs produced by the router. They can rank those candidates differently, but neither search method can introduce a provision that the other was forbidden to inspect. Fusion operates over those scoped result lists.

This avoids two common errors:

- a semantically similar rule from the wrong product sourcebook outranking the applicable product rules; and
- a keyword hit bypassing product applicability because it contains a phrase such as “guaranteed”.

The route, lane membership and selected evidence IDs are recorded in the audit trace, so a reviewer can distinguish **why a provision was available** from **why it was ultimately cited**.

## Guardrails and failure behaviour

- There is no whole-Handbook fallback when a route is unknown or weak.
- Unsupported product, audience or jurisdiction values fail closed.
- A material conflict between the submitted product and the promotional wording is surfaced for reviewer resolution; it does not silently widen the search.
- Shared-lane inclusion is not proof of legal applicability. The evaluator must still use the provision's application conditions and the submitted context.
- The route definition is versioned as `fca-applicability-v1.1.0` and its scope ID is retained with the review.

## Current corpus check

The selectors were run over the 30 August 2026 full-Handbook chunk preview (35,628 substantive chunks):

| Example route | Product lane | PRIN overlay | GEN overlay | Union | Share of substantive corpus |
| --- | ---: | ---: | ---: | ---: | ---: |
| Investments | 3,153 COBS | 74 | 23 | 3,250 | 9.12% |
| Consumer credit | 1,241 CONC | 74 | 23 | 1,338 | 3.76% |
| Mortgages | 1,678 MCOB | 74 | 23 | 1,775 | 4.98% |
| Retail banking | 327 BCOBS | 74 | 23 | 424 | 1.19% |
| Non-investment insurance | 559 ICOBS | 74 | 23 | 656 | 1.84% |
| Structured deposits | 3,681 BCOBS/COBS/DISC | 74 | 23 | 3,778 | 10.60% |
| Claims management | 167 CMCOB | 74 | 23 | 264 | 0.74% |
| Funeral plans | 410 FPCOB | 74 | 23 | 507 | 1.42% |

All 34 configured families were checked against the full chunk preview and produced non-empty, bounded routes. Re-run the inspection with `npm run corpus:inspect-routes` whenever the FCA snapshot or product registry changes.

## Next implementation step

Build the lexical and vector indexes from all eligible chunks, storing sourcebook, hierarchy, snapshot and cross-reference metadata alongside each vector. At query time the router's permitted IDs or equivalent metadata predicate must be applied **before** ranking. Only the small fused and expanded evidence pack is sent to the evaluation model.

