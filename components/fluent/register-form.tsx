"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  setPersistence,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type StorageReference,
} from "firebase/storage";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Upload, User, UserRound } from "lucide-react";
import { Logo } from "@/components/fluent/logo";
import { Input } from "@/components/ui/input";
import { auth, storage } from "@/firebase/client";
import { signUp } from "@/lib/actions/auth.action";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase-auth-error";

type FormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

const fieldClassName = "h-12 rounded-xl border-app-border bg-white pl-12 pr-4 text-sm text-app-text outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-app-primary focus-visible:ring-4 focus-visible:ring-indigo-100";

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormValues>({ fullName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(null);
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!(["image/jpeg", "image/png"] as string[]).includes(file.type)) {
      setPhotoError("Choose a JPG or PNG image.");
      setProfilePhoto(null);
      setAvatarPreview(null);
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Profile photo must be 5 MB or smaller.");
      setProfilePhoto(null);
      setAvatarPreview(null);
      event.target.value = "";
      return;
    }

    setPhotoError(null);
    setProfilePhoto(file);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatarPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    if (values.fullName.trim().length < 2) nextErrors.fullName = "Full name must contain at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (values.password.length < 8) nextErrors.password = "Password must be at least 8 characters.";
    if (!values.confirmPassword) nextErrors.confirmPassword = "Please confirm your password.";
    else if (values.confirmPassword !== values.password) nextErrors.confirmPassword = "Passwords do not match.";
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0 || photoError) return;

    setIsSubmitting(true);
    let firebaseUser: FirebaseUser | null = null;
    let uploadedPhoto: StorageReference | null = null;

    try {
      await setPersistence(auth, inMemoryPersistence);
      const credential = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      );
      firebaseUser = credential.user;

      let photoURL: string | undefined;
      if (profilePhoto) {
        const extension = profilePhoto.type === "image/png" ? "png" : "jpg";
        uploadedPhoto = ref(storage, `profile-photos/${firebaseUser.uid}/avatar.${extension}`);
        await uploadBytes(uploadedPhoto, profilePhoto, { contentType: profilePhoto.type });
        photoURL = await getDownloadURL(uploadedPhoto);
      }

      await updateProfile(firebaseUser, {
        displayName: values.fullName.trim(),
        photoURL,
      });

      const idToken = await firebaseUser.getIdToken(true);
      const result = await signUp({ idToken, fullName: values.fullName });

      if (!result.success) {
        throw new Error(result.message);
      }

      await firebaseSignOut(auth);
      router.replace("/");
      router.refresh();
    } catch (error) {
      if (uploadedPhoto) {
        await deleteObject(uploadedPhoto).catch(() => undefined);
      }
      if (firebaseUser) {
        await firebaseUser.delete().catch(() => undefined);
      }
      await firebaseSignOut(auth).catch(() => undefined);
      setFormError(getFirebaseAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-[440px]">
      <Logo linked={false} compact className="mb-8 lg:hidden" />
      <section className="rounded-2xl border border-app-border bg-white p-6 shadow-card sm:p-8 lg:p-9">
        <header>
          <h2 className="text-3xl font-bold tracking-tight text-app-text">Create your account</h2>
          <p className="mt-2 text-sm leading-6 text-app-muted">Start practicing a new language today.</p>
        </header>

        <section className="mt-7 flex items-center gap-5" aria-label="Profile photo">
          <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-app-border bg-slate-100 text-slate-400">
            {avatarPreview ? <Image src={avatarPreview} alt="Profile preview" fill unoptimized className="object-cover" /> : <UserRound className="h-8 w-8" />}
          </div>
          <div>
            <label htmlFor="profilePhoto" className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-app-primary transition hover:text-indigo-700">
              <Upload className="h-4 w-4" /> Upload profile photo
            </label>
            <input id="profilePhoto" type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoChange} aria-describedby={photoError ? "photo-error" : "photo-help"} disabled={isSubmitting} />
            <p id="photo-help" className="mt-2 text-xs leading-5 text-app-muted">JPG or PNG. Maximum 5 MB.{profilePhoto ? ` Selected: ${profilePhoto.name}` : ""}</p>
            {photoError ? <p id="photo-error" className="mt-2 text-xs font-medium text-red-600">{photoError}</p> : null}
          </div>
        </section>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
          <Field label="Full name" id="fullName" error={errors.fullName} icon={<User className="h-5 w-5" />}>
            <Input id="fullName" type="text" autoComplete="name" placeholder="Enter your full name" value={values.fullName} onChange={(event) => updateField("fullName", event.target.value)} aria-invalid={Boolean(errors.fullName)} aria-describedby={errors.fullName ? "fullName-error" : undefined} className={fieldClassName} />
          </Field>
          <Field label="Email address" id="email" error={errors.email} icon={<Mail className="h-5 w-5" />}>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} className={fieldClassName} />
          </Field>
          <Field label="Password" id="password" error={errors.password} help="Use at least 8 characters." icon={<LockKeyhole className="h-5 w-5" />}>
            <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Create a password" value={values.password} onChange={(event) => updateField("password", event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : "password-help"} className={`${fieldClassName} pr-12`} />
            <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((current) => !current)} label="Toggle password visibility" />
          </Field>
          <Field label="Confirm password" id="confirmPassword" error={errors.confirmPassword} icon={<ShieldCheck className="h-5 w-5" />}>
            <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" value={values.confirmPassword} onChange={(event) => updateField("confirmPassword", event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined} className={`${fieldClassName} pr-12`} />
            <PasswordToggle shown={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} label="Toggle confirm password visibility" />
          </Field>
          {formError ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{formError}</p> : null}
          <button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="mt-1 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Creating account..." : "Create account"} <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <footer className="mt-7 border-t border-app-border pt-6 text-center">
          <p className="text-sm text-app-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-app-primary transition hover:text-indigo-700 hover:underline">Sign in</Link></p>
        </footer>
      </section>
      <p className="mx-auto mt-6 max-w-sm text-center text-xs leading-5 text-app-muted">
        By creating an account, you agree to FluentAI&apos;s <a href="#" className="font-medium text-slate-600 hover:underline">Terms of Service</a> and <a href="#" className="font-medium text-slate-600 hover:underline">Privacy Policy</a>.
      </p>
    </div>
  );
}

function Field({ label, id, error, help, icon, children }: { label: string; id: string; error?: string; help?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-app-text">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400">{icon}</span>
        {children}
      </div>
      {error ? <p id={`${id}-error`} className="mt-2 text-xs font-medium text-red-600">{error}</p> : help ? <p id={`${id}-help`} className="mt-2 text-xs text-app-muted">{help}</p> : null}
    </div>
  );
}

function PasswordToggle({ shown, onToggle, label }: { shown: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-app-text focus:outline-none focus:ring-2 focus:ring-indigo-200" aria-label={label} aria-pressed={shown}>
      {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
