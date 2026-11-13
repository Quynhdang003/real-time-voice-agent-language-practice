import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { decideUserAccess, isAdminUser } from "@/lib/practice/access-server";

export const runtime = "nodejs";

// ACC-03: only the ADMIN_UID account may decide. Everyone else, signed in or not, gets the same 404 as a
// route that does not exist, before the body is read.
const notFound = () => NextResponse.json({ success: false, message: "Not found." }, { status: 404 });
const UNAVAILABLE = "Unable to save the decision. Please try again.";

export async function POST(request: Request, context: RouteContext<"/api/admin/access/[uid]">) {
  try {
    const user = await getCurrentUser();
    if (!user || !isAdminUser(user.id)) return notFound();
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ success: false, message: "Invalid decision JSON." }, { status: 400 });
    }
    const { uid } = await context.params;
    const result = await decideUserAccess(user.id, uid, body);
    switch (result.status) {
      case "ok":
        return NextResponse.json({ success: true, access: { status: result.access.status, decidedAt: result.access.decidedAt } });
      case "invalid":
        return NextResponse.json({ success: false, message: "Invalid account or decision." }, { status: 400 });
      case "not_found":
        return NextResponse.json({ success: false, message: "Account not found.", reason: "not_found" }, { status: 404 });
      case "invalid_transition":
        return NextResponse.json(
          { success: false, message: "This decision does not fit the account's current state. Reload the page.", reason: "invalid_transition" },
          { status: 409 },
        );
      case "not_admin":
        return notFound();
      default:
        return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ success: false, message: UNAVAILABLE }, { status: 500 });
  }
}
