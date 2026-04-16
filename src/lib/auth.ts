import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function safeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type CronAuthResult =
  | { ok: true }
  | { ok: false; response: Response };

export function validateCronSecret(request: Request): CronAuthResult {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      ),
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (!safeCompare(header, expected)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  return { ok: true };
}
