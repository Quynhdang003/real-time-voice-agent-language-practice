import { Bot, Mic, Sparkles } from "lucide-react";
import { Logo } from "@/components/fluent/logo";

export function RegisterBrandPanel() {
  return (
    <section className="hidden min-h-screen flex-col justify-between overflow-hidden bg-indigo-50 px-12 py-10 lg:flex xl:px-16 xl:py-12">
      <Logo linked={false} />
      <section className="max-w-xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600">
          <span className="h-2 w-2 rounded-full bg-app-primary" /> AI-powered language practice
        </div>
        <h1 className="max-w-lg text-5xl font-bold leading-[1.12] tracking-tight text-app-text xl:text-[56px]">
          Speak naturally. <span className="text-app-primary">Learn confidently.</span>
        </h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-app-muted">
          Practice real conversations with your personal AI language tutor.
        </p>

        <section className="mt-12 rounded-2xl border border-indigo-100 bg-white p-7 shadow-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-app-accent"><Bot className="h-6 w-6" /></div>
              <div><p className="text-sm font-semibold text-app-text">AI Language Tutor</p><p className="mt-1 text-xs text-app-muted">Ready to practice</p></div>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600"><span className="h-2 w-2 rounded-full bg-app-success" />Online</span>
          </div>
          <div className="mt-7 space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-app-accent"><Sparkles className="h-4 w-4" /></div>
              <div className="max-w-sm rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3"><p className="text-sm leading-6 text-slate-700">What would you like to talk about today?</p></div>
            </div>
            <div className="flex justify-end"><div className="max-w-xs rounded-2xl rounded-br-md bg-app-primary px-4 py-3"><p className="text-sm leading-6 text-white">I&apos;d like to practice ordering food at a restaurant.</p></div></div>
          </div>
          <div className="mt-7 flex items-center justify-between rounded-xl border border-app-border bg-app-background px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-app-primary"><Mic className="h-5 w-5" /></div>
              <div><p className="text-sm font-medium text-app-text">Voice conversation</p><p className="mt-0.5 text-xs text-app-muted">Speak naturally at your own pace</p></div>
            </div>
            <div className="flex h-8 items-center gap-1" aria-hidden="true">
              <span className="h-3 w-1 rounded-full bg-indigo-300" /><span className="h-5 w-1 rounded-full bg-indigo-400" /><span className="h-7 w-1 rounded-full bg-app-primary" /><span className="h-4 w-1 rounded-full bg-indigo-400" /><span className="h-6 w-1 rounded-full bg-indigo-300" />
            </div>
          </div>
        </section>
      </section>
      <footer className="text-sm text-app-muted">Learn languages through conversations that feel real.</footer>
    </section>
  );
}
