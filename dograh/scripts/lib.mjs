// Shared helpers for the Dograh workflow scripts (run from the repo root with Node 22+).
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Reads DOGRAH_API_BASE_URL / DOGRAH_API_KEY from the environment or FluentAI's .env.local.
export function dograhApiConfig() {
  const envFile = resolve(process.cwd(), ".env.local");
  if (existsSync(envFile)) {
    try { process.loadEnvFile(envFile); } catch { /* fall back to the process environment */ }
  }
  const baseUrl = (process.env.DOGRAH_API_BASE_URL || "http://localhost:8020").trim().replace(/\/+$/, "");
  const apiKey = (process.env.DOGRAH_API_KEY || "").trim();
  if (!apiKey) throw new Error("Set DOGRAH_API_KEY (an API key from the Dograh dashboard) in .env.local.");
  return { baseUrl, apiKey };
}

export async function dograhRequest(path, { method = "GET", body } = {}) {
  const { baseUrl, apiKey } = dograhApiConfig();
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: { "X-API-Key": apiKey, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Dograh ${method} ${path} failed: HTTP ${response.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

// Instance-specific references that must not be committed or imported into another instance.
const INSTANCE_FIELDS = ["credential_uuid", "pre_call_fetch_credential_uuid", "greeting_recording_id"];
const INSTANCE_LISTS = ["tool_uuids", "document_uuids"];

export function stripInstanceReferences(definition) {
  const copy = structuredClone(definition);
  for (const node of copy.nodes ?? []) {
    const data = node.data ?? {};
    for (const field of INSTANCE_FIELDS) if (field in data) data[field] = null;
    for (const field of INSTANCE_LISTS) if (field in data) data[field] = [];
    if ("mcp_tool_filters" in data) data.mcp_tool_filters = null;
  }
  for (const edge of copy.edges ?? []) {
    if (edge.data && "transition_speech_recording_id" in edge.data) edge.data.transition_speech_recording_id = null;
  }
  return copy;
}
