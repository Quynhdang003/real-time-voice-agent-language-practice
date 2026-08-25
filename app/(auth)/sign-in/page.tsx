import type { Metadata } from "next";
import { RegisterBrandPanel } from "@/components/fluent/register-brand-panel";
import { SignInForm } from "@/components/fluent/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[45%_55%]">
      <RegisterBrandPanel />
      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
        <SignInForm />
      </section>
    </main>
  );
}
