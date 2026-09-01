import { buildApplicabilityRoute } from "../../lib/applicability-router.js";
import { retrieveFullCorpusEvidence } from "../../lib/full-corpus-retrieval.js";
import { FCA_PRODUCT_IDS, PRODUCT_LABELS } from "../../shared/fca-product-registry.js";

const all = process.argv.includes("--all");
const product = process.argv[2] && process.argv[2] !== "--all" ? process.argv[2] : "consumer_credit";
const products = all ? FCA_PRODUCT_IDS : [product];
const query = process.argv.slice(all ? 3 : 3).join(" ") || "financial promotion fair clear not misleading";
const results = [];

for (const productId of products) {
  const route = buildApplicabilityRoute({
    product: productId,
    channel: "website",
    audience: "uk_retail",
    jurisdiction: "UK_FCA",
  });
  const result = await retrieveFullCorpusEvidence({
    query: `${PRODUCT_LABELS[productId]} ${query}`,
    route,
  });
  results.push({
    product: productId,
    label: PRODUCT_LABELS[productId],
    sourcebooks: route.principalSourcebooks,
    evidence: result.evidence.map(({ id, sourcebook, section, lexicalRank, referenceExpansion }) => ({
      id,
      sourcebook,
      section,
      lexicalRank,
      referenceExpansion: referenceExpansion ?? null,
    })),
  });
}

console.log(JSON.stringify(results, null, 2));

