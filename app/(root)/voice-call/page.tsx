import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VoiceCallExperience } from "@/components/fluent/voice-call-experience";
import { SessionAccessNotice } from "@/components/fluent/session-access-notice";
import { selectWidgetSource } from "@/lib/dograh/widget";
import { getPracticeSession } from "@/lib/practice/server";

export const metadata: Metadata = { title: "Voice Practice" };

export default async function VoiceCallPage({ searchParams }: PageProps<"/voice-call">) {
  const result = await getPracticeSession((await searchParams).sessionId);
  if (result.status === "unauthenticated") redirect("/sign-in");
  if (result.status !== "ok") return <SessionAccessNotice status={result.status} />;
  // Read at request time on the server (this page is dynamic). Only the owner of a callable session gets the
  // embed URL, so the token never reaches the public bundle or anonymous visitors (DG-05).
  const widgetSrc = selectWidgetSource(result.session, process.env);
  return <VoiceCallExperience key={result.session.id} session={result.session} learner={result.learner} widgetSrc={widgetSrc} />;
}
