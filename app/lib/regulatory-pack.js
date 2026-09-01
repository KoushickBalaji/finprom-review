import {
  PRODUCT_SOURCEBOOKS,
  buildApplicabilityRoute,
  filterRecordsForRoute,
} from "./applicability-router.js";

export const SNAPSHOT = {
  id: "fca-demo-pack-2026-08-30",
  asOf: "30 August 2026",
  scope: "Selected FCA provisions for the three stored evaluation journeys",
  corpusMode: "demo-pack",
  corpusNotice:
    "The live demo still uses a limited regulatory pack. The authenticated full Handbook has been downloaded, normalized and chunked locally; its derived retrieval indexes are the next corpus step.",
};

export { PRODUCT_SOURCEBOOKS };

export const RULES = [
  {
    id: "COBS 4.2.1R",
    sourcebook: "COBS",
    products: ["investments"],
    heading: "The fair, clear and not misleading rule",
    provisionType: "Rule",
    effectiveDate: "1 October 2018",
    url: "https://handbook.fca.org.uk/handbook/cobs4/cobs4s2",
    quote: "A firm must ensure that a communication or a financial promotion is fair, clear and not misleading.",
    concepts: [
      "fair clear not misleading",
      "misleading statement",
      "retail communication",
      "financial promotion",
      "balanced claim",
    ],
  },
  {
    id: "COBS 4.2.4G",
    sourcebook: "COBS",
    products: ["investments"],
    heading: "Fair, clear and not misleading financial promotions",
    provisionType: "Guidance",
    effectiveDate: "1 April 2013",
    url: "https://handbook.fca.org.uk/handbook/cobs4/cobs4s2",
    quote: "A firm should ensure that a financial promotion for a product or service that places a client's capital at risk makes this clear.",
    concepts: [
      "capital at risk",
      "downside risk",
      "investment loss",
      "risk warning",
      "balanced return claim",
    ],
  },
  {
    id: "COBS 4.2.5G",
    sourcebook: "COBS",
    products: ["investments"],
    heading: "Use of guaranteed, protected or secure",
    provisionType: "Guidance",
    effectiveDate: "25 April 2013",
    url: "https://handbook.fca.org.uk/handbook/cobs4/cobs4s2",
    quote: "A communication or a financial promotion should not describe a feature of a product or service as ‘guaranteed’, ‘protected’ or ‘secure’, or use a similar term unless that term is capable of being a fair, clear and not misleading description of it and the firm communicates all of the information necessary, with sufficient clarity and prominence, to make the use of that term fair, clear and not misleading.",
    concepts: [
      "guaranteed return",
      "protected capital",
      "secure investment",
      "assured return",
      "risk free",
      "capital protection",
    ],
  },
  {
    id: "CONC 3.3.1R",
    sourcebook: "CONC",
    products: ["consumer_credit"],
    heading: "Clear, fair and not misleading",
    provisionType: "Rule",
    effectiveDate: "1 April 2014",
    url: "https://handbook.fca.org.uk/handbook/conc3/conc3s3",
    quote: "A firm must ensure that a communication or a financial promotion is clear, fair, and not misleading.",
    concepts: [
      "consumer credit promotion",
      "clear fair not misleading",
      "credit advertising",
      "balanced finance claim",
    ],
  },
  {
    id: "CONC 3.5.3R",
    sourcebook: "CONC",
    products: ["consumer_credit"],
    heading: "Content of financial promotions",
    provisionType: "Rule",
    effectiveDate: "31 May 2016",
    url: "https://handbook.fca.org.uk/handbook/conc3/conc3s5",
    quote: "Where a financial promotion indicates a rate of interest or an amount relating to the cost of credit, the financial promotion must also include a representative example in accordance with CONC 3.5.5R and specify a postal address at which the person making the financial promotion may be contacted.",
    concepts: [
      "monthly payment",
      "cost of credit",
      "interest rate",
      "representative example",
      "car finance payment",
      "credit repayment",
    ],
  },
  {
    id: "CONC 3.5.5R",
    sourcebook: "CONC",
    products: ["consumer_credit"],
    heading: "Representative example",
    provisionType: "Rule",
    effectiveDate: "6 April 2020",
    url: "https://handbook.fca.org.uk/handbook/conc3/conc3s5",
    quote: "The representative example must include the rate of interest, charges, total amount of credit, representative APR, duration, total amount payable and amount of each repayment. The required information must be clear, concise and prominent, presented together and accompanied by the words ‘representative example’.",
    concepts: [
      "representative APR",
      "representative example",
      "total amount payable",
      "monthly repayment",
      "cash price",
      "credit duration",
      "promotion incentive",
    ],
  },
  {
    id: "MCOB 3A.2.4R",
    sourcebook: "MCOB",
    products: ["mortgages"],
    heading: "Fair, clear and not misleading financial promotions",
    provisionType: "Rule",
    effectiveDate: "21 March 2016",
    url: "https://handbook.fca.org.uk/handbook/mcob3a/mcob3as2",
    quote: "A firm communicating or approving a financial promotion in relation to an MCD regulated mortgage contract must ensure that it is fair, clear and not misleading and does not contain wording that may create false expectations regarding the availability or the cost of a credit.",
    concepts: [
      "mortgage promotion",
      "false expectations",
      "mortgage cost",
      "mortgage availability",
      "fair clear not misleading",
    ],
  },
  {
    id: "MCOB 3A.3.1R",
    sourcebook: "MCOB",
    products: ["mortgages"],
    heading: "Balanced promotions and appropriate warnings",
    provisionType: "Rule",
    effectiveDate: "21 March 2016",
    url: "https://handbook.fca.org.uk/handbook/mcob3a/mcob3as3",
    quote: "A financial promotion must be accurate and balanced, must not emphasise potential benefits without a fair and prominent indication of relevant risks, must make clear where applicable that the credit is secured on the customer's home, and must present any comparison or contrast in a fair, balanced and meaningful way.",
    concepts: [
      "cheapest mortgage",
      "mortgage comparison",
      "monthly saving",
      "secured on your home",
      "relevant risks",
      "fair balanced meaningful comparison",
      "comparison basis",
    ],
  },
];

export const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

export function rulesForProduct(product) {
  const route = buildApplicabilityRoute({
    product,
    channel: "website",
    audience: "uk_retail",
    jurisdiction: "UK_FCA",
  });
  const preferred = route.principalSourcebooks;
  return filterRecordsForRoute(RULES, route).map((rule) => ({
    ...rule,
    applicabilityBoost: preferred.includes(rule.sourcebook) ? 1 : 0,
    scopeLanes: route.lanes
      .filter((lane) => lane.selectors.some((selector) => selector.sourcebook === rule.sourcebook))
      .map((lane) => lane.id),
  }));
}

