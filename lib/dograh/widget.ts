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
