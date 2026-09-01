# FCA product registry

## Boundary

The dropdown is generated from one central registry of **promotion-relevant FCA product and service families**. It covers the customer-facing conduct sourcebooks and product-specific specialist sourcebooks in the downloaded 30 August 2026 Handbook snapshot.

It does not turn every Handbook sourcebook into a product. Prudential, supervision, enforcement, redress and market-infrastructure manuals remain in the corpus and can be reached through verified references, but they are not meaningful values for a marketer's product field.

The registry is executable configuration in `shared/fca-product-registry.js`. The request schema, UI, ticket IDs, router and route-inspection script all consume that same source.

## Selectable families

| Group | Product or service family | Principal sourcebooks |
| --- | --- | --- |
| Investments and pensions | Retail investments | COBS |
| Investments and pensions | Collective investment schemes | COBS, COLL |
| Investments and pensions | Investment funds | COBS, FUND |
| Investments and pensions | Pensions and retirement products | COBS |
| Investments and pensions | Peer-to-peer agreements | COBS |
| Investments and pensions | Qualifying cryptoassets | COBS |
| Investments and pensions | Consumer composite investments | COBS, DISC |
| Investments and pensions | Sustainability-labelled investments | COBS, ESG, PROD |
| Investments and pensions | Insurance-based investment products | COBS |
| Banking and payments | Retail banking services | BCOBS |
| Banking and payments | Deposits and savings accounts | BCOBS |
| Banking and payments | Structured deposits | BCOBS, COBS, DISC |
| Banking and payments | Payment services and electronic money | BCOBS |
| Banking and payments | Cash access services | ATCS, BCOBS |
| Credit and home finance | Consumer credit | CONC |
| Credit and home finance | Motor finance | CONC |
| Credit and home finance | Credit cards and revolving credit | CONC |
| Credit and home finance | High-cost credit | CONC |
| Credit and home finance | Consumer hire and hire purchase | CONC |
| Credit and home finance | Credit broking | CONC |
| Credit and home finance | Debt counselling and debt adjusting | CONC |
| Credit and home finance | Mortgages | MCOB |
| Credit and home finance | Equity release and home reversion | MCOB |
| Credit and home finance | Home purchase plans | MCOB |
| Credit and home finance | Sale and rent back agreements | MCOB |
| Credit and home finance | Credit union savings | CREDS, BCOBS |
| Credit and home finance | Credit union lending | CREDS, CONC |
| Credit and home finance | Credit union mortgages | CREDS, MCOB |
| Insurance and protection | Non-investment insurance | ICOBS |
| Insurance and protection | General insurance | ICOBS |
| Insurance and protection | Pure protection products | ICOBS |
| Specialist regulated services | Claims management services | CMCOB |
| Specialist regulated services | Funeral plans | FPCOB |
| Specialist regulated services | Pensions dashboard services | PDCOB |

## Routing meaning

A sourcebook listed here is admitted to the permitted candidate set; it is not a declaration that every provision in it legally applies to the ticket. Application conditions are evaluated later against the firm, activity, customer and promotion context.

Multi-sourcebook mappings are intentional. For example, the Handbook links structured deposits to BCOBS communications rules, relevant COBS performance rules and DISC disclosure requirements. The router therefore retains all three rather than forcing the ticket into a single sourcebook.

This registry should be versioned with the applicability router and rechecked whenever the Handbook snapshot changes.

