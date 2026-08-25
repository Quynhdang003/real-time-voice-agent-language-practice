import type { Metadata } from "next";
import { VoiceCallExperience } from "@/components/fluent/voice-call-experience";

export const metadata: Metadata = { title: "Voice Practice" };

export default function VoiceCallPage() {
  return <VoiceCallExperience />;
}
