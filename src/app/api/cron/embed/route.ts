import { NextResponse } from "next/server";

import { embedAllHackathons } from "@/lib/ai/embeddings";
import { translateAllUntranslated } from "@/lib/ai/translate";
import { validateCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  try {
    // 1. Translate new descriptions first (fast, small batches)
    console.info("[cron/embed] Starting translation pass.");
    const translateResult = await translateAllUntranslated(30);
    console.info(
      `[cron/embed] Translation done. processed=${translateResult.processed}, skipped=${translateResult.skipped}, failed=${translateResult.failed}.`
    );

    // 2. Generate embeddings for events that still lack them
    console.info("[cron/embed] Starting embedding pass.");
    const embedResult = await embedAllHackathons();
    console.info(
      `[cron/embed] Embedding done. processed=${embedResult.processed}, failed=${embedResult.failed}.`
    );

    return NextResponse.json({
      success: true,
      translate: translateResult,
      embed: embedResult,
    });
  } catch (error) {
    console.error("[cron/embed] Fatal error:", error);
    return NextResponse.json(
      { error: "Embed/translate cron job failed" },
      { status: 500 }
    );
  }
}
