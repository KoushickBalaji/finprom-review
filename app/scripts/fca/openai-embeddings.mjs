const DEFAULT_ENDPOINT = "https://api.openai.com/v1/embeddings";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1_000;
  return Math.min(30_000, 750 * (2 ** attempt)) + Math.floor(Math.random() * 250);
}

export async function createOpenAIEmbeddings({
  apiKey,
  inputs,
  model = "text-embedding-3-small",
  dimensions = 1536,
  endpoint = DEFAULT_ENDPOINT,
  maxRetries = 8,
  signal,
}) {
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for corpus embedding");
  if (!inputs.length) return { embeddings: [], usage: { prompt_tokens: 0, total_tokens: 0 } };

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, dimensions, encoding_format: "float", input: inputs }),
      signal,
    });
    if (response.ok) {
      const payload = await response.json();
      const ordered = [...payload.data].sort((a, b) => a.index - b.index);
      if (ordered.length !== inputs.length) {
        throw new Error(`Embedding API returned ${ordered.length} vectors for ${inputs.length} inputs`);
      }
      return {
        embeddings: ordered.map((item) => item.embedding),
        usage: payload.usage ?? { prompt_tokens: 0, total_tokens: 0 },
      };
    }

    const retryable = response.status === 429 || response.status >= 500;
    const body = await response.text();
    if (!retryable || attempt === maxRetries) {
      throw new Error(`Embedding API ${response.status}: ${body.slice(0, 500)}`);
    }
    await wait(retryDelay(response, attempt));
  }
  throw new Error("Embedding request exhausted retries");
}

export function vectorToBlob(vector) {
  return Buffer.from(new Float32Array(vector).buffer);
}

export function vectorNorm(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

