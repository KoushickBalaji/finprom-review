import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function localReviewApi() {
  return {
    name: "local-review-api",
    configureServer(server) {
      server.middlewares.use("/api/review", async (request, response) => {
        if (request.method !== "POST") {
          response.statusCode = 405;
          return response.end();
        }
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
        try {
          const { runReview } = await import("./lib/review-engine.js");
          const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const result = await runReview(input, (stage) =>
            response.write(`${JSON.stringify({ type: "stage", stage })}\n`),
          );
          response.write(`${JSON.stringify({ type: "result", result })}\n`);
        } catch (error) {
          response.statusCode = 500;
          response.write(`${JSON.stringify({ type: "error", message: error.message })}\n`);
        }
        response.end();
      });
    },
  };
}

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), localReviewApi()],
});

