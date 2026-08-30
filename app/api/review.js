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
    res.statusCode = error instanceof ZodError ? 400 : 500;
    write(res, {
      type: "error",
      message:
        error instanceof ZodError
          ? "Check the promotion text and submission context before retrying."
          : "The grounded review could not be completed. No uncited conclusion has been shown.",
    });
  }
  return res.end();
}

