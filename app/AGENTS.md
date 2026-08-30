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
- Use OpenAI through Vercel AI Gateway in deployment. Deterministic local behaviour is a development fixture, never presented as the production AI path.
- Do not publicly bundle or scrape the full FCA Handbook. The full-corpus ingestion adapter requires authenticated FCA API access and licensing/permission; the public demo uses a clearly labelled selected regulatory pack.
