import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { updatePracticeSessionCallState } from "@/lib/practice/server";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/practice-session/[sessionId]/call-event">) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Sign in to update your call." }, { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, message: "Invalid call event JSON." }, { status: 400 });
    }
    const { sessionId } = await context.params;
    const result = await updatePracticeSessionCallState(sessionId, user.id, body);
    if (result.status === "ok") return NextResponse.json({ success: true });
    const failures = {
      unauthenticated: [401, "Sign in to update your call."],
      invalid_id: [400, "Invalid practice session ID."],
      invalid_update: [400, "Invalid call event."],
      not_found: [404, "Practice session not found."],
      conflict: [409, "This event conflicts with the saved call state."],
      invalid_data: [500, "Unable to update this practice session."],
      unavailable: [500, "Unable to save the call state. Please try again."],
    } as const;
    const [status, message] = failures[result.status];
    return NextResponse.json({ success: false, message }, { status });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to save the call state. Please try again." }, { status: 500 });
  }
}
