# Zango FinProm review copilot

A focused work sample for an FCA financial-promotion review workflow. It is built for the compliance reviewer, not the copywriter: submissions arrive as review tickets, the AI prepares grounded findings, and the reviewer retains the decision.

## What works

- Four realistic review tickets plus arbitrary free-text submissions.
- Investments, consumer credit and mortgages; UK retail context; website, social and email channels.
- Staged analysis: context validation, structured claim extraction, hybrid retrieval, evidence-grounded evaluation, deterministic validation and an auditable recommendation.
- Outcome-specific reviewer guidance for `Recommended for approval`, `Revise` and `Block`.
- Exact FCA links and stored quotations, highlighted promotional phrases, disclosure and substantiation status, remediation and safe rewrites.
- Fail-closed handling when the model, retrieval or validation layer cannot support a grounded conclusion.
- Twelve automated exact, paraphrase and boundary evaluations.

## AI workflow

The deployment uses OpenAI through Vercel AI Gateway:

1. Luna Fast extracts claims and context signals into a Zod-validated structure.
2. Lexical ranking and `text-embedding-3-small` semantic similarity retrieve and fuse the evidence pack.
3. Terra Fast evaluates only against that pack and emits a second structured result.
4. The application verifies promotional quotations and rule identifiers, inserts exact stored FCA quotations, derives the overall recommendation and writes the audit trace.

Model identifiers are configurable in the environment. The deterministic local fixture is only a development and test fallback; hosted analysis fails closed if the real AI path is unavailable.

## Regulatory corpus boundary

The production design is full-Handbook retrieval, but the public deployment deliberately uses a versioned eight-provision pack. The FCA Handbook API requires authenticated access and the current Handbook terms create a permission/licensing requirement for storing substantial Handbook content in an electronic retrieval system.

The intended full-corpus architecture keeps the Handbook outside the web bundle and serverless function:

`FCA API -> immutable private snapshot -> Postgres full-text + vector index -> lean review function`

That preserves full coverage, source versions and low-latency retrieval without exposing or repeatedly transferring the source corpus.

## Run and verify

```powershell
npm install
npm run check
npm run dev
```

Local AI calls use `AI_GATEWAY_API_KEY` when present. Vercel deployments use their automatically provisioned OIDC identity with AI Gateway, so no long-lived model secret needs to be committed.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the request path and production corpus design, and [design-qa.md](design-qa.md) for the visual verification record.

