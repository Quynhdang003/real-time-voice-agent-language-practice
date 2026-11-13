import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminAccessPanel } from "@/components/fluent/admin-access-panel";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { isAdminUser, listAccessAccounts } from "@/lib/practice/access-server";

export const metadata: Metadata = { title: "Access requests" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  // The (root) layout redirects anonymous users. Anyone but ADMIN_UID gets the same 404 as a missing page (ACC-03).
  if (!user || !isAdminUser(user.id)) notFound();
  const accounts = await listAccessAccounts();
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
      <section className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-app-primary">Admin</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-app-text sm:text-4xl">Access requests</h1>
        <p className="mt-2 text-sm leading-6 text-app-muted sm:text-base">
          Every new account gets one 1-minute trial call. Approve a request to unlock full sessions within the daily call limit.
        </p>
      </section>
      {accounts.status === "ok" ? (
        <AdminAccessPanel pending={accounts.pending} approved={accounts.approved} />
      ) : (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm leading-6 text-red-800">
          Unable to load the accounts. Reload the page to try again.
        </div>
      )}
    </main>
  );
}
