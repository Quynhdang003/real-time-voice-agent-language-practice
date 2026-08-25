import Image from "next/image";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  src?: string | null;
  name?: string;
};

const sizes = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-24 w-24",
};

const defaultAvatar = "https://i.pravatar.cc/160?img=12";

export function UserAvatar({ size = "md", className, src, name = "Alex" }: UserAvatarProps) {
  const imageSource = src === undefined ? defaultAvatar : src;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-slate-100",
        sizes[size],
        className,
      )}
    >
      {imageSource ? (
        <Image
          src={imageSource}
          alt={name}
          fill
          sizes={size === "sm" ? "36px" : size === "md" ? "44px" : "96px"}
          className="object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-indigo-100 text-sm font-bold text-app-primary">
          {initials || "U"}
        </span>
      )}
    </div>
  );
}
