import { getHackathonsWithoutTranslation, updateTranslation } from "@/lib/db/queries";

const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2_000;
const REQUEST_TIMEOUT_MS = 20_000;

export type TranslateAllResult = {
  processed: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function getFireworksKey(): string {
  const key = process.env.FIREWORKS_API_KEY;
  if (!key) throw new Error("Missing FIREWORKS_API_KEY");
  return key;
}

function getModel(): string {
  return (
    process.env.FIREWORKS_TRANSLATE_MODEL?.trim() ||
    process.env.FIREWORKS_MODEL?.trim() ||
    "accounts/fireworks/models/deepseek-v3p2"
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateOne(description: string): Promise<string> {
  const prompt = `Resume y traduce al español en máximo 2 oraciones.\nTexto:\n"${description}"\nDevuelve solo el resultado final, sin comillas ni explicaciones.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getFireworksKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "Eres un traductor y resumidor preciso. Respondes solo con el texto final solicitado.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.2,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Fireworks ${response.status}: ${body || "no details"}`);
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
    const translated = json.choices?.[0]?.message?.content?.trim();
    if (!translated) throw new Error("Empty translation response");
    return translated;
  } finally {
    clearTimeout(timer);
  }
}

export async function translateAllUntranslated(
  limit = 30
): Promise<TranslateAllResult> {
  const pending = await getHackathonsWithoutTranslation(limit);

  if (pending.length === 0) {
    console.info("[translate] No hackathons pending translation.");
    return { processed: 0, skipped: 0, failed: 0, errors: [] };
  }

  console.info(`[translate] Translating ${pending.length} hackathons in batches of ${BATCH_SIZE}.`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let start = 0; start < pending.length; start += BATCH_SIZE) {
    const batch = pending.slice(start, start + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (hackathon) => {
        const desc = hackathon.description!;

        // Skip if it looks like it's already in Spanish
        const spanishRatio = (desc.match(/[áéíóúüñ¿¡]/gi) ?? []).length / desc.length;
        if (spanishRatio > 0.02) {
          skipped += 1;
          return;
        }

        const translated = await translateOne(desc.slice(0, 800));
        await updateTranslation(Number(hackathon.id), translated);
      })
    );

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (result.status === "fulfilled") {
        processed += 1;
      } else {
        failed += 1;
        const msg = result.reason instanceof Error ? result.reason.message : "Unknown";
        errors.push(`id=${batch[i].id}: ${msg}`);
        console.error(`[translate] Failed id=${batch[i].id}: ${msg}`);
      }
    }

    console.info(`[translate] ${processed} translated, ${skipped} skipped, ${failed} failed.`);

    if (start + BATCH_SIZE < pending.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  return { processed, skipped, failed, errors };
}
