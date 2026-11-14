import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/fluent/logo";
import { UserMenu } from "@/components/fluent/user-menu";
import type { AuthenticatedUser } from "@/lib/actions/auth.action";

// `admin` is set only for the ADMIN_UID account (computed on the server in the (root) layout, ACC-03).
export function AppHeader({ user, admin }: { user: AuthenticatedUser; admin?: { pendingCount: number | null } | null }) {
  const pending = admin?.pendingCount ?? 0;
  return (
    <header className="border-b border-app-border bg-white">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Logo />
        <div className="flex items-center gap-3">
          {admin ? (
            <Link href="/admin" aria-label={pending > 0 ? `Access requests, ${pending} pending` : "Access requests"}
              className="flex h-10 items-center gap-2 rounded-xl border border-app-border px-3 text-sm font-semibold text-app-primary transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus:ring-4 focus:ring-indigo-100">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Access requests</span>
              {pending > 0 ? <span className="rounded-full bg-app-primary px-2 py-0.5 text-xs font-bold text-white">{pending}</span> : null}
            </Link>
          ) : null}
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
