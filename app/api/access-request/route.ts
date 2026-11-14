import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { requestUserAccess } from "@/lib/practice/access-server";

export const runtime = "nodejs";

const UNAVAILABLE = "We could not send your request. Please try again.";

// ACC-02: the learner asks the admin for full access (none / rejected → pending).
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Sign in to request full access." }, { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, message: "Invalid request JSON." }, { status: 400 });
    }
    const result = await requestUserAccess(user.id, body);
    switch (result.status) {
      case "ok":
        return NextResponse.json({
          success: true, access: { status: result.access.status, requestedAt: result.access.requestedAt },
        });
      case "invalid":
        return NextResponse.json(
          { success: false, message: "Please fix your message.", fieldErrors: result.fieldErrors },
          { status: 400 },
        );
      case "already_pending":
        return NextResponse.json(
          { success: false, message: "Your request is already waiting for approval.", reason: result.status },
          { status: 409 },
        );
      case "already_approved":
        return NextResponse.json(
          { success: false, message: "Your account already has full access.", reason: result.status },
          { status: 409 },
        );
      default:
        return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
  }
}
