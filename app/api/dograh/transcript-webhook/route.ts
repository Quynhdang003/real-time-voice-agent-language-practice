import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { ingestDograhTranscriptWebhook } from "@/lib/dograh/server";

export const runtime = "nodejs";

const digest = (value: string) => createHash("sha256").update(value).digest();

// The Webhook node's bearer_token credential sends "Authorization: Bearer <DOGRAH_WEBHOOK_SECRET>".
// Digests have equal length, so the comparison is timing-safe without leaking the secret's length.
function isAuthorized(request: Request): boolean {
  const expected = process.env.DOGRAH_WEBHOOK_SECRET?.trim();
  if (!expected) return false; // Fail closed until a secret is configured.
  const match = /^Bearer +(\S+) *$/i.exec(request.headers.get("authorization") ?? "");
  return match !== null && timingSafeEqual(digest(match[1]), digest(expected));
}

export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) return NextResponse.json({ success: false }, { status: 401 });

    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const result = await ingestDograhTranscriptWebhook(body);
    if (result.status === "ok") return NextResponse.json({ success: true });
    // 200 so Dograh does not retry: a missing session or another run's delivery will not change.
    if (result.status === "skipped") return NextResponse.json({ success: false, skipped: true });
    if (result.status === "invalid_payload") return NextResponse.json({ success: false }, { status: 400 });
    // 500 is retried by Dograh (Firestore unavailable).
    return NextResponse.json({ success: false }, { status: 500 });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
