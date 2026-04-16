import { NextResponse } from "next/server";

import { embedAllHackathons } from "@/lib/ai/embeddings";
import { validateCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  try {
    console.info("[cron/embed] Starting daily embedding job.");
    const result = await embedAllHackathons();
    console.info(
      `[cron/embed] Done. processed=${result.processed}, failed=${result.failed}.`
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/embed] Fatal error:", error);
    return NextResponse.json(
      { error: "Embed cron job failed" },
      { status: 500 }
    );
  }
}
