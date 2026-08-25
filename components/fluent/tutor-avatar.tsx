import Image from "next/image";
import { cn } from "@/lib/utils";

type TutorAvatarProps = {
  size?: number;
  className?: string;
};

export function TutorAvatar({ size = 64, className }: TutorAvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-violet-100",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="https://i.pravatar.cc/160?img=47"
        alt="Emma AI Tutor"
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </div>
  );
}
