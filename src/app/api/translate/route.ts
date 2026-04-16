import { NextResponse } from "next/server";
import { z } from "zod";

import { getHackathonById, updateTranslation } from "@/lib/db/queries";

export const runtime = "nodejs";

if (!process.env.FIREWORKS_API_KEY) {
  throw new Error(
    "Missing FIREWORKS_API_KEY environment variable. Create one at https://fireworks.ai"
  );
}

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY || "";
const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";

const FIREWORKS_TRANSLATE_MODEL =
  process.env.FIREWORKS_TRANSLATE_MODEL?.trim() ||
  process.env.FIREWORKS_MODEL?.trim() ||
  "accounts/fireworks/models/deepseek-v3p2";

const fireworksTranslateResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
        }),
      })
    )
    .min(1),
});

const translateRequestSchema = z.object({
  hackathonId: z.number().int().positive(),
  description: z.string().trim().min(1),
  targetLanguage: z.string().trim().min(2).max(20).default("es"),
});

function isProviderRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /429|rate\s*limit|quota|resource_exhausted/i.test(message);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function translateWithFireworks(
  description: string,
  targetLanguage: string
): Promise<string> {
  const prompt = `Resume y traduce al ${targetLanguage} en maximo 2 oraciones.\nTexto:\n"${description}"\nDevuelve solo el resultado final, sin comillas ni explicaciones.`;

  const response = await fetch(`${FIREWORKS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIREWORKS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: FIREWORKS_TRANSLATE_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres un traductor y resumidor preciso. Respondes solo con el texto final solicitado.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 200,
      temperature: 0.2,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Fireworks request failed with status ${response.status}: ${body || "No details"}`
    );
  }

  const json = await response.json();
  const parsed = fireworksTranslateResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error("Unexpected Fireworks response shape for translation.");
  }

  const translated = parsed.data.choices[0]?.message.content?.trim();
  if (!translated) {
    throw new Error("Translation provider returned an empty translation.");
  }

  return translated;
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.json().catch(() => null);
  const parsedBody = translateRequestSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsedBody.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const { hackathonId, description, targetLanguage } = parsedBody.data;

  try {
    const hackathon = await getHackathonById(hackathonId);
    if (!hackathon) {
      return NextResponse.json({ error: "Hackathon not found" }, { status: 404 });
    }

    const cached = hackathon.desc_translated?.trim();
    if (cached) {
      return NextResponse.json({ translated: cached, cached: true });
    }

    const translated = await translateWithFireworks(description, targetLanguage);

    await updateTranslation(hackathonId, translated);

    return NextResponse.json({ translated, cached: false });
  } catch (error) {
    if (isProviderRateLimitError(error)) {
      return NextResponse.json(
        {
          error: "Translation rate limit reached. Intenta nuevamente en un momento.",
        },
        { status: 429 }
      );
    }

    console.error("[api/translate] Failed:", error);
    return NextResponse.json(
      {
        error: "Failed to translate description",
        details: toErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
