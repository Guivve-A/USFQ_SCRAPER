import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  const { generateEmbedding } = await import("../lib/ai/embeddings");

  const sampleText =
    "AI hackathon online, 48 hours, $10k prize pool, machine learning and LLMs, remote teams welcome.";

  console.log("[test-embeddings] Sample text:", sampleText);
  console.log("[test-embeddings] Requesting embedding from HuggingFace...");

  const start = Date.now();
  const vector = await generateEmbedding(sampleText);
  const elapsedMs = Date.now() - start;

  console.log("[test-embeddings] Dimensions:", vector.length);
  console.log("[test-embeddings] First 5 values:", vector.slice(0, 5));
  console.log("[test-embeddings] Elapsed:", `${elapsedMs}ms`);

  if (vector.length !== 384) {
    throw new Error(
      `Expected 384 dimensions (all-MiniLM-L6-v2), got ${vector.length}.`
    );
  }

  console.log("[test-embeddings] OK — 384-dim vector generated successfully.");
}

main().catch((error: unknown) => {
  console.error("[test-embeddings] Failed:", error);
  process.exit(1);
});
