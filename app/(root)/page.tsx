import type { Metadata } from "next";
import { HomePracticeSetup } from "@/components/fluent/home-practice-setup";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { accessViewOf, initialAccess } from "@/lib/practice/access";
import { getAccessView } from "@/lib/practice/access-server";
import { defaultLearnerProfile } from "@/lib/practice/profile";
import { getLearnerProfileDraft } from "@/lib/practice/profile-server";
import { getWeakPointCarryOver } from "@/lib/practice/weak-points-server";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getCurrentUser();
  // The (root) layout already redirects anonymous users; the fallbacks only keep types honest.
  const [initialProfile, initialAccessView, carriedWeakPoints] = user
    ? await Promise.all([getLearnerProfileDraft(user), getAccessView(user), getWeakPointCarryOver(user.id)])
    : [defaultLearnerProfile("Learner"), accessViewOf("", initialAccess, undefined), []];
  // RV-03: weak points from the latest reviews pre-fill the form; the learner can edit them.
  return <HomePracticeSetup userName={user?.name ?? "Learner"} initialProfile={initialProfile} initialAccess={initialAccessView}
    initialWeakPoints={carriedWeakPoints.map((point) => point.text)} />;
}
