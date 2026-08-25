import type { Metadata } from "next";
import { RegisterBrandPanel } from "@/components/fluent/register-brand-panel";
import { RegisterForm } from "@/components/fluent/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[45%_55%]">
      <RegisterBrandPanel />
      <section className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8 lg:px-12 xl:px-20">
        <RegisterForm />
      </section>
    </main>
  );
}
