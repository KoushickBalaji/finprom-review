import {
  FCA_PRODUCT_IDS,
  PRODUCT_LABELS,
  PRODUCT_SOURCEBOOKS,
} from "../shared/fca-product-registry.js";

export const APPLICABILITY_ROUTER_VERSION = "fca-applicability-v1.1.0";
export { PRODUCT_SOURCEBOOKS };

const SHARED_LANES = Object.freeze([
  Object.freeze({
    id: "consumer-duty-communications",
    kind: "shared",
    purpose: "Retail financial-promotion application, cross-cutting duties and consumer understanding.",
    weight: 0.85,
    selectors: Object.freeze([
      Object.freeze({
        sourcebook: "PRIN",
        sectionPrefixes: Object.freeze(["PRIN 2A.1", "PRIN 2A.2", "PRIN 2A.5", "PRIN 3.2"]),
      }),
    ]),
  }),
  Object.freeze({
    id: "general-status-and-branding",
    kind: "shared",
    purpose: "Generally applicable authorisation/status statements and FCA-logo controls.",
    weight: 0.65,
    selectors: Object.freeze([
      Object.freeze({
        sourcebook: "GEN",
        sectionPrefixes: Object.freeze(["GEN 4.5", "GEN 5.1"]),
      }),
    ]),
  }),
]);

const allowedProducts = new Set(FCA_PRODUCT_IDS);
const allowedChannels = new Set(["website", "social", "email"]);

function startsWithBoundary(value, prefix) {
  if (!value || !prefix) return false;
  return value === prefix || value.startsWith(`${prefix} `) || value.startsWith(`${prefix}.`);
}

export function recordMatchesSelector(record, selector) {
  if (selector.sourcebook && record.sourcebook !== selector.sourcebook) return false;
  if (selector.module && record.module !== selector.module) return false;
  if (selector.chapterPrefixes?.length && !selector.chapterPrefixes.some((prefix) =>
    startsWithBoundary(record.chapter, prefix))) return false;
  if (selector.sectionPrefixes?.length && !selector.sectionPrefixes.some((prefix) =>
    startsWithBoundary(record.section, prefix))) return false;
  if (selector.provisionPrefixes?.length && !selector.provisionPrefixes.some((prefix) =>
    startsWithBoundary(record.provisionName, prefix))) return false;
  return true;
}

export function matchingRouteLanes(record, route) {
  return route.lanes
    .filter((lane) => lane.selectors.some((selector) => recordMatchesSelector(record, selector)))
    .map((lane) => lane.id);
}

export function recordMatchesRoute(record, route) {
  return matchingRouteLanes(record, route).length > 0;
}

export function filterRecordsForRoute(records, route) {
  return records.filter((record) => recordMatchesRoute(record, route));
}

export function buildApplicabilityRoute({
  product,
  channel,
  audience = "uk_retail",
  jurisdiction = "UK_FCA",
}) {
  if (!allowedProducts.has(product)) throw new Error(`Unsupported product route: ${product}`);
  if (!allowedChannels.has(channel)) throw new Error(`Unsupported channel route: ${channel}`);
  if (audience !== "uk_retail") throw new Error(`Unsupported audience route: ${audience}`);
  if (jurisdiction !== "UK_FCA") throw new Error(`Unsupported jurisdiction route: ${jurisdiction}`);

  const principalSourcebooks = [...PRODUCT_SOURCEBOOKS[product]];
  const principalLane = {
    id: `principal-${product}`,
    kind: "principal",
    purpose: `${PRODUCT_LABELS[product]} product-specific conduct and financial-promotion requirements.`,
    weight: 1,
    selectors: principalSourcebooks.map((sourcebook) => ({ sourcebook })),
  };

  return {
    version: APPLICABILITY_ROUTER_VERSION,
    scopeId: `${APPLICABILITY_ROUTER_VERSION}:${jurisdiction}:${audience}:${product}`,
    inputContext: { product, channel, audience, jurisdiction },
    principalSourcebooks,
    lanes: [principalLane, ...SHARED_LANES],
    referenceExpansion: {
      enabled: true,
      direction: "outgoing",
      source: "canonical-handbook-cross-references",
      maximumDepth: 1,
      maximumTargetsPerSeed: 6,
      mayCrossSourcebook: true,
      requireSameSnapshot: true,
      allowedEligibility: ["substantive"],
    },
    guardrails: {
      allowWholeCorpusFallback: false,
      requireSameScopeForLexicalAndSemantic: true,
      mismatchAction: "withhold-and-route-to-reviewer",
      unknownProductAction: "fail-closed",
    },
  };
}

export function referenceTargetIsEligible({ seed, target, route }) {
  if (!route.referenceExpansion.enabled) return false;
  if (route.referenceExpansion.requireSameSnapshot && seed.snapshotId !== target.snapshotId) return false;
  const eligibility = target.retrieval?.eligibility ?? "substantive";
  return route.referenceExpansion.allowedEligibility.includes(eligibility);
}

