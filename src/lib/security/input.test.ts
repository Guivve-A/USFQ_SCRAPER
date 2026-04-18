import { describe, expect, it } from "vitest";

import {
  createSanitizedTextSchema,
  parseJsonBodyWithLimit,
  RequestBodyParseError,
  RequestBodyTooLargeError,
  sanitizeInputText,
} from "./input";

describe("sanitizeInputText", () => {
  it("removes control chars and escaped null sequences", () => {
    const raw = "  hi\u0000 there \\x00 ok \\0  ";
    expect(sanitizeInputText(raw)).toBe("hi there  ok");
  });
});

describe("createSanitizedTextSchema", () => {
  it("accepts sanitized values within max length", () => {
    const schema = createSanitizedTextSchema(10);
    const parsed = schema.parse("  abc\\x00 ");
    expect(parsed).toBe("abc");
  });

  it("rejects values over max length", () => {
    const schema = createSanitizedTextSchema(5, {
      maxMessage: "too long",
    });

    const parsed = schema.safeParse("123456");
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("too long");
    }
  });
});

describe("parseJsonBodyWithLimit", () => {
  it("parses valid JSON payload", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
      headers: { "content-type": "application/json" },
    });

    const payload = await parseJsonBodyWithLimit(req, 1024);
    expect(payload).toEqual({ ok: true });
  });

  it("throws RequestBodyTooLargeError for oversized payload", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      body: JSON.stringify({ text: "x".repeat(2_000) }),
      headers: { "content-type": "application/json" },
    });

    await expect(parseJsonBodyWithLimit(req, 32)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  it("throws RequestBodyParseError for invalid JSON", async () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      body: "{invalid",
      headers: { "content-type": "application/json" },
    });

    await expect(parseJsonBodyWithLimit(req, 1024)).rejects.toBeInstanceOf(
      RequestBodyParseError
    );
  });
});
