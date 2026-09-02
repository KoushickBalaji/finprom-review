import { PRODUCT_LABELS } from "../shared/fca-product-registry.js";

export const FCA_RETRIEVAL_LABEL_AUTHORITY = Object.freeze({
  status: "provisional-desk-reviewed",
  reviewedAgainst: "FCA Handbook snapshot dated 2026-08-30 and current official FCA Handbook pages",
  reviewerQualification: "engineering desk review; not an FCA compliance SME opinion",
  intendedUse: "demo retrieval development and regression detection only",
  requiresSmeReview: true,
  smeReviewBoundary: "Confirm completeness, applicability assumptions, relevance grades and acceptable alternative provisions before production use or external quality claims.",
});

const evidenceGroup = (id, description, acceptedCitations) => Object.freeze({
  id,
  description,
  acceptedCitations: Object.freeze(acceptedCitations.map((item) => Object.freeze({
    relevance: "direct",
    ...item,
  }))),
});

const define = (definition) => Object.freeze({
  channel: "website",
  audience: "uk_retail",
  jurisdiction: "UK_FCA",
  searchConcepts: Object.freeze([]),
  assumptions: Object.freeze([]),
  ...definition,
  evidenceGroups: Object.freeze([...definition.evidenceGroups]),
  searchConcepts: Object.freeze([...(definition.searchConcepts ?? [])]),
  assumptions: Object.freeze([...(definition.assumptions ?? [])]),
});

// These cases evaluate whether retrieval supplies evidence for each material
// claim or disclosure issue, not whether the final compliance decision is
// correct. Labels were desk-reviewed against primary FCA text and are explicitly
// provisional until an FCA compliance SME validates their completeness.
export const FCA_RETRIEVAL_EVAL_CASES = Object.freeze([
  define({
    id: "investment-guarantee-exact",
    product: "investments",
    promotion: "Earn a guaranteed 12% annual return with our investment bond. Your capital is completely secure.",
    searchConcepts: ["guaranteed return", "protected capital", "secure investment", "financial promotion"],
    evidenceGroups: [
      evidenceGroup("guarantee-and-protection-wording", "Restrictions on describing an investment feature as guaranteed, protected or secure.", [
        { citation: "COBS 4.2.5 G", rationale: "Directly addresses guaranteed, protected, secure and similar terms." },
      ]),
    ],
  }),
  define({
    id: "investment-guarantee-paraphrase",
    product: "investments",
    channel: "email",
    promotion: "Receive an assured 12% each year and your money remains fully protected.",
    searchConcepts: ["assured return", "capital protection", "risk free claim"],
    evidenceGroups: [
      evidenceGroup("similar-guarantee-and-protection-wording", "The same restriction must be found when equivalent rather than exact terms are used.", [
        { citation: "COBS 4.2.5 G", rationale: "Expressly includes terms similar to guaranteed, protected or secure." },
      ]),
    ],
  }),
  define({
    id: "investment-capital-risk",
    product: "investments",
    promotion: "The fund targets a 12% annual return. Returns are not guaranteed and your capital is at risk.",
    searchConcepts: ["capital at risk", "balanced return claim", "investment loss warning"],
    evidenceGroups: [
      evidenceGroup("capital-at-risk-disclosure", "Investment promotions for products placing capital at risk should make that risk clear.", [
        { citation: "COBS 4.2.4 G", rationale: "Direct guidance on making capital-at-risk status clear." },
        { citation: "COBS 4.2.1 R", relevance: "supporting", rationale: "The governing fair, clear and not misleading rule." },
      ]),
    ],
  }),
  define({
    id: "credit-monthly-payment-trigger",
    product: "consumer_credit",
    channel: "social",
    promotion: "Drive away today for only £199 a month — plus £500 cashback when you apply online.",
    searchConcepts: ["monthly payment", "amount relating to cost of credit", "representative example", "incentive to apply for credit"],
    evidenceGroups: [
      evidenceGroup("credit-cost-trigger", "A stated amount relating to the cost of credit triggers additional information.", [
        { citation: "CONC 3.5.3 R", rationale: "Direct trigger rule for an interest rate or amount relating to credit cost." },
      ]),
      evidenceGroup("representative-example-contents", "The triggered representative example must contain the prescribed information.", [
        { citation: "CONC 3.5.5 R", rationale: "Defines the representative-example contents and prominence." },
      ]),
      evidenceGroup("cashback-incentive", "An incentive to apply for credit triggers a representative APR and prominence requirements.", [
        { citation: "CONC 3.5.7 R", rationale: "Direct rule for incentives to apply for credit." },
      ]),
    ],
  }),
  define({
    id: "credit-representative-example",
    product: "consumer_credit",
    promotion: "Drive away for £199 a month. Representative example: cash price £12,000, deposit £1,000, amount of credit £11,000, fixed interest rate 6.9% per annum, 48 monthly payments of £199, total amount payable £12,552, representative APR 6.9%.",
    searchConcepts: ["representative APR", "total amount payable", "duration", "amount of each repayment"],
    evidenceGroups: [
      evidenceGroup("representative-example-requirements", "The reviewer needs the provision defining the required contents and presentation.", [
        { citation: "CONC 3.5.5 R", rationale: "Directly defines all representative-example fields and prominence." },
      ]),
    ],
  }),
  define({
    id: "credit-unlimited-availability",
    product: "consumer_credit",
    channel: "social",
    promotion: "Unlimited loan amount instantly.",
    searchConcepts: ["credit availability claim", "misleading absolute claim", "clear fair and not misleading"],
    evidenceGroups: [
      evidenceGroup("misleading-credit-availability", "The evidence should connect an absolute availability claim to the consumer-credit misleading-promotion rule.", [
        { citation: "CONC 3.3.10 G", rationale: "Specific guidance identifying misleading credit-product availability as likely to breach CONC 3.3.1 R." },
        { citation: "CONC 3.3.1 R", relevance: "supporting", rationale: "The governing clear, fair and not misleading rule." },
      ]),
    ],
  }),
  define({
    id: "mortgage-comparison-exact",
    product: "mortgages",
    promotion: "Switch to the UK's cheapest mortgage and save £250 every month.",
    searchConcepts: ["mortgage comparison", "cheapest mortgage", "fair balanced meaningful comparison"],
    evidenceGroups: [
      evidenceGroup("mortgage-comparison", "A mortgage comparison must be fair, balanced and meaningful.", [
        { citation: "MCOB 3A.3.1 R", rationale: "Direct mortgage-promotion comparison rule." },
      ]),
    ],
  }),
  define({
    id: "mortgage-false-availability",
    product: "mortgages",
    channel: "social",
    promotion: "Everyone is approved instantly for our lowest-rate mortgage.",
    searchConcepts: ["false expectations", "mortgage availability", "mortgage cost"],
    evidenceGroups: [
      evidenceGroup("mortgage-availability-and-cost", "The promotion must not create false expectations about mortgage availability or cost.", [
        { citation: "MCOB 3A.2.4 R", rationale: "Directly prohibits wording creating false expectations about availability or cost." },
      ]),
    ],
  }),
  define({
    id: "crypto-risk-summary",
    product: "qualifying_cryptoassets",
    promotion: "Buy crypto today for high returns with complete protection from losses.",
    searchConcepts: ["qualifying cryptoasset", "high-risk investment", "risk warning", "risk summary", "capital loss", "protected claim"],
    evidenceGroups: [
      evidenceGroup("crypto-risk-warning", "A qualifying-cryptoasset promotion requires the prescribed risk warning and link or accompanying summary.", [
        { citation: "COBS 4.12A.11 R", rationale: "Direct rule prescribing the cryptoasset risk warning and access to a risk summary." },
      ]),
      evidenceGroup("crypto-risk-summary-content", "The appropriate cryptoasset risk-summary content must be retrievable.", [
        { citation: "COBS 4 Annex 1R R", rationale: "Contains the prescribed risk summary for qualifying cryptoassets." },
      ]),
      evidenceGroup("crypto-protection-claim", "The claim of complete protection requires the rule on guaranteed, protected and secure wording.", [
        { citation: "COBS 4.2.5 G", rationale: "Directly addresses protected or similar product claims." },
      ]),
    ],
    assumptions: ["The copy is a UK retail financial promotion for a qualifying cryptoasset."],
  }),
  define({
    id: "structured-deposit-protection",
    product: "structured_deposits",
    promotion: "A guaranteed market-linked return with your deposit fully protected.",
    searchConcepts: ["structured deposit", "future performance", "guaranteed", "protected", "secure"],
    evidenceGroups: [
      evidenceGroup("structured-deposit-protection-wording", "BCOBS governs guaranteed, protected or secure wording for a structured-deposit promotion.", [
        { citation: "BCOBS 2.2.5 G", rationale: "Direct BCOBS guidance for guaranteed, protected, secure and similar terms." },
      ]),
      evidenceGroup("structured-deposit-future-performance", "A market-linked return claim requires the structured-deposit future-performance rule.", [
        { citation: "COBS 4.6.7 R", rationale: "Directly applies future-performance conditions to structured deposits." },
      ]),
    ],
    assumptions: ["The market-linked return wording is an indication of future performance."],
  }),
]);

export function buildRetrievalEvalQuery(definition) {
  return [
    PRODUCT_LABELS[definition.product],
    definition.promotion,
    ...definition.searchConcepts,
  ].join(" ");
}

