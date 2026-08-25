import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/actions/auth.action";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  return children;
}
