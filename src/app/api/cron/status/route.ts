import { NextResponse } from "next/server";

import { getSystemStats } from "@/lib/db/queries";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(): Promise<Response> {
  try {
    const stats = await getSystemStats();

    return NextResponse.json(
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        database: {
          totalHackathons: stats.total,
          embedded: stats.embedded,
          pendingEmbedding: stats.pending,
          embeddingCoveragePercent: Math.round(stats.embeddingCoverage * 1000) / 10,
          latestScrapedAt: stats.latestScrapedAt,
          platformDistribution: stats.platformDistribution,
        },
        crons: {
          scrape: {
            path: "/api/cron/scrape",
            schedule: "0 6 * * *",
            timezone: "UTC",
          },
          embed: {
            path: "/api/cron/embed",
            schedule: "0 7 * * *",
            timezone: "UTC",
          },
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("[cron/status] Failed to compute stats:", error);
    return NextResponse.json(
      {
        status: "degraded",
        timestamp: new Date().toISOString(),
        error: "Failed to compute system stats",
      },
      { status: 500 }
    );
  }
}
