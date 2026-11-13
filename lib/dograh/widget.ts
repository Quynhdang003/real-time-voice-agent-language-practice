// Verified against Dograh's public embed/dograh-widget.js (voice, headless mode).
// Callback payloads deliberately stay unknown at the provider boundary.
export type DograhWidget = {
  start: () => void | Promise<void>;
  end: () => void | Promise<void>;
  setContext: (context: Record<string, string | number>) => void;
  getState: () => {
    isInitialized: boolean;
    connectionStatus: string;
    config: { widgetType?: string; embedMode?: string; autoStart?: boolean };
  };
  onCallConnected: (callback: ((data: unknown) => void) | null) => void;
  onCallDisconnected: (callback: ((data: unknown) => void) | null) => void;
  onCallEnd: (callback: (() => void) | null) => void;
  onError: (callback: ((error: unknown) => void) | null) => void;
  onStatusChange: (callback: ((status: string) => void) | null) => void;
};

export function isDograhWidget(value: unknown): value is DograhWidget {
  if (!value || typeof value !== "object") return false;
  return ["start", "end", "setContext", "getState", "onCallConnected", "onCallDisconnected", "onCallEnd", "onError", "onStatusChange"]
    .every((name) => typeof (value as Record<string, unknown>)[name] === "function");
}

export type WidgetAccent = "american" | "british";

// One Dograh workflow per accent (the TTS voice differs). The script URLs carry the embed token, so they are
// server-only variables: a NEXT_PUBLIC_ value would be inlined into the public JS bundle (DG-05).
export function widgetSourceVariable(accent: WidgetAccent): string {
  return accent === "british" ? "DOGRAH_WIDGET_SRC_BRITISH" : "DOGRAH_WIDGET_SRC_AMERICAN";
}

// Only a session that can still start a call receives a URL; legacy v1 sessions use the American workflow.
export function selectWidgetSource(
  session: { status: string; profile?: { accent: WidgetAccent } },
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  if (session.status !== "ready") return undefined;
  return env[widgetSourceVariable(session.profile?.accent ?? "american")]?.trim() || undefined;
}
