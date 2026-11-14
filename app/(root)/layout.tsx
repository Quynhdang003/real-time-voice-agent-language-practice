import { AppHeader } from "@/components/layout/app-header";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { countPendingRequests, isAdminUser } from "@/lib/practice/access-server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Only the ADMIN_UID account sees the access-requests link; nobody else triggers the count query (ACC-03).
  const admin = isAdminUser(user.id) ? { pendingCount: await countPendingRequests() } : null;

  return (
    <div className="min-h-screen">
      <AppHeader user={user} admin={admin} />
      {children}
    </div>
  );
}
