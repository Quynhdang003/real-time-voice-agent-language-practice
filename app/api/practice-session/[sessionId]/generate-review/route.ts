import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { createPracticeSessionReview } from "@/lib/practice/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/practice-session/[sessionId]/generate-review">) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Sign in to generate a review." }, { status: 401 });
    const { sessionId } = await context.params;
    const result = await createPracticeSessionReview(sessionId, user.id);
    if (result.status === "ok") return NextResponse.json({ success: true, review: result.review });

    const failures = {
      unauthenticated: [401, "Sign in to generate a review."],
      invalid_id: [400, "Invalid practice session ID."],
      not_found: [404, "Practice session not found."],
      invalid_data: [500, "Unable to read this practice session."],
      not_ready: [409, "This session has not finished its call yet."],
      transcript_pending: [409, "The transcript for this call hasn't arrived yet."],
      transcript_empty: [409, "No speech was detected during this call, so a review can't be generated."],
      transcript_error: [409, "The transcript for this call could not be downloaded."],
      already_processing: [409, "A review is already being generated."],
      quota: [503, "The review service is busy. Please try again shortly."],
      invalid_output: [500, "Unable to generate a review. Please try again."],
      unavailable: [500, "Unable to generate a review. Please try again."],
    } as const;
    const [status, message] = failures[result.status];
    return NextResponse.json({ success: false, message, reason: result.status }, { status });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to generate a review. Please try again.", reason: "unavailable" }, { status: 500 });
  }
}