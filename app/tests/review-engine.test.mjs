import test from "node:test";
import assert from "node:assert/strict";

// The deterministic fixture tests recommendation logic independently of the
// large, local-only Handbook index and paid model calls.
process.env.FCA_RETRIEVAL_MODE = "pack";
const { buildRetrievalQueries, deriveRecommendation, runReview } = await import("../lib/review-engine.js");

test("claim-level retrieval adds deterministic regulatory vocabulary without adding citations", () => {
  const queries = buildRetrievalQueries({
    promotion: "Apply online for £500 cashback.",
    product: "consumer_credit",
    extraction: {
      claims: [{
        id: "claim-1",
        exactText: "£500 cashback",
        kind: "incentive",
        assertion: "Applicants may receive cashback.",
        searchConcepts: ["cashback eligibility"],
      }],
      possibleOmissionTopics: [],
    },
  });
  assert.match(queries[0].query, /incentive to apply for credit/i);
  assert.match(queries[0].query, /representative APR/i);
  assert.doesNotMatch(queries[0].query, /CONC\s+3/i);
});

test("retrieval hypotheses cannot overrule an all-meets grounded evaluation", () => {
  const extraction = {
    claims: [{ id: "claim-1", exactText: "Clear scoped statement" }],
    possibleOmissionTopics: ["A speculative topic raised for retrieval"],
  };
  const evaluation = {
    reviewStatus: "complete",
    findings: [{
      promoQuote: "Clear scoped statement",
      result: "meets",
    }],
  };
  assert.equal(deriveRecommendation(evaluation, extraction), "recommended");
});

const cases = [
  ["block", "Earn a guaranteed 12% annual return with our investment bond. Your capital is completely secure.", "investments", "website"],
  ["revise", "Drive away today for only £199 a month — plus £500 cashback when you apply online.", "consumer_credit", "social"],
  ["block", "Switch to the UK’s cheapest mortgage and save £250 every month.", "mortgages", "website"],
  ["recommended", "Explore the Northstar Balanced Fund. The value of investments can fall as well as rise, and you may get back less than you invest. View the fund details and charges.", "investments", "website"],
  ["block", "Receive an assured 12% each year and your money remains fully protected.", "investments", "email"],
  ["revise", "Apply online for £500 cashback. Drive from just £199 monthly.", "consumer_credit", "social"],
  ["block", "Move to Britain’s lowest-priced mortgage and reduce your payments by £250 a month.", "mortgages", "website"],
  ["recommended", "Consider the Northstar fund. Investments may fall as well as rise and you could receive less than you put in. Charges and details are available here.", "investments", "website"],
  ["revise", "The fund targets a 12% annual return. Returns are not guaranteed and your capital is at risk.", "investments", "email"],
  ["recommended", "Drive away for £199 a month. Representative example: cash price £12,000, deposit £1,000, amount of credit £11,000, fixed interest rate 6.9% per annum, 48 monthly payments of £199, total amount payable £12,552, representative APR 6.9%.", "consumer_credit", "website"],
  ["recommended", "Based on our 30 August 2026 comparison of standard variable residential mortgages available direct from the 10 largest UK lenders, this mortgage has the lowest initial rate. Your home may be repossessed if you do not keep up repayments.", "mortgages", "website"],
  ["revise", "Finance your new car from only £249 a month with no deposit.", "investments", "website"],
  ["revise", "Unlimited loan amount instantly", "consumer_credit", "social"],
];

for (const [expected, promotion, product, channel] of cases) {
  test(`${expected}: ${promotion.slice(0, 34)}`, async () => {
    const result = await runReview({ promotion, product, channel, audience: "uk_retail", jurisdiction: "UK_FCA" });
    assert.equal(result.ok, true);
    assert.equal(result.recommendation, expected);
    for (const finding of result.findings) {
      assert.ok(promotion.toLowerCase().includes(finding.promoQuote.toLowerCase()));
      assert.ok(finding.citations.length > 0);
    }
  });
}

