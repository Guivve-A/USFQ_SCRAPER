import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { searchHackathons } from "@/lib/ai/search";

export const runtime = "nodejs";
export const maxDuration = 30;

if (!process.env.FIREWORKS_API_KEY) {
  throw new Error(
    "Missing FIREWORKS_API_KEY environment variable. Create one at https://fireworks.ai"
  );
}

const fireworks = createOpenAI({
  apiKey: process.env.FIREWORKS_API_KEY || "",
  baseURL: "https://api.fireworks.ai/inference/v1",
});

const FIREWORKS_MODEL =
  process.env.FIREWORKS_MODEL?.trim() ||
  "accounts/fireworks/models/deepseek-v3p2";

const chatRequestSchema = z.object({
  messages: z.array(z.object({}).passthrough()),
});

const searchHackathonsSchema = z.object({
  query: z.string().trim().min(1).describe("Descripcion semantica de lo que busca"),
  online: z.boolean().optional().describe("Filtrar solo online"),
  platform: z.enum(["devpost", "mlh", "eventbrite", "gdg"]).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

const translateDescriptionSchema = z.object({
  hackathonId: z.number().int().positive(),
  description: z.string().min(1),
});

const translateToolResponseSchema = z.object({
  translated: z.string(),
  cached: z.boolean(),
});

const SYSTEM_PROMPT = `Eres HackBot, un asistente experto en descubrir hackathons.
Ayudas a desarrolladores, disenadores y cientificos de datos a encontrar competencias relevantes.
Cuando el usuario busque eventos, usa SIEMPRE la herramienta searchHackathons antes de responder.
Presenta los resultados con: nombre, fecha, premios, link y una frase breve de por que es relevante.
Si el usuario escribe en espanol, responde en espanol.
Si escribe en ingles, responde en ingles.
Se entusiasta pero conciso.
Maximo 3-4 hackathons por respuesta a menos que el usuario pida mas.`;

function formatStreamError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/429|rate\s*limit|quota|resource_exhausted/i.test(message)) {
    return "Estoy recibiendo muchas solicitudes en este momento. Dame un momento e intenta nuevamente en unos segundos.";
  }

  return "Ocurrio un error procesando tu solicitud. Intenta nuevamente.";
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function normalizeIncomingMessages(
  messages: Array<Record<string, unknown>>
): Array<Omit<UIMessage, "id">> {
  return messages.map((message) => {
    const withoutId = Object.fromEntries(
      Object.entries(message).filter(([key]) => key !== "id")
    );

    const maybeParts = (withoutId as { parts?: unknown }).parts;
    if (Array.isArray(maybeParts)) {
      return withoutId as Omit<UIMessage, "id">;
    }

    const maybeContent = (withoutId as { content?: unknown }).content;
    if (typeof maybeContent === "string") {
      const withoutContent = Object.fromEntries(
        Object.entries(withoutId).filter(([key]) => key !== "content")
      );

      return {
        ...withoutContent,
        parts: [{ type: "text", text: maybeContent }],
      } as Omit<UIMessage, "id">;
    }

    return withoutId as Omit<UIMessage, "id">;
  });
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.json().catch(() => null);
  const parsedBody = chatRequestSchema.safeParse(rawBody);

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

  const { messages } = parsedBody.data;
  const origin = new URL(request.url).origin;

  const tools = {
    searchHackathons: tool({
      description:
        "Busca hackathons en la base de datos por descripcion semantica. Usala cuando el usuario mencione buscar hackathons, eventos, competencias o pida recomendaciones.",
      inputSchema: searchHackathonsSchema,
      execute: async ({ query, online, platform, limit }) => {
        const results = await searchHackathons({
          query,
          online,
          platform,
          limit,
        });

        return results.map((hackathon) => ({
          hackathonId: Number(hackathon.id),
          name: hackathon.title,
          startDate: hackathon.start_date,
          deadline: hackathon.deadline,
          prize: hackathon.prize_pool,
          link: hackathon.url,
          platform: hackathon.platform,
          online: hackathon.is_online,
          relevance: Number(hackathon.similarity.toFixed(3)),
          description: hackathon.desc_translated ?? hackathon.description,
        }));
      },
    }),
    translateDescription: tool({
      description: "Traduce y resume la descripcion de un hackathon al espanol",
      inputSchema: translateDescriptionSchema,
      execute: async ({ hackathonId, description }) => {
        const response = await fetch(`${origin}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hackathonId,
            description,
            targetLanguage: "es",
          }),
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const details =
            payload && typeof payload === "object" && "error" in payload
              ? String(payload.error)
              : `status ${response.status}`;

          throw new Error(`translateDescription failed: ${details}`);
        }

        const payload = translateToolResponseSchema.parse(await response.json());
        return payload;
      },
    }),
  };

  try {
    const messagesWithoutIds = normalizeIncomingMessages(messages);

    const modelMessages = await convertToModelMessages(messagesWithoutIds, { tools });

    const result = streamText({
      model: fireworks(FIREWORKS_MODEL),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(3),
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: false,
      onError: (error) => {
        console.error("[api/chat] Stream error:", error);
        return formatStreamError(error);
      },
    });
  } catch (error) {
    console.error("[api/chat] Failed:", error);

    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: toErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
