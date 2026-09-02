export const FCA_END_TO_END_SMOKE_AUTHORITY = Object.freeze({
  status: "provisional-demo-smoke-test",
  purpose: "Verify that a realistic promotion traverses the real AI, full-corpus retrieval, grounded evaluation and deterministic validation workflow.",
  reviewerQualification: "Engineering smoke-test design; not an FCA compliance SME opinion.",
  requiresSmeReview: true,
  smeReviewBoundary: "An FCA compliance SME must validate the expected regulatory evidence and outcome labels before these cases can support external accuracy claims.",
});

const evidenceGroup = (id, description, acceptedCitations) => Object.freeze({
  id,
  description,
  acceptedCitations: Object.freeze([...acceptedCitations]),
});

const define = (definition) => Object.freeze({
  audience: "uk_retail",
  jurisdiction: "UK_FCA",
  expectedReviewerDecision: "pending",
  ...definition,
  acceptedRecommendations: Object.freeze([...definition.acceptedRecommendations]),
  expectedPrincipalSourcebooks: Object.freeze([...definition.expectedPrincipalSourcebooks]),
  evidenceGroups: Object.freeze([...definition.evidenceGroups]),
});

export const FCA_END_TO_END_SMOKE_CASES = Object.freeze([
  define({
    id: "investment-guarantee-paraphrase",
    description: "Obvious investment protection and assured-return claim expressed without the Handbook's exact wording.",
    promotion: "Receive an assured 12% each year and your money remains fully protected.",
    product: "investments",
    channel: "email",
    acceptedRecommendations: ["block"],
    expectedPrincipalSourcebooks: ["COBS"],
    evidenceGroups: [
      evidenceGroup(
        "guarantee-and-protection-wording",
        "Restrictions on guaranteed, protected, secure or similar investment wording.",
        ["COBS 4.2.5 G"],
      ),
    ],
  }),
  define({
    id: "credit-monthly-payment-and-cashback",
    description: "One promotion containing both a monthly credit-cost claim and an application incentive, without the triggered representative information.",
    promotion: "Drive away today for only £199 a month — plus £500 cashback when you apply online.",
    product: "consumer_credit",
    channel: "social",
    acceptedRecommendations: ["revise", "block"],
    expectedPrincipalSourcebooks: ["CONC"],
    evidenceGroups: [
      evidenceGroup(
        "credit-cost-trigger",
        "A stated amount relating to the cost of credit triggers additional information.",
        ["CONC 3.5.3 R"],
      ),
      evidenceGroup(
        "representative-example-contents",
        "The representative example must contain the prescribed information.",
        ["CONC 3.5.5 R"],
      ),
      evidenceGroup(
        "cashback-incentive",
        "An incentive to apply for credit triggers representative APR and prominence requirements.",
        ["CONC 3.5.7 R"],
      ),
    ],
  }),
  define({
    id: "balanced-investment-invitation",
    description: "A self-contained, restrained fund description with charges and explicit downside-risk wording but no guarantee, comparison or performance claim.",
    promotion: "Explore the Northstar Balanced Fund. It invests 60% in UK and global equities and 40% in investment-grade bonds. The fund's annual management charge is 0.75%. The fund does not charge an entry or exit fee. The value of investments can fall as well as rise, and you may get back less than you invest.",
    product: "investments",
    channel: "website",
    acceptedRecommendations: ["recommended"],
    expectedPrincipalSourcebooks: ["COBS"],
    evidenceGroups: [
      evidenceGroup(
        "fair-clear-not-misleading",
        "The governing fair, clear and not misleading rule.",
        ["COBS 4.2.1 R"],
      ),
      evidenceGroup(
        "capital-at-risk",
        "Guidance that a promotion should make capital-at-risk status clear.",
        ["COBS 4.2.4 G"],
      ),
    ],
  }),
]);

