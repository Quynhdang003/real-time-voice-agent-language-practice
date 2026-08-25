import type { LucideIcon } from "lucide-react";

export type Language = {
  id: string;
  name: string;
  flag: string;
  level: string;
  progress: number;
};

export type Topic = {
  id: string;
  name: string;
  icon: LucideIcon;
};

export type Tutor = {
  id: string;
  name: string;
  role: string;
  description: string;
  specialties: string[];
};

export type PracticeSession = {
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
