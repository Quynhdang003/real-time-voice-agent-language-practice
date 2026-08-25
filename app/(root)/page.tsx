import type { Metadata } from "next";
import { HomePracticeSetup } from "@/components/fluent/home-practice-setup";
import { getCurrentUser } from "@/lib/actions/auth.action";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await getCurrentUser();
  return <HomePracticeSetup userName={user?.name ?? "Learner"} />;
}
