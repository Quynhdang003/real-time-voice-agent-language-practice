import { Logo } from "@/components/fluent/logo";
import { UserMenu } from "@/components/fluent/user-menu";
import type { AuthenticatedUser } from "@/lib/actions/auth.action";

export function AppHeader({ user }: { user: AuthenticatedUser }) {
  return (
    <header className="border-b border-app-border bg-white">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Logo />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
