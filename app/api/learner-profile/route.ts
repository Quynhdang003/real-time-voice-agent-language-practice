import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { updateLearnerProfile } from "@/lib/practice/profile-server";

export const runtime = "nodejs";

// "Save as default" on the session form. Creating a session never changes the stored profile.
export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Sign in to save your profile." }, { status: 401 });
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, message: "Invalid profile JSON." }, { status: 400 });
    }
    const result = await updateLearnerProfile(user.id, body);
    if (result.status === "ok") return NextResponse.json({ success: true, profile: result.profile });
    if (result.status === "invalid") {
      return NextResponse.json(
        { success: false, message: "Please fix the highlighted profile fields.", fieldErrors: result.fieldErrors },
        { status: 400 },
      );
    }
    if (result.status === "unauthenticated") {
      return NextResponse.json({ success: false, message: "Sign in to save your profile." }, { status: 401 });
    }
    return NextResponse.json({ success: false, message: "Unable to save your profile. Please try again." }, { status: 500 });
  } catch {
    return NextResponse.json({ success: false, message: "Unable to save your profile. Please try again." }, { status: 500 });
  }
}
