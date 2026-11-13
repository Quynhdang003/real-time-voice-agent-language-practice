import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { createPracticeSession } from "@/lib/practice/server";

export const runtime = "nodejs";

const UNAVAILABLE = "We could not create your practice session. Please try again.";

// Body: {profile, setup}. The server decides trial or full from the account's access (ACC-01).
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "You must be signed in to start a practice session." },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "The practice setup request is not valid JSON." },
        { status: 400 },
      );
    }

    const result = await createPracticeSession(user.id, body);
    switch (result.status) {
      case "ok":
        return NextResponse.json({ success: true, sessionId: result.sessionId }, { status: 201 });
      case "invalid":
        return NextResponse.json(
          { success: false, message: "Please fix the highlighted fields.", fieldErrors: result.fieldErrors },
          { status: 400 },
        );
      case "access_required":
        return NextResponse.json({
          success: false,
          message: "Your free trial call has been used. Full access needs the admin's approval.",
          reason: "access_required",
          accessStatus: result.accessStatus,
        }, { status: 403 });
      default:
        return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
  }
}
