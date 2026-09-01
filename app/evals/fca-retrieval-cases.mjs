import { PRODUCT_LABELS } from "../shared/fca-product-registry.js";

// Legacy v1 single-anchor definitions retained only to preserve the historical
// baseline. The active benchmark imports fca-retrieval-cases-v2.mjs.

const define = (definition) => Object.freeze({
  channel: "website",
  audience: "uk_retail",
  jurisdiction: "UK_FCA",
  searchConcepts: Object.freeze([]),
  ...definition,
  expectedAnyOf: Object.freeze([...definition.expectedAnyOf]),
  searchConcepts: Object.freeze([...(definition.searchConcepts ?? [])]),
});

// These are retrieval cases, not final compliance decisions. Their query text
// represents the promotion plus deterministic output expected from the claim-
// extraction stage. The expected citations are the high-confidence anchors
// already used by the three deep demo journeys, plus two product-router checks.
export const FCA_RETRIEVAL_EVAL_CASES = Object.freeze([
  define({
    id: "investment-guarantee-exact",
    product: "investments",
    promotion: "Earn a guaranteed 12% annual return with our investment bond. Your capital is completely secure.",
    searchConcepts: ["guaranteed return", "protected capital", "secure investment", "financial promotion"],
    expectedAnyOf: ["COBS 4.2.5 G"],
  }),
  define({
    id: "investment-guarantee-paraphrase",
    product: "investments",
    channel: "email",
    promotion: "Receive an assured 12% each year and your money remains fully protected.",
    searchConcepts: ["assured return", "capital protection", "risk free claim"],
    expectedAnyOf: ["COBS 4.2.5 G"],
  }),
  define({
    id: "investment-capital-risk",
    product: "investments",
    promotion: "The fund targets a 12% annual return. Returns are not guaranteed and your capital is at risk.",
    searchConcepts: ["capital at risk", "balanced return claim", "investment loss warning"],
    expectedAnyOf: ["COBS 4.2.4 G", "COBS 4.2.1 R"],
  }),
  define({
    id: "credit-monthly-payment-trigger",
    product: "consumer_credit",
    channel: "social",
    promotion: "Drive away today for only £199 a month — plus £500 cashback when you apply online.",
    searchConcepts: ["monthly payment", "amount relating to cost of credit", "representative example"],
    expectedAnyOf: ["CONC 3.5.3 R", "CONC 3.5.5 R"],
  }),
  define({
    id: "credit-representative-example",
    product: "consumer_credit",
    promotion: "Drive away for £199 a month. Representative example: cash price £12,000, deposit £1,000, amount of credit £11,000, fixed interest rate 6.9% per annum, 48 monthly payments of £199, total amount payable £12,552, representative APR 6.9%.",
    searchConcepts: ["representative APR", "total amount payable", "duration", "amount of each repayment"],
    expectedAnyOf: ["CONC 3.5.5 R"],
  }),
  define({
    id: "credit-unlimited-availability",
    product: "consumer_credit",
    channel: "social",
    promotion: "Unlimited loan amount instantly.",
    searchConcepts: ["credit availability claim", "misleading absolute claim", "clear fair and not misleading"],
    expectedAnyOf: ["CONC 3.3.1 R"],
  }),
  define({
    id: "mortgage-comparison-exact",
    product: "mortgages",
    promotion: "Switch to the UK's cheapest mortgage and save £250 every month.",
    searchConcepts: ["mortgage comparison", "cheapest mortgage", "fair balanced meaningful comparison"],
    expectedAnyOf: ["MCOB 3A.3.1 R"],
  }),
  define({
    id: "mortgage-false-availability",
    product: "mortgages",
    channel: "social",
    promotion: "Everyone is approved instantly for our lowest-rate mortgage.",
    searchConcepts: ["false expectations", "mortgage availability", "mortgage cost"],
    expectedAnyOf: ["MCOB 3A.2.4 R"],
  }),
  define({
    id: "crypto-risk-summary",
    product: "qualifying_cryptoassets",
    promotion: "Buy crypto today for high returns with complete protection from losses.",
    searchConcepts: ["qualifying cryptoasset", "high-risk investment", "risk summary", "capital loss"],
    expectedAnyOf: ["COBS 4 Annex 1R R", "COBS 4.2.5 G"],
  }),
  define({
    id: "structured-deposit-protection",
    product: "structured_deposits",
    promotion: "A guaranteed market-linked return with your deposit fully protected.",
    searchConcepts: ["structured deposit", "guaranteed", "protected", "secure"],
    expectedAnyOf: ["COBS 4.2.5 G"],
  }),
]);

export function buildRetrievalEvalQuery(definition) {
  return [
    PRODUCT_LABELS[definition.product],
    definition.promotion,
    ...definition.searchConcepts,
  ].join(" ");
}

