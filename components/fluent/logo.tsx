import Link from "next/link";
import { MessageCircleMore } from "lucide-react";
import { cn } from "@/lib/utils";

type LogoProps = {
  compact?: boolean;
  className?: string;
  linked?: boolean;
};

export function Logo({ compact = false, className, linked = true }: LogoProps) {
  const content = (
    <>
      <span
        className={cn(
          "flex items-center justify-center rounded-xl bg-app-primary text-white shadow-sm",
          compact ? "h-10 w-10" : "h-11 w-11",
        )}
      >
        <MessageCircleMore className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <span className="text-xl font-bold tracking-tight text-app-text">FluentAI.</span>
    </>
  );

  if (!linked) {
    return <div className={cn("flex items-center gap-3", className)}>{content}</div>;
  }

  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100",
        className,
      )}
      aria-label="FluentAI home"
    >
      {content}
    </Link>
  );
}
