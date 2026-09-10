"use client";

import { useEffect, useRef, useState } from "react";
import { createVoiceCall, type VoiceState } from "@/lib/dograh/call";
import { isDograhWidget } from "@/lib/dograh/widget";
import type { PracticeSession } from "@/lib/practice/session";
import type { CallEvent } from "@/lib/practice/call-state";

async function saveEvent(sessionId: string, event: CallEvent) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`/api/practice-session/${sessionId}/call-event`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event), keepalive: true, signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return;
      if (response.status < 500) throw new Error("rejected");
    } catch (error) {
      if (error instanceof Error && error.message === "rejected") throw error;
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("Unable to save call event");
}

export function useDograhWidget(session: PracticeSession) {
  const controller = useRef<ReturnType<typeof createVoiceCall> | null>(null);
  const [state, setState] = useState<VoiceState>(() => ({
    status: session.status === "ready" ? "ready" : session.status === "completed" ? "completed" : "failed",
    elapsed: session.dograh?.durationSeconds ?? 0,
    error: session.status === "active" || session.status === "connecting"
      ? "This session has a previous connection. It cannot be resumed in this tab. Create a new practice session."
      : session.status === "failed" ? "This call has ended. Create a new practice session to try again." : "",
  }));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (session.status !== "ready") return;
    let disposed = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let frame: HTMLIFrameElement | undefined;
    const stopLoading = () => { clearInterval(poll); clearTimeout(timeout); };
    const release = () => { stopLoading(); frame?.remove(); };
    const unavailable = (message: string) => {
      release();
      if (!disposed) setState({ status: "failed", elapsed: 0, error: message });
    };
    // A separate same-origin document gives each session its own widget instance.
    // Removing it cancels even a pending getUserMedia/start, preventing late audio.
    try {
      const source = process.env.NEXT_PUBLIC_DOGRAH_WIDGET_SRC?.trim();
      if (!source) throw new Error("Voice calling is not configured. Set NEXT_PUBLIC_DOGRAH_WIDGET_SRC and restart the app.");
      const url = new URL(source);
      if (!["https:", "http:"].includes(url.protocol) || !url.searchParams.get("token")) {
        throw new Error("The Dograh embed URL is invalid. Use the script URL from the workflow's Embed settings.");
      }
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires HTTPS or localhost and a supported browser.");
      }
      if (window.location.protocol === "https:" && url.protocol === "http:") {
        throw new Error("The Dograh widget must use HTTPS when this page uses HTTPS.");
      }
      frame = document.createElement("iframe");
      frame.title = "Dograh voice connection";
      frame.hidden = true;
      frame.allow = "microphone; autoplay";
      const context = {
        language: session.language.name, topic: session.topic.name, level: session.level,
        tutor_name: session.tutor.name, duration_minutes: session.durationMinutes,
      };
      // about:blank reports location.origin as "null" to the upstream widget.
      // A real same-origin document preserves Dograh's allowed-domain checks.
      frame.src = "/dograh-frame.html";
      frame.onload = () => {
        if (disposed) return;
        const documentInFrame = frame?.contentDocument;
        if (!documentInFrame) { unavailable("Unable to initialize voice calling in this browser."); return; }
        const script = documentInFrame.createElement("script");
        script.src = url.href;
        script.async = true;
        script.onerror = () => unavailable("Unable to load Dograh. Check that the voice service is running and the embed URL is reachable.");
        script.setAttribute("data-dograh-context", JSON.stringify(context));
        documentInFrame.body.appendChild(script);
      };
      document.body.appendChild(frame);
      poll = setInterval(() => {
        if (disposed) return;
        const widget = (frame?.contentWindow as (Window & { DograhWidget?: unknown }) | null)?.DograhWidget;
        if (!isDograhWidget(widget) || !widget.getState().isInitialized) return;
        const config = widget.getState().config;
        if (config.widgetType !== "voice" || config.embedMode !== "headless" || config.autoStart) {
          unavailable("Configure this Dograh embed as Voice, Headless, with Auto start disabled.");
          return;
        }
        stopLoading();
        widget.setContext(context);
        controller.current = createVoiceCall({
          widget, durationMinutes: session.durationMinutes,
          save: (event) => saveEvent(session.id, event),
          change: (next) => { if (!disposed) setState(next); },
          release,
        });
        setLoaded(true);
      }, 100);
      timeout = setTimeout(() => unavailable("Dograh did not become ready. Check the embed token, allowed domains, and voice service."), 25_000);
    } catch (error) {
      // Defer state updates until after the effect's synchronous setup.
      queueMicrotask(() => { if (!disposed) unavailable(error instanceof Error ? error.message : "Voice calling is unavailable."); });
    }
    const offline = () => controller.current?.offline();
    const leave = () => controller.current?.dispose();
    window.addEventListener("offline", offline);
    window.addEventListener("pagehide", leave);
    return () => {
      disposed = true;
      window.removeEventListener("offline", offline);
      window.removeEventListener("pagehide", leave);
      controller.current?.dispose();
      controller.current = null;
      release();
    };
  }, [session]);

  return { ...state, loaded, start: () => controller.current?.start(), end: () => controller.current?.end() };
}
