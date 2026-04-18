import { z } from "zod";

const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const NULL_ESCAPE_REGEX = /\\x00|\\0/gi;

export class RequestBodyTooLargeError extends Error {
  readonly maxBytes: number;
  readonly actualBytes: number;

  constructor(maxBytes: number, actualBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "RequestBodyTooLargeError";
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

export class RequestBodyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestBodyParseError";
  }
}

export function sanitizeInputText(value: string): string {
  return value
    .replace(NULL_ESCAPE_REGEX, "")
    .replace(CONTROL_CHAR_REGEX, "")
    .trim();
}

export function createSanitizedTextSchema(
  maxChars: number,
  options?: {
    minChars?: number;
    requiredMessage?: string;
    maxMessage?: string;
  }
) {
  const minChars = options?.minChars ?? 1;

  return z
    .string()
    .transform((value) => sanitizeInputText(value))
    .pipe(
      z
        .string()
        .min(minChars, options?.requiredMessage ?? "Required")
        .max(maxChars, options?.maxMessage ?? `Must be at most ${maxChars} characters`)
    );
}

export async function parseJsonBodyWithLimit(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const rawBody = await request.text();
  const bodyBytes = new TextEncoder().encode(rawBody).length;

  if (bodyBytes > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes, bodyBytes);
  }

  if (!rawBody.trim()) {
    throw new RequestBodyParseError("Request body is required");
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new RequestBodyParseError("Invalid JSON body");
  }
}
