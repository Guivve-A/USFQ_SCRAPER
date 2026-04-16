import { NextResponse } from "next/server";

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; response: Response };

function sweepExpired(now: number): void {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.timestamps.length === 0) {
      buckets.delete(key);
    } else if (now - bucket.timestamps[bucket.timestamps.length - 1] > 60 * 60 * 1_000) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(config.key) ?? { timestamps: [] };

  const windowStart = now - config.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= config.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1_000));

    return {
      ok: false,
      response: NextResponse.json(
        { error: "Too many requests", retryAfter: retryAfterSec },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      ),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(config.key, bucket);
  sweepExpired(now);

  return { ok: true, remaining: config.limit - bucket.timestamps.length };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
