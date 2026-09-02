# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- Match `../design/references/finprom-review-queue-v1.png`: dark header, queue/detail split, restrained compliance styling and sparse semantic colour.
- Keep `Review queue` live. `Review history` and `Reference library` communicate the wider product but remain preview-only.
- The four prepared cases are existing queue tickets. `New promotion` creates an arbitrary free-text review.
- Advisory outcomes are `Recommended for approval`, `Revise` and `Block`; every result retains `Reviewer decision: Pending` and there is no AI approval action.
- Use OpenAI through Vercel AI Gateway for extraction/evaluation. Corpus and query embeddings use the OpenAI Embeddings API with the same recorded model and dimensions. Deterministic local behaviour is a development fixture, never presented as the production AI path.
- Local end-to-end checks may use the configured OpenAI key directly when Gateway/OIDC is unavailable. The live smoke gate must refuse fixture mode and the small pack, retain the full trace, keep the final evidence pack bounded, and never turn an unavailable model into a recommendation.
- Runtime retrieval is claim-level multi-query: structured model output supplies claim concepts; deterministic sourcebook/claim-type vocabulary expands retrieval without adding rule IDs; exact governing queries are lexical and claim paraphrases are hybrid.
- The product selector covers all 34 promotion-relevant product/service families in `shared/fca-product-registry.js`; prepared examples remain deeper worked journeys, not a product ceiling.
- The authenticated FCA API snapshot, normalization and chunk derivatives may be stored locally. Never ship Handbook text to the browser. Deployment must use a private indexed store or an explicitly selected server-side artifact with source/version attribution.

