import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPLICABILITY_ROUTER_VERSION,
  buildApplicabilityRoute,
  filterRecordsForRoute,
  matchingRouteLanes,
  recordMatchesRoute,
  referenceTargetIsEligible,
} from "../lib/applicability-router.js";
import { rulesForProduct } from "../lib/regulatory-pack.js";
import {
  FCA_PRODUCTS,
  FCA_PRODUCT_GROUPS,
} from "../shared/fca-product-registry.js";

const context = (product) => ({
  product,
  channel: "social",
  audience: "uk_retail",
  jurisdiction: "UK_FCA",
});

test("routes each submitted product into a principal lane plus shared overlays", () => {
  for (const product of FCA_PRODUCTS) {
    const route = buildApplicabilityRoute(context(product.id));
    assert.equal(route.version, APPLICABILITY_ROUTER_VERSION);
    assert.deepEqual(route.principalSourcebooks, product.principalSourcebooks);
    assert.deepEqual(route.lanes.map(({ kind }) => kind), ["principal", "shared", "shared"]);
    assert.equal(route.guardrails.allowWholeCorpusFallback, false);
    assert.equal(route.guardrails.requireSameScopeForLexicalAndSemantic, true);
  }
});

test("the registry has unique grouped products and only known FCA sourcebooks", () => {
  const ids = FCA_PRODUCTS.map(({ id }) => id);
  const groupIds = new Set(FCA_PRODUCT_GROUPS.map(({ id }) => id));
  const knownSourcebooks = new Set([
    "ATCS", "BCOBS", "CMCOB", "COBS", "COLL", "CONC", "CREDS",
    "DISC", "ESG", "FPCOB", "FUND", "ICOBS", "MCOB", "PDCOB", "PROD",
  ]);
  assert.equal(new Set(ids).size, ids.length);
  for (const product of FCA_PRODUCTS) {
    assert.equal(groupIds.has(product.group), true);
    assert.ok(product.principalSourcebooks.length > 0);
    assert.ok(product.principalSourcebooks.every((sourcebook) => knownSourcebooks.has(sourcebook)));
  }
});

test("multi-sourcebook products retain every Handbook lane", () => {
  assert.deepEqual(
    buildApplicabilityRoute(context("structured_deposits")).principalSourcebooks,
    ["BCOBS", "COBS", "DISC"],
  );
  assert.deepEqual(
    buildApplicabilityRoute(context("credit_union_lending")).principalSourcebooks,
    ["CREDS", "CONC"],
  );
});

test("includes targeted cross-cutting sections without opening whole sourcebooks", () => {
  const route = buildApplicabilityRoute(context("mortgages"));
  assert.equal(recordMatchesRoute({ sourcebook: "MCOB" }, route), true);
  assert.equal(recordMatchesRoute({ sourcebook: "COBS" }, route), false);
  assert.deepEqual(
    matchingRouteLanes({ sourcebook: "PRIN", section: "PRIN 2A.5 Consumer understanding" }, route),
    ["consumer-duty-communications"],
  );
  assert.equal(recordMatchesRoute({ sourcebook: "PRIN", section: "PRIN 2A.4 Price and value" }, route), false);
  assert.deepEqual(
    matchingRouteLanes({ sourcebook: "GEN", section: "GEN 4.5 Statements about authorisation" }, route),
    ["general-status-and-branding"],
  );
  assert.equal(recordMatchesRoute({ sourcebook: "GEN", section: "GEN 2.2 Interpreting the Handbook" }, route), false);
});

test("filters lexical and semantic candidates through one route contract", () => {
  const route = buildApplicabilityRoute(context("consumer_credit"));
  const records = [
    { id: "conc", sourcebook: "CONC" },
    { id: "mcob", sourcebook: "MCOB" },
    { id: "duty", sourcebook: "PRIN", section: "PRIN 2A.5 Consumer understanding" },
    { id: "unrelated-prin", sourcebook: "PRIN", section: "PRIN 2A.4 Price and value" },
    { id: "status", sourcebook: "GEN", section: "GEN 4.5 Statements about authorisation" },
  ];
  assert.deepEqual(
    filterRecordsForRoute(records, route).map(({ id }) => id),
    ["conc", "duty", "status"],
  );
});

test("permits bounded cross-sourcebook expansion only inside the same snapshot", () => {
  const route = buildApplicabilityRoute(context("investments"));
  const seed = { snapshotId: "fca-handbook-2026-08-30" };
  assert.equal(referenceTargetIsEligible({
    seed,
    route,
    target: {
      snapshotId: "fca-handbook-2026-08-30",
      sourcebook: "GEN",
      retrieval: { eligibility: "substantive" },
    },
  }), true);
  assert.equal(referenceTargetIsEligible({
    seed,
    route,
    target: {
      snapshotId: "fca-handbook-2026-08-29",
      sourcebook: "GEN",
      retrieval: { eligibility: "substantive" },
    },
  }), false);
  assert.equal(referenceTargetIsEligible({
    seed,
    route,
    target: {
      snapshotId: "fca-handbook-2026-08-30",
      retrieval: { eligibility: "discovery-only" },
    },
  }), false);
});

test("fails closed for an unsupported route instead of widening the corpus", () => {
  assert.throws(
    () => buildApplicabilityRoute(context("insurance")),
    /Unsupported product route/,
  );
});

test("the current demo pack is now hard-filtered to the submitted product", () => {
  const expected = {
    investments: "COBS",
    consumer_credit: "CONC",
    mortgages: "MCOB",
  };
  for (const [product, sourcebook] of Object.entries(expected)) {
    const rules = rulesForProduct(product);
    assert.ok(rules.length > 0);
    assert.ok(rules.every((rule) => rule.sourcebook === sourcebook));
  }
});

