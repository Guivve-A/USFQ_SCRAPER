import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  createSanitizedTextSchema,
  parseJsonBodyWithLimit,
  RequestBodyParseError,
  RequestBodyTooLargeError,
  sanitizeInputText,
} from "@/lib/security/input";

export const runtime = "nodejs";

const SUGGESTIONS_RATE_LIMIT = 8;
const SUGGESTIONS_WINDOW_MS = 10 * 60_000;
const MAX_SUGGESTION_BODY_BYTES = 24 * 1024;

const optionalSanitizedTextSchema = (maxChars: number) =>
  z
    .preprocess(
      (value) => (typeof value === "string" ? sanitizeInputText(value) : value),
      z.string().max(maxChars).optional()
    )
    .transform((value) => (value && value.length > 0 ? value : undefined));

const suggestionSchema = z.object({
  title: createSanitizedTextSchema(180, {
    minChars: 4,
    requiredMessage: "Title is required",
    maxMessage: "Title must be at most 180 characters",
  }),
  url: z
    .preprocess(
      (value) => (typeof value === "string" ? sanitizeInputText(value) : value),
      z.string().url("Invalid URL").max(400, "URL must be at most 400 characters")
    ),
  description: createSanitizedTextSchema(3_000, {
    minChars: 12,
    requiredMessage: "Description is required",
    maxMessage: "Description must be at most 3000 characters",
  }),
  isOnline: z.boolean().optional().default(true),
  source: optionalSanitizedTextSchema(120),
  contactEmail: optionalSanitizedTextSchema(160).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    {
      message: "Invalid email",
    }
  ),
  website: z
    .preprocess(
      (value) => (typeof value === "string" ? sanitizeInputText(value) : value),
      z.string().optional()
    ),
});

const SPAM_PATTERNS = [
  /\b(casino|betting|viagra|porn|escort|loan offer|free money)\b/i,
  /(?:https?:\/\/){3,}/i,
  /(?:t\.me|telegram\.me|wa\.me|whatsapp\.com)\//i,
];

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isSpamLike(input: { title: string; description: string; source?: string }): boolean {
  const text = `${input.title}\n${input.description}\n${input.source ?? ""}`;
  return SPAM_PATTERNS.some((pattern) => pattern.test(text));
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = await checkRateLimit({
    key: `suggestions:${ip}`,
    limit: SUGGESTIONS_RATE_LIMIT,
    windowMs: SUGGESTIONS_WINDOW_MS,
  });
  if (!rate.ok) {
    return rate.response;
  }

  let rawBody: unknown;
  try {
    rawBody = await parseJsonBodyWithLimit(request, MAX_SUGGESTION_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        {
          error: "Request body too large",
          maxBytes: error.maxBytes,
        },
        { status: 413 }
      );
    }

    if (error instanceof RequestBodyParseError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    throw error;
  }

  const parsed = suggestionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const body = parsed.data;

  // Honeypot field: bots tend to fill hidden fields.
  if ((body.website ?? "").trim().length > 0) {
    return NextResponse.json({ ok: true, accepted: true, status: "ignored" });
  }

  const spamLike = isSpamLike(body);
  const status = spamLike ? "rejected_spam" : "pending_review";

  try {
    const admin = createAdminClient();

    const { error } = await admin.from("event_suggestions").insert({
      title: body.title,
      url: body.url,
      description: body.description,
      is_online: body.isOnline,
      source: body.source ?? null,
      contact_email: body.contactEmail ?? null,
      status,
      submitted_from_ip: ip,
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      const code = (error as { code?: string }).code;
      if (code === "42P01") {
        return NextResponse.json(
          {
            error: "Suggestions storage is not configured yet",
            details: "Missing table event_suggestions",
          },
          { status: 503 }
        );
      }

      throw new Error(error.message);
    }

    return NextResponse.json({
      ok: true,
      accepted: !spamLike,
      status,
    });
  } catch (error) {
    console.error("[api/suggestions] Failed:", error);
    return NextResponse.json(
      {
        error: "Failed to submit suggestion",
      },
      { status: 500 }
    );
  }
}
