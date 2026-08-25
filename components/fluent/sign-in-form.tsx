"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  inMemoryPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { Logo } from "@/components/fluent/logo";
import { Input } from "@/components/ui/input";
import { auth } from "@/firebase/client";
import { signIn } from "@/lib/actions/auth.action";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase-auth-error";

type SignInValues = {
  email: string;
  password: string;
};

type SignInErrors = Partial<Record<keyof SignInValues, string>>;

const fieldClassName =
  "h-12 rounded-xl border-app-border bg-white pl-12 pr-4 text-sm text-app-text outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-app-primary focus-visible:ring-4 focus-visible:ring-indigo-100";

export function SignInForm() {
  const router = useRouter();
  const [values, setValues] = useState<SignInValues>({ email: "", password: "" });
  const [errors, setErrors] = useState<SignInErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  function updateField(field: keyof SignInValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: SignInErrors = {};

    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!values.password) {
      nextErrors.password = "Password is required.";
    }

    setErrors(nextErrors);
    setFormError(null);
    setNotice(null);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);

    try {
      await setPersistence(auth, inMemoryPersistence);
      const credential = await signInWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      );
      const idToken = await credential.user.getIdToken();
      const result = await signIn({ idToken });

      if (!result.success) {
        throw new Error(result.message);
      }

      await firebaseSignOut(auth);
      router.replace("/");
      router.refresh();
    } catch (error) {
      await firebaseSignOut(auth).catch(() => undefined);
      setFormError(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordReset() {
    if (!/^\S+@\S+\.\S+$/.test(values.email)) {
      setErrors((current) => ({ ...current, email: "Enter your email before requesting a reset link." }));
      return;
    }

    setIsSendingReset(true);
    setFormError(null);
    setNotice(null);

    try {
      await sendPasswordResetEmail(auth, values.email.trim());
      setNotice("Password reset email sent. Check your inbox.");
    } catch (error) {
      setFormError(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <Logo linked={false} compact className="mb-8 lg:hidden" />

      <section className="rounded-2xl border border-app-border bg-white p-6 shadow-card sm:p-8 lg:p-9">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-app-text">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-app-muted">
            Sign in to continue your language practice.
          </p>
        </header>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-app-text">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={fieldClassName}
              />
            </div>
            {errors.email ? (
              <p id="email-error" className="mt-2 text-xs font-medium text-red-600">
                {errors.email}
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label htmlFor="password" className="text-sm font-medium text-app-text">
                Password
              </label>
              <button type="button" onClick={handlePasswordReset} disabled={isSendingReset || isSubmitting} className="text-xs font-semibold text-app-primary transition hover:text-indigo-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60">
                {isSendingReset ? "Sending..." : "Forgot password?"}
              </button>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                value={values.password}
                onChange={(event) => updateField("password", event.target.value)}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                className={`${fieldClassName} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-app-text focus:outline-none focus:ring-2 focus:ring-indigo-200"
                aria-label="Toggle password visibility"
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.password ? (
              <p id="password-error" className="mt-2 text-xs font-medium text-red-600">
                {errors.password}
              </p>
            ) : null}
          </div>

          {notice ? <p role="status" className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">{notice}</p> : null}
          {formError ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{formError}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <footer className="mt-7 border-t border-app-border pt-6 text-center">
          <p className="text-sm text-app-muted">
            New to FluentAI?{" "}
            <Link href="/register" className="font-semibold text-app-primary transition hover:text-indigo-700 hover:underline">
              Create account
            </Link>
          </p>
        </footer>
      </section>

      <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-5 text-app-muted">
        By signing in, you agree to FluentAI&apos;s{" "}
        <a href="#" className="font-medium text-slate-600 hover:underline">Terms of Service</a>{" "}
        and{" "}
        <a href="#" className="font-medium text-slate-600 hover:underline">Privacy Policy</a>.
      </p>
    </div>
  );
}
