import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ingestDograhTranscriptWebhook } from "@/lib/dograh/server";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const expected = process.env.DOGRAH_WEBHOOK_SECRET?.trim();
  if (!expected) return false; // Fail closed until a secret is configured.
  const providedBuffer = Buffer.from(request.headers.get("x-dograh-webhook-secret") ?? "");
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ success: false }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const result = await ingestDograhTranscriptWebhook(body);
  if (result.status === "ok") return NextResponse.json({ success: true });
  if (result.status === "invalid_payload") return NextResponse.json({ success: false }, { status: 400 });
  // 200 for not_found: Dograh doesn't retry by default, and a run we don't own
  // (e.g. a dashboard test call) isn't a delivery failure.
  if (result.status === "not_found") return NextResponse.json({ success: false, skipped: true }, { status: 200 });
  return NextResponse.json({ success: false }, { status: 500 });
}