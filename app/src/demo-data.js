import { RULES, SNAPSHOT } from "../lib/regulatory-pack.js";

const citations = (...ids) => RULES.filter((rule) => ids.includes(rule.id)).map((rule) => ({
  id: rule.id, heading: rule.heading, provisionType: rule.provisionType,
  quote: rule.quote, url: rule.url, effectiveDate: rule.effectiveDate,
}));

const commonAudit = (sourcebook, claims) => ({
  workflowVersion: "finprom-review-v1.0.0",
  engineMode: "Validated stored review",
  models: {
    extraction: "openai/gpt-5.6-luna-fast",
    embedding: "openai/text-embedding-3-small",
    evaluation: "openai/gpt-5.6-terra-fast",
  },
  snapshot: SNAPSHOT,
  extractedClaims: claims.map((exactText, index) => ({ id: `claim-${index + 1}`, exactText })),
  retrievedEvidence: RULES.filter((rule) => rule.sourcebook === sourcebook).slice(0, 3).map((rule, index) => ({
    id: rule.id, sourcebook, lexicalRank: index + 1, semanticRank: Math.min(index + 2, 3),
  })),
  validation: { passed: true, checks: 4 },
  timings: { extractionMs: 1180, retrievalMs: 410, evaluationMs: 2960, totalMs: 4550 },
});

const baseResult = ({ product, channel, recommendation, summary, findings, sourcebook, claims, assumptions = [] }) => ({
  ok: true,
  recommendation,
  reviewerDecision: "pending",
  applicability: {
    product, channel, audience: "UK retail", jurisdiction: "United Kingdom / FCA",
    principalSourcebooks: [sourcebook], contextStatus: "consistent",
    contextExplanation: "The selected product is consistent with the submitted copy.",
  },
  summary,
  assumptions: ["Text-only review", "The firm is communicating its own promotion", ...assumptions],
  findings,
  limitations: [
    "Visual prominence, layout and placement were not assessed.",
    "External substantiation was not supplied and has not been verified.",
  ],
  audit: commonAudit(sourcebook, claims),
});

export const INITIAL_TICKETS = [
  {
    id: "INV-2026-0412", title: "Guaranteed 12% annual return", owner: "Alex Morgan",
    submitted: "30 Aug 2026, 10:42", sortDate: 4, workflowStatus: "In review",
    product: "investments", channel: "website",
    promotion: "Earn a guaranteed 12% annual return with our investment bond. Your capital is completely secure.",
    result: baseResult({
      product: "investments", channel: "website", recommendation: "block", sourcebook: "COBS",
      claims: ["guaranteed 12% annual return", "capital is completely secure"],
      summary: "The guarantee and security language is not accompanied by the information needed to make those terms fair, clear and not misleading.",
      findings: [{
        id: "finding-1", promoQuote: "guaranteed 12% annual return", result: "block", issueType: "wording",
        ruleIds: ["COBS 4.2.1R", "COBS 4.2.5G"], citations: citations("COBS 4.2.1R", "COBS 4.2.5G"),
        explanation: "‘Guaranteed’ and ‘secure’ are used without the scope, conditions and product evidence needed to support those descriptions for a retail audience.",
        requiredAction: "Remove the guarantee/security claim unless its precise scope can be substantiated and explained clearly and prominently.",
        substantiationStatus: "reviewer_to_verify", disclosureStatus: "missing",
        suggestedRewrite: "Explore the investment bond. Returns are not guaranteed and your capital is at risk.",
      }],
    }),
  },
  {
    id: "CC-2026-0398", title: "£199 a month + cashback", owner: "Jamie Lee",
    submitted: "29 Aug 2026, 16:18", sortDate: 3, workflowStatus: "Triaged",
    product: "consumer_credit", channel: "social",
    promotion: "Drive away today for only £199 a month — plus £500 cashback when you apply online.",
    result: baseResult({
      product: "consumer_credit", channel: "social", recommendation: "revise", sourcebook: "CONC",
      claims: ["£199 a month", "£500 cashback"],
      summary: "The monthly payment and incentive trigger representative credit information that is absent from the submitted copy.",
      findings: [{
        id: "finding-1", promoQuote: "£199 a month — plus £500 cashback", result: "revise", issueType: "omission",
        ruleIds: ["CONC 3.5.3R", "CONC 3.5.5R"], citations: citations("CONC 3.5.3R", "CONC 3.5.5R"),
        explanation: "A monthly repayment is an amount relating to the cost of credit. The promotion therefore needs the triggered representative example and related information.",
        requiredAction: "Add a complete representative example, representative APR and the other required information using product-confirmed figures. The text-only review cannot verify prominence.",
        substantiationStatus: "reviewer_to_verify", disclosureStatus: "missing", suggestedRewrite: null,
      }],
    }),
  },
  {
    id: "MORT-2026-0387", title: "UK’s cheapest mortgage", owner: "Priya Shah",
    submitted: "28 Aug 2026, 11:05", sortDate: 2, workflowStatus: "Triaged",
    product: "mortgages", channel: "website",
    promotion: "Switch to the UK’s cheapest mortgage and save £250 every month.",
    result: baseResult({
      product: "mortgages", channel: "website", recommendation: "block", sourcebook: "MCOB",
      claims: ["UK’s cheapest mortgage", "save £250 every month"],
      summary: "The absolute comparison and quantified saving are not explained, and the promotion omits balancing mortgage risk information.",
      findings: [{
        id: "finding-1", promoQuote: "UK’s cheapest mortgage and save £250 every month", result: "block", issueType: "substantiation",
        ruleIds: ["MCOB 3A.2.4R", "MCOB 3A.3.1R"], citations: citations("MCOB 3A.2.4R", "MCOB 3A.3.1R"),
        explanation: "The copy gives an absolute market comparison and a quantified saving without a comparison basis, while emphasising benefit without the relevant secured-credit risk information.",
        requiredAction: "State a fair, dated comparison basis, add the applicable secured-credit warning and verify the saving calculation before reconsideration.",
        substantiationStatus: "reviewer_to_verify", disclosureStatus: "missing", suggestedRewrite: null,
      }],
    }),
  },
  {
    id: "INV-2026-0375", title: "Northstar Balanced Fund", owner: "Daniel Hughes",
    submitted: "27 Aug 2026, 09:31", sortDate: 1, workflowStatus: "Reviewed",
    product: "investments", channel: "website",
    promotion: "Explore the Northstar Balanced Fund. The value of investments can fall as well as rise, and you may get back less than you invest. View the fund details and charges.",
    result: baseResult({
      product: "investments", channel: "website", recommendation: "recommended", sourcebook: "COBS",
      claims: ["Explore the Northstar Balanced Fund", "you may get back less than you invest"],
      summary: "No material issue was identified in the supplied copy and context. Downside risk is stated alongside the invitation and no quantified return is promised.",
      findings: [{
        id: "finding-1", promoQuote: "The value of investments can fall as well as rise, and you may get back less than you invest.", result: "meets", issueType: "none",
        ruleIds: ["COBS 4.2.1R", "COBS 4.2.4G"], citations: citations("COBS 4.2.1R", "COBS 4.2.4G"),
        explanation: "The copy makes the capital risk clear and does not pair the invitation with an unqualified or quantified return claim.",
        requiredAction: null, substantiationStatus: "not_required", disclosureStatus: "present", suggestedRewrite: null,
      }],
      assumptions: ["No statement is made about visual prominence because only text was supplied"],
    }),
  },
];

export const PRODUCT_LABELS = { investments: "Investments", consumer_credit: "Consumer credit", mortgages: "Mortgages" };
export const CHANNEL_LABELS = { website: "Website", social: "Social media", email: "Email" };

