import { ZodError } from "zod";
import { runReview } from "../lib/review-engine.js";

function write(res, event) {
  res.write(`${JSON.stringify(event)}\n`);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.statusCode = 405;
    write(res, { type: "error", message: "Only POST is supported." });
    return res.end();
  }

  try {
    const result = await runReview(req.body, (stage) =>
      write(res, { type: "stage", stage }),
    );
    write(res, { type: "result", result });
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === "number"
        ? error.statusCode
        : typeof error?.status === "number"
          ? error.status
          : null;
    const diagnosticCode =
      statusCode === 401 || statusCode === 403
        ? "gateway_authentication_failed"
        : statusCode === 402
          ? "gateway_budget_unavailable"
          : statusCode === 404
            ? "gateway_model_unavailable"
            : statusCode === 429
              ? "gateway_rate_limited"
              : error instanceof ZodError
                ? "invalid_submission"
                : "grounded_review_failed";

    console.error("[finprom-review]", {
      diagnosticCode,
      statusCode,
      name: error?.name,
      message: error?.message,
    });
    res.statusCode = error instanceof ZodError ? 400 : 500;
    write(res, {
      type: "error",
      code: diagnosticCode,
      message:
        error instanceof ZodError
          ? "Check the promotion text and submission context before retrying."
          : `The grounded review could not be completed (${diagnosticCode}). No uncited conclusion has been shown.`,
    });
  }
  return res.end();
}

