"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, ShieldOff, X } from "lucide-react";
import { formatAccessDate, type AccessAccountRow, type AccessDecision } from "@/lib/practice/access";
import { isRecord } from "@/lib/practice/guards";

type RowError = { uid: string; message: string };

// ACC-03: the admin approves or rejects pending requests and revokes approved accounts.
export function AdminAccessPanel({ pending, approved }: { pending: AccessAccountRow[]; approved: AccessAccountRow[] }) {
  const router = useRouter();
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<RowError | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  async function decide(row: AccessAccountRow, decision: AccessDecision) {
    if (busyUid) return;
    if (decision === "revoke" && !window.confirm(`Revoke full access for ${row.name || row.email}? They will have to request it again.`)) return;
    setBusyUid(row.uid);
    setError(null);
    try {
      const response = await fetch(`/api/admin/access/${encodeURIComponent(row.uid)}`, {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError({ uid: row.uid, message: isRecord(body) && typeof body.message === "string" ? body.message : "Unable to save the decision." });
        return;
      }
      // Re-renders this page and the header count from the server.
      startRefresh(() => router.refresh());
    } catch {
      setError({ uid: row.uid, message: "Unable to reach the server. Check your connection and try again." });
    } finally {
      setBusyUid(null);
    }
  }

  // One decision at a time; the page refreshes from the server afterwards.
  const locked = busyUid !== null || isRefreshing;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AccountList title="Pending requests" empty="No pending requests." rows={pending} error={error}
        render={(row) => (
          <>
            <ActionButton tone="primary" onClick={() => decide(row, "approve")} disabled={locked} busy={busyUid === row.uid}><Check className="h-4 w-4" />Approve</ActionButton>
            <ActionButton tone="danger" onClick={() => decide(row, "reject")} disabled={locked} busy={busyUid === row.uid}><X className="h-4 w-4" />Reject</ActionButton>
          </>
        )} />
      <AccountList title="Approved accounts" empty="No approved accounts yet." rows={approved} error={error}
        render={(row) => (
          <ActionButton tone="danger" onClick={() => decide(row, "revoke")} disabled={locked} busy={busyUid === row.uid}><ShieldOff className="h-4 w-4" />Revoke</ActionButton>
        )} />
    </div>
  );
}

function AccountList({ title, empty, rows, error, render }: {
  title: string; empty: string; rows: AccessAccountRow[]; error: RowError | null;
  render: (row: AccessAccountRow) => ReactNode;
}) {
  const id = title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-app-border bg-white p-6 shadow-card">
      <h2 id={id} className="text-lg font-bold text-app-text">{title} <span className="text-app-muted">({rows.length})</span></h2>
      {rows.length === 0 ? <p className="mt-4 text-sm text-app-muted">{empty}</p> : (
        <ul className="mt-4 divide-y divide-app-border">
          {rows.map((row) => (
            <li key={row.uid} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-app-text">{row.name || "Unnamed learner"}</p>
                  <p className="truncate text-xs text-app-muted">{row.email || row.uid}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-app-muted">
                    {row.status === "pending" && row.requestedAt ? <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />Requested {formatAccessDate(row.requestedAt)}</span> : null}
                    {row.status === "approved" && row.decidedAt ? <span>Approved {formatAccessDate(row.decidedAt)}</span> : null}
                    <span className={row.trialUsed ? "rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600" : "rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-app-primary"}>
                      {row.trialUsed ? "Trial used" : "Trial not used"}
                    </span>
                  </p>
                  {row.requestMessage ? <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-app-text">“{row.requestMessage}”</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">{render(row)}</div>
              </div>
              {error?.uid === row.uid ? <p role="alert" className="mt-2 text-xs font-medium text-red-600">{error.message}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionButton({ tone, onClick, disabled, busy, children }: {
  tone: "primary" | "danger"; onClick: () => void; disabled: boolean; busy: boolean; children: ReactNode;
}) {
  const style = tone === "primary"
    ? "bg-app-primary text-white hover:bg-indigo-700 focus:ring-indigo-200"
    : "border border-red-200 bg-white text-red-600 hover:bg-red-50 focus:ring-red-100";
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={busy}
      className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60 ${style}`}>
      {children}
    </button>
  );
}
