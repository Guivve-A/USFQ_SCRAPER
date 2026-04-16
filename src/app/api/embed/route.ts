import { NextResponse } from "next/server";

import { embedAllHackathons } from "@/lib/ai/embeddings";
import { validateCronSecret } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const auth = validateCronSecret(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await embedAllHackathons();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[api/embed] Failed:", error);
    return NextResponse.json(
      { error: "Failed to embed hackathons" },
      { status: 500 }
    );
  }
}
