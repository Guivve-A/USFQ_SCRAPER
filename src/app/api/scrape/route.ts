import { runAllScrapers } from "@/lib/scrapers";

export const runtime = "nodejs";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Missing CRON_SECRET environment variable" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAllScrapers();
    return Response.json(result, { status: 200 });
  } catch (error) {
    const details = getErrorMessage(error);
    console.error("[api/scrape] Failed to run scrapers:", error);

    return Response.json(
      {
        error: "Failed to scrape hackathons",
        details,
      },
      { status: 500 }
    );
  }
}
