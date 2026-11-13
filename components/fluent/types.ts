import type { LucideIcon } from "lucide-react";
import type { PracticeTutor } from "@/lib/practice/session";

export type Tutor = PracticeTutor & {
  description: string;
  specialties: readonly string[];
};

export type PracticeSessionSummary = {
  id: string;
  title: string;
  language: string;
  level: string;
  duration: string;
  score: number;
  icon: LucideIcon;
  iconClassName: string;
};

export type PerformanceMetric = {
  name: string;
  score: number;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
};

export type VocabularyItem = {
  word: string;
  definition: string;
};
