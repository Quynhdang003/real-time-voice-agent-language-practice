"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { ChevronDown, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/fluent/user-avatar";
import { auth } from "@/firebase/client";
import {
  signOut,
  type AuthenticatedUser,
} from "@/lib/actions/auth.action";

export function UserMenu({ user }: { user: AuthenticatedUser }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await firebaseSignOut(auth).catch(() => undefined);
      await signOut();
      router.replace("/sign-in");
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-1 rounded-full focus:outline-none focus:ring-4 focus:ring-indigo-100"
        aria-label="Open profile menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-app-border bg-slate-100 transition hover:border-indigo-300">
          <UserAvatar src={user.photoURL} name={user.name} />
        </span>
        <ChevronDown className="hidden h-4 w-4 text-app-muted sm:block" />
      </button>

      {isOpen ? (
        <div role="menu" className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-app-border bg-white p-2 shadow-card">
          <div className="border-b border-app-border px-3 py-3">
            <p className="truncate text-sm font-bold text-app-text">{user.name}</p>
            <p className="mt-1 truncate text-xs text-app-muted">{user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={isPending}
            className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isPending ? "Signing out..." : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
