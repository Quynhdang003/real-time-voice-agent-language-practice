// Builds an importable Dograh 1.50.0 workflow definition from dograh/workflow-spec.md.
// The spec's fenced blocks tagged "text <key>" / "json <key>" hold every prompt, condition and the
// webhook payload; the graph structure lives here. Usage: npm run dograh:seed
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const SPEC_PATH = resolve(here, "..", "workflow-spec.md");
export const SEED_PATH = resolve(here, "..", "workflows", "fluentai-tutor.seed.json");
// The production domain (DEP-01): Dograh Cloud cannot reach localhost.
export const WEBHOOK_URL = "https://real-time-voice-agent-language-prac-one.vercel.app/api/dograh/transcript-webhook";

export function parseSpecBlocks(markdown) {
  const blocks = {};
  for (const match of markdown.matchAll(/^```(?:text|json) ([\w.-]+)\r?\n([\s\S]*?)\r?\n```/gm)) {
    if (match[1] in blocks) throw new Error(`Duplicate spec block: ${match[1]}`);
    blocks[match[1]] = match[2].replace(/\r\n/g, "\n").trim();
  }
  return blocks;
}

export function buildWorkflowDefinition(blocks) {
  const text = (key) => {
    if (!blocks[key]) throw new Error(`Missing spec block: ${key}`);
    return blocks[key];
  };
  const prompted = (name, prompt, extra = {}) => ({
    name, prompt, allow_interrupt: true, add_global_prompt: true, extraction_enabled: false, ...extra,
  });
  const nodes = [
    { id: "global", type: "globalNode", position: { x: -320, y: 0 },
      data: { name: "Global tutor rules", prompt: text("global.prompt") } },
    { id: "greeting", type: "startCall", position: { x: 0, y: 0 },
      data: prompted("Greeting", text("start.prompt"), { greeting: text("start.greeting"), greeting_type: "text", is_start: true }) },
    { id: "practice", type: "agentNode", position: { x: 0, y: 220 },
      data: prompted("Practice", text("practice.prompt")) },
    { id: "wrapup", type: "agentNode", position: { x: 0, y: 440 },
      data: prompted("Wrap up", text("wrapup.prompt")) },
    { id: "end", type: "endCall", position: { x: 0, y: 660 },
      data: prompted("End call", text("end.prompt"), {
        allow_interrupt: false, is_end: true, extraction_enabled: true,
        extraction_prompt: text("end.extraction_prompt"),
        extraction_variables: [{ name: "call_summary", type: "string", prompt: text("end.call_summary") }],
      }) },
    { id: "webhook", type: "webhook", position: { x: 360, y: 660 },
      data: {
        name: "Send transcript to FluentAI",
        // Off until FluentAI TR-01 (Bearer auth + session_id lookup) ships; see workflow-spec.md.
        enabled: false,
        http_method: "POST",
        endpoint_url: WEBHOOK_URL,
        credential_uuid: null,
        custom_headers: [],
        payload_template: JSON.parse(text("webhook.payload_template")),
      } },
  ];
  const edge = (source, target, label, key) => ({
    id: `${source}-${target}`, source, target, data: { label, condition: text(key) },
  });
  const edges = [
    edge("greeting", "practice", "Start practice", "edge.greeting-practice"),
    edge("practice", "wrapup", "Wrap up", "edge.practice-wrapup"),
    edge("wrapup", "end", "End", "edge.wrapup-end"),
  ];
  return { nodes, edges };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const definition = buildWorkflowDefinition(parseSpecBlocks(readFileSync(SPEC_PATH, "utf8")));
  mkdirSync(dirname(SEED_PATH), { recursive: true });
  writeFileSync(SEED_PATH, `${JSON.stringify({ name: "FluentAI Tutor", workflow_definition: definition }, null, 2)}\n`);
  console.log(`Wrote ${SEED_PATH} (${definition.nodes.length} nodes, ${definition.edges.length} edges)`);
}
