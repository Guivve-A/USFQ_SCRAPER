import { NextResponse } from "next/server";
import { z } from "zod";

import { searchHackathons } from "@/lib/ai/search";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { SCOPE_VALUES, type Scope } from "@/lib/region";
import { createSanitizedTextSchema } from "@/lib/security/input";

export const runtime = "nodejs";

const SEARCH_RATE_LIMIT = 20;
const SEARCH_WINDOW_MS = 60_000;
const MAX_QUERY_LENGTH = 500;
const MAX_REQUEST_URL_CHARS = 2_048;

const searchSchema = z.object({
  q: createSanitizedTextSchema(MAX_QUERY_LENGTH, {
    requiredMessage: "Query is required",
    maxMessage: `Query must be at most ${MAX_QUERY_LENGTH} characters`,
  }),
  online: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  platform: z
    .enum(["devpost", "mlh", "eventbrite", "luma", "gdg", "lablab"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  scope: z.enum(SCOPE_VALUES as unknown as [string, ...string[]]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `search:${ip}`,
    limit: SEARCH_RATE_LIMIT,
    windowMs: SEARCH_WINDOW_MS,
  });
  if (!rate.ok) return rate.response;

  if (request.url.length > MAX_REQUEST_URL_CHARS) {
    return NextResponse.json(
      { error: "Request URL too long" },
      { status: 414 }
    );
  }

  const url = new URL(request.url);
  const parsed = searchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    online: url.searchParams.get("online") ?? undefined,
    platform: url.searchParams.get("platform") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
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

  const { q, online, platform, limit, scope } = parsed.data;

  try {
    const results = await searchHackathons({
      query: q,
      online,
      platform,
      limit,
      scope: scope as Scope | undefined,
    });
    return NextResponse.json({ count: results.length, results });
  } catch (error) {
    console.error("[api/search] Failed:", error);
    return NextResponse.json(
      { error: "Failed to perform semantic search" },
      { status: 500 }
    );
  }
}
