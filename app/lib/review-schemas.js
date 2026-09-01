import { z } from "zod";
import { FCA_PRODUCT_IDS } from "../shared/fca-product-registry.js";

export const productSchema = z.enum(FCA_PRODUCT_IDS);

export const channelSchema = z.enum(["website", "social", "email"]);

export const requestSchema = z.object({
  promotion: z.string().trim().min(12).max(5000),
  product: productSchema,
  channel: channelSchema,
  audience: z.literal("uk_retail").default("uk_retail"),
  jurisdiction: z.literal("UK_FCA").default("UK_FCA"),
});

export const extractionSchema = z.object({
  contextAssessment: z.object({
    status: z.enum(["consistent", "possible_mismatch"]),
    observedSignals: z.array(z.string()).max(8),
    candidateProducts: z.array(productSchema).max(8),
    explanation: z.string(),
  }),
  claims: z
    .array(
      z.object({
        id: z.string(),
        exactText: z.string(),
        kind: z.enum([
          "factual",
          "quantified",
          "comparative",
          "guarantee",
          "incentive",
          "invitation",
          "risk_statement",
          "other",
        ]),
        assertion: z.string(),
        searchConcepts: z.array(z.string()).max(8),
      }),
    )
    .min(1)
    .max(12),
  presentDisclosures: z.array(z.string()).max(12),
  possibleOmissionTopics: z.array(z.string()).max(12),
});

export const evaluationSchema = z.object({
  reviewStatus: z.enum([
    "complete",
    "context_mismatch",
    "insufficient_grounding",
  ]),
  summary: z.string(),
  assumptions: z.array(z.string()).max(10),
  findings: z
    .array(
      z.object({
        id: z.string(),
        promoQuote: z.string(),
        result: z.enum(["meets", "revise", "block", "cannot_determine"]),
        issueType: z.enum([
          "wording",
          "balance",
          "prominence",
          "omission",
          "substantiation",
          "none",
        ]),
        ruleIds: z.array(z.string()).min(1).max(4),
        explanation: z.string(),
        requiredAction: z.string().nullable(),
        substantiationStatus: z.enum(["reviewer_to_verify", "not_required"]),
        disclosureStatus: z.enum(["present", "missing", "not_applicable"]),
        suggestedRewrite: z.string().nullable(),
      }),
    )
    .min(1)
    .max(10),
  limitations: z.array(z.string()).max(8),
});

