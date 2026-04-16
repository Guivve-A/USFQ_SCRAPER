import { HfInference } from "@huggingface/inference";

import {
  getHackathonsWithoutEmbedding,
  updateHackathonEmbedding,
} from "@/lib/db/queries";
import type { Hackathon } from "@/types/hackathon";

const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const EMBEDDING_DIMENSIONS = 384;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1_000;
const REQUEST_TIMEOUT_MS = 15_000;
const DESCRIPTION_CHAR_LIMIT = 400;

let _hfClient: HfInference | null = null;

function getHfClient(): HfInference {
  if (_hfClient) return _hfClient;

  const token = process.env.HF_TOKEN;
  if (!token) {
    throw new Error(
      "Missing HF_TOKEN environment variable. Create one at https://huggingface.co/settings/tokens"
    );
  }

  _hfClient = new HfInference(token);
  return _hfClient;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ");
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clean(value: string | null | undefined): string {
  if (!value) return "";
  return normalizeSpaces(stripHtml(value));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`HuggingFace request timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function flattenEmbedding(output: unknown): number[] {
  // Expected shapes: number[] (flat, already mean-pooled) or number[][] (per-token).
  if (Array.isArray(output) && output.length > 0 && typeof output[0] === "number") {
    return output as number[];
  }

  if (Array.isArray(output) && Array.isArray(output[0]) && typeof (output[0] as unknown[])[0] === "number") {
    const matrix = output as number[][];
    const cols = matrix[0].length;
    const sum = new Array<number>(cols).fill(0);
    for (const row of matrix) {
      for (let i = 0; i < cols; i += 1) sum[i] += row[i];
    }
    return sum.map((v) => v / matrix.length);
  }

  throw new Error("Unexpected embedding output shape from HuggingFace.");
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = normalizeSpaces(text);
  if (!input) {
    throw new Error("generateEmbedding received empty input text.");
  }

  const hf = getHfClient();

  const attempt = async (): Promise<number[]> => {
    const output = await withTimeout(
      hf.featureExtraction({ model: EMBEDDING_MODEL, inputs: input }),
      REQUEST_TIMEOUT_MS
    );
    const vec = flattenEmbedding(output);
    if (vec.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS} dims, got ${vec.length}. Model misconfiguration?`
      );
    }
    return vec;
  };

  try {
    return await attempt();
  } catch (err) {
    console.warn("[embeddings] First attempt failed, retrying once.", err);
    await sleep(500);
    return attempt();
  }
}

export function buildEmbeddingText(hackathon: Hackathon): string {
  const parts: string[] = [];

  const title = clean(hackathon.title);
  if (title) parts.push(title);

  const description = clean(hackathon.description).slice(0, DESCRIPTION_CHAR_LIMIT);
  if (description) parts.push(description);

  const tags = (hackathon.tags ?? [])
    .map((tag) => clean(tag))
    .filter((tag) => tag.length > 0)
    .join(", ");
  if (tags) parts.push(tags);

  const location = clean(hackathon.location);
  if (location) parts.push(location);

  parts.push(hackathon.is_online ? "online virtual remote" : "presencial in-person");

  const prize = clean(hackathon.prize_pool);
  if (prize) parts.push(prize);

  return parts.join(" | ");
}

export type EmbedAllResult = {
  processed: number;
  failed: number;
  errors: string[];
};

export async function embedAllHackathons(): Promise<EmbedAllResult> {
  const pending = await getHackathonsWithoutEmbedding();
  if (pending.length === 0) {
    console.info("[embeddings] No hackathons pending embedding.");
    return { processed: 0, failed: 0, errors: [] };
  }

  console.info(`[embeddings] Embedding ${pending.length} hackathons in batches of ${BATCH_SIZE}.`);

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (hackathon) => {
        const text = buildEmbeddingText(hackathon);
        const vec = await generateEmbedding(text);
        await updateHackathonEmbedding(Number(hackathon.id), vec);
        return hackathon.id;
      })
    );

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const h = batch[i];
      if (result.status === "fulfilled") {
        processed += 1;
      } else {
        failed += 1;
        const message =
          result.reason instanceof Error ? result.reason.message : "Unknown error";
        errors.push(`id=${h.id}: ${message}`);
        console.error(`[embeddings] Failed id=${h.id}: ${message}`);
      }
    }

    console.info(
      `[embeddings] Embedded ${processed}/${pending.length} (failed=${failed}).`
    );

    if (start + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { processed, failed, errors };
}
