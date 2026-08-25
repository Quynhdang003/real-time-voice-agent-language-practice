import type { PerformanceMetric } from "@/components/fluent/types";

export function PerformanceCard({ metric }: { metric: PerformanceMetric }) {
  const Icon = metric.icon;
  return (
    <article className="rounded-2xl border border-app-border bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${metric.iconClassName}`}><Icon className="h-5 w-5" /></div>
        <span className="text-2xl font-extrabold text-app-text">{metric.score}</span>
      </div>
      <h3 className="mt-5 text-base font-bold text-app-text">{metric.name}</h3>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-indigo-100">
        <div className="h-full rounded-full bg-app-primary" style={{ width: `${metric.score}%` }} />
      </div>
      <p className="mt-4 text-sm leading-6 text-app-muted">{metric.description}</p>
    </article>
  );
}
