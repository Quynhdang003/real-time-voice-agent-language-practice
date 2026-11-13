import type { Metadata } from "next";
import { HomePracticeSetup } from "@/components/fluent/home-practice-setup";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { defaultLearnerProfile } from "@/lib/practice/profile";
import { getLearnerProfileDraft } from "@/lib/practice/profile-server";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getCurrentUser();
  // The (root) layout already redirects anonymous users; the fallback only keeps types honest.
  const initialProfile = user ? await getLearnerProfileDraft(user) : defaultLearnerProfile("Learner");
  return <HomePracticeSetup userName={user?.name ?? "Learner"} initialProfile={initialProfile} />;
}
