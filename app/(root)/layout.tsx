import { AppHeader } from "@/components/layout/app-header";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth.action";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen">
      <AppHeader user={user} />
      {children}
    </div>
  );
}
