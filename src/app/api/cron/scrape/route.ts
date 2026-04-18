import { NextResponse } from "next/server";

import { validateCronSecret } from "@/lib/auth";
import { runAllScrapers } from "@/lib/scrapers";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  try {
    console.info("[cron/scrape] Starting weekly scrape job.");
    const result = await runAllScrapers();

    console.info(
      `[cron/scrape] Done. total=${result.total}, inserted=${result.inserted}, updated=${result.updated}, deleted_stale=${result.deleted.stale}, deleted_expired=${result.deleted.expired}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/scrape] Fatal error:", error);
    return NextResponse.json(
      { error: "Scrape cron job failed" },
      { status: 500 }
    );
  }
}
