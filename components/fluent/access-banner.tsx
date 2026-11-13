"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Send, Sparkles, TriangleAlert } from "lucide-react";
import { isRecord, type FieldErrors } from "@/lib/practice/guards";
import { ACCESS_REQUEST_MESSAGE_MAX, canRequestAccess, formatAccessDate, type AccessView } from "@/lib/practice/access";
import { cn } from "@/lib/utils";

type RequestState = { kind: "idle" | "sending" | "sent" | "error"; message?: string };

// ACC-02: shown to accounts without full access. Display only; the server enforces access on every setup.
export function AccessBanner({ access, onChange }: { access: AccessView; onChange: (next: AccessView) => void }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [request, setRequest] = useState<RequestState>({ kind: "idle" });
  if (access.level === "admin" || access.level === "full") return null;

  const blocked = access.level === "blocked";
  async function sendRequest() {
    if (request.kind === "sending") return;
    setRequest({ kind: "sending" });
    try {
      const response = await fetch("/api/access-request", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: note }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (response.status === 401) { router.push("/sign-in"); return; }
      if (response.ok && isRecord(body) && isRecord(body.access) && typeof body.access.requestedAt === "string") {
        onChange({ ...access, status: "pending", requestedAt: body.access.requestedAt, decidedAt: null });
        setRequest({ kind: "sent", message: "Request sent. The admin will review it." });
        return;
      }
      const reason = isRecord(body) ? body.reason : undefined;
      if (reason === "already_approved") { router.refresh(); return; }
      if (reason === "already_pending") onChange({ ...access, status: "pending" });
      setRequest({ kind: "error", message: firstError(body) ?? messageOf(body) });
    } catch {
      setRequest({ kind: "error", message: "Unable to reach the server. Check your connection and try again." });
    }
  }

  return (
    <section aria-labelledby="access-heading"
      className={cn("mb-10 rounded-2xl border p-6 shadow-card", blocked ? "border-amber-200 bg-amber-50" : "border-indigo-100 bg-app-primary-light")}>
      <div className="flex items-start gap-3">
        {blocked ? <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /> : <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-app-primary" />}
        <div className="min-w-0 flex-1">
          <h2 id="access-heading" className="text-base font-bold text-app-text">
            {blocked ? "Your free trial call is used" : "Free trial: one 1-minute call"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-app-muted">
            {blocked
              ? "To keep practicing, request full access. The admin reviews each request."
              : "Try FluentAI with a short 1-minute call. To practice for 10–20 minutes, request full access. The admin reviews each request."}
          </p>

          {access.status === "pending" ? (
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-app-primary">
              <Clock className="h-4 w-4" />
              {access.requestedAt ? `Request sent on ${formatAccessDate(access.requestedAt)}.` : "Request sent."} Waiting for the admin&apos;s approval.
            </p>
          ) : null}
          {access.status === "rejected" ? (
            <p className="mt-3 text-sm font-medium text-red-700">
              Your last request was declined{access.decidedAt ? ` on ${formatAccessDate(access.decidedAt)}` : ""}. You can send a new one.
            </p>
          ) : null}

          {canRequestAccess(access) ? (
            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor="access-note" className="text-sm font-semibold text-app-text">Message for the admin (optional)</label>
                <span className="text-xs font-medium text-app-muted">{note.length}/{ACCESS_REQUEST_MESSAGE_MAX}</span>
              </div>
              <textarea id="access-note" value={note} rows={2} maxLength={ACCESS_REQUEST_MESSAGE_MAX}
                onChange={(event) => { setNote(event.target.value); if (request.kind === "error") setRequest({ kind: "idle" }); }}
                placeholder="Why you want to practice, or who you are."
                className="w-full rounded-xl border border-app-border bg-white px-4 py-3 text-sm leading-6 text-app-text outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-app-primary focus-visible:ring-4 focus-visible:ring-indigo-100" />
              <button type="button" onClick={sendRequest} disabled={request.kind === "sending"} aria-busy={request.kind === "sending"}
                className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-app-primary px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60">
                <Send className="h-4 w-4" />{request.kind === "sending" ? "Sending…" : "Request full access"}
              </button>
            </div>
          ) : null}
          {request.message ? (
            <p role={request.kind === "error" ? "alert" : "status"}
              className={request.kind === "error" ? "mt-2 text-xs font-medium text-red-600" : "mt-2 text-xs font-medium text-green-700"}>
              {request.message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function messageOf(value: unknown): string {
  return isRecord(value) && typeof value.message === "string" ? value.message : "We could not send your request. Please try again.";
}

function firstError(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.fieldErrors)) return undefined;
  const errors = value.fieldErrors as FieldErrors;
  return Object.values(errors).find((message) => typeof message === "string");
}
