import type { LucideIcon } from "lucide-react";
import type { PracticeLanguage, PracticeTopic, PracticeTutor } from "@/lib/practice/session";

export type Language = PracticeLanguage & {
  flag: string;
};

export type Topic = PracticeTopic & {
  icon: LucideIcon;
};

export type Tutor = PracticeTutor & {
  description: string;
  specialties: readonly string[];
};
