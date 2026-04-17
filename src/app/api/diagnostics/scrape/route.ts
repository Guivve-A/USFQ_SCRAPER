import { NextResponse } from "next/server";

import { validateCronSecret } from "@/lib/auth";
import { runScrapersDiagnostics } from "@/lib/scrapers";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_MAX_DROPS = 250;

function parseBooleanParam(
  value: string | null,
  fallback: boolean
): boolean {
  if (value === null) {
    return fallback;
  }

  if (value === "1" || value.toLowerCase() === "true") {
    return true;
  }

  if (value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  return fallback;
}

function parseMaxDrops(value: string | null): number {
  if (!value) {
    return DEFAULT_MAX_DROPS;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_DROPS;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 2000);
}

export async function GET(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  const requestUrl = new URL(request.url);
  const includeDrops = parseBooleanParam(
    requestUrl.searchParams.get("includeDrops"),
    true
  );
  const maxDropsPerSource = parseMaxDrops(
    requestUrl.searchParams.get("maxDrops")
  );

  try {
    const diagnostics = await runScrapersDiagnostics({
      includeDrops,
      maxDropsPerSource,
    });

    return NextResponse.json({
      success: true,
      mode: "dry-run",
      runStartedAt: diagnostics.runStartedAt,
      totals: diagnostics.totals,
      errors: diagnostics.errors,
      sources: diagnostics.sources.map((source) => ({
        source: source.source,
        platform: source.platform,
        fetched: source.fetched,
        mapped: source.mapped,
        inserted: source.inserted,
        updated: source.updated,
        dropped: source.dropped,
        droppedByReason: source.droppedByReason,
        drops: source.drops,
      })),
    });
  } catch (error) {
    console.error("[api/diagnostics/scrape] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to compute scrape diagnostics" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
