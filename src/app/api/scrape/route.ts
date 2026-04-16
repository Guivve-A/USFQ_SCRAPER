import { NextResponse } from "next/server";

import { runAllScrapers } from "@/lib/scrapers";

export const runtime = "nodejs";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "Missing CRON_SECRET environment variable" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    console.log("Scraping iniciado con éxito");

    const result = await runAllScrapers();

    return NextResponse.json(
      {
        success: true,
        message: "Datos actualizados",
        ...result,
      },
      { status: 200 }
    );
  } catch (error) {
    const details = getErrorMessage(error);
    console.error("[api/scrape] Failed to run scrapers:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to scrape hackathons",
        details,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return GET(request);
}
