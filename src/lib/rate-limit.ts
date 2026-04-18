import { NextResponse } from "next/server";

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

let didLogDistributedLimiterError = false;

export type RateLimitConfig = {
  key: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; response: Response };

type DistributedRateResult = {
  count: number;
  retryAfterSec: number;
};

function buildRateLimitExceededResponse(
  config: RateLimitConfig,
  retryAfterSec: number
): RateLimitResult {
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

function getDistributedWindowState(windowMs: number, now: number) {
  const safeWindowMs = Math.max(1_000, windowMs);
  const windowStart = Math.floor(now / safeWindowMs) * safeWindowMs;
  const resetAt = windowStart + safeWindowMs;
  const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1_000));

  return {
    safeWindowMs,
    windowStart,
    retryAfterSec,
  };
}

async function incrementDistributedCounter(
  config: RateLimitConfig,
  now: number
): Promise<DistributedRateResult | null> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const { safeWindowMs, windowStart, retryAfterSec } = getDistributedWindowState(
    config.windowMs,
    now
  );

  const key = `ratelimit:${config.key}:${windowStart}`;
  const encodedKey = encodeURIComponent(key);
  const baseUrl = UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
  };

  try {
    const incrResponse = await fetch(`${baseUrl}/incr/${encodedKey}`, {
      method: "POST",
      headers,
      cache: "no-store",
    });

    if (!incrResponse.ok) {
      throw new Error(`Upstash INCR failed with status ${incrResponse.status}`);
    }

    const incrPayload = (await incrResponse.json()) as { result?: number };
    const count = Number(incrPayload.result);

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("Upstash INCR returned an invalid counter value");
    }

    // Set TTL only on first hit of the window key.
    if (count === 1) {
      const ttlSec = Math.max(1, Math.ceil(safeWindowMs / 1_000));

      const expireResponse = await fetch(
        `${baseUrl}/expire/${encodedKey}/${ttlSec}`,
        {
          method: "POST",
          headers,
          cache: "no-store",
        }
      );

      if (!expireResponse.ok) {
        throw new Error(`Upstash EXPIRE failed with status ${expireResponse.status}`);
      }
    }

    return {
      count,
      retryAfterSec,
    };
  } catch (error) {
    if (!didLogDistributedLimiterError) {
      didLogDistributedLimiterError = true;
      console.error(
        "[rate-limit] Distributed limiter unavailable, falling back to in-memory limiter:",
        error
      );
    }

    return null;
  }
}

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

function checkRateLimitInMemory(
  config: RateLimitConfig,
  now = Date.now()
): RateLimitResult {
  const bucket = buckets.get(config.key) ?? { timestamps: [] };

  const windowStart = now - config.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= config.limit) {
    const oldest = bucket.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + config.windowMs - now) / 1_000));

    return buildRateLimitExceededResponse(config, retryAfterSec);
  }

  bucket.timestamps.push(now);
  buckets.set(config.key, bucket);
  sweepExpired(now);

  return { ok: true, remaining: config.limit - bucket.timestamps.length };
}

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const distributed = await incrementDistributedCounter(config, now);

  if (distributed) {
    if (distributed.count > config.limit) {
      return buildRateLimitExceededResponse(config, distributed.retryAfterSec);
    }

    return {
      ok: true,
      remaining: Math.max(0, config.limit - distributed.count),
    };
  }

  return checkRateLimitInMemory(config, now);
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
