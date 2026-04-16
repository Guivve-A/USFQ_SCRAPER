import { NextResponse } from "next/server";
import { z } from "zod";

import { searchHackathons } from "@/lib/ai/search";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const SEARCH_RATE_LIMIT = 20;
const SEARCH_WINDOW_MS = 60_000;
const MAX_QUERY_LENGTH = 200;

const searchSchema = z.object({
  q: z.string().trim().min(1, "Query is required").max(MAX_QUERY_LENGTH),
  online: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  platform: z.enum(["devpost", "mlh", "eventbrite", "luma", "gdg"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `search:${ip}`,
    limit: SEARCH_RATE_LIMIT,
    windowMs: SEARCH_WINDOW_MS,
  });
  if (!rate.ok) return rate.response;

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    online: url.searchParams.get("online") ?? undefined,
    platform: url.searchParams.get("platform") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return NextResponse.json(
      { error: "Invalid query parameters", issues },
      { status: 400 }
    );
  }

  const { q, online, platform, limit } = parsed.data;

  try {
    const results = await searchHackathons({ query: q, online, platform, limit });
    return NextResponse.json({ count: results.length, results });
  } catch (error) {
    console.error("[api/search] Failed:", error);
    return NextResponse.json(
      { error: "Failed to perform semantic search" },
      { status: 500 }
    );
  }
}
