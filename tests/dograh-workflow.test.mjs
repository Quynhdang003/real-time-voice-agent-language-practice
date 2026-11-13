import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { parseSpecBlocks, buildWorkflowDefinition, SPEC_PATH, SEED_PATH, WEBHOOK_URL } from "../dograh/scripts/build-seed-workflow.mjs";
const { dograhContextKeys } = loadTs("lib/practice/dograh-context.ts");

const definition = buildWorkflowDefinition(parseSpecBlocks(readFileSync(SPEC_PATH, "utf8")));
const placeholders = (text) => [...text.matchAll(/\{\{([^}]*)\}\}/g)].map((match) => match[1].trim());

test("every prompt variable is a known initial_context key with a fallback", () => {
  const texts = [];
  for (const node of definition.nodes) {
    for (const field of ["prompt", "greeting", "extraction_prompt"]) if (node.data[field]) texts.push(node.data[field]);
    for (const variable of node.data.extraction_variables ?? []) texts.push(variable.prompt);
  }
  for (const edge of definition.edges) texts.push(edge.data.condition);
  const used = new Set();
  for (const text of texts) {
    for (const placeholder of placeholders(text)) {
      const match = /^initial_context\.([a-z_]+) \| (.+)$/.exec(placeholder);
      assert.ok(match, `placeholder must be {{initial_context.<key> | fallback}}: {{${placeholder}}}`);
      assert.ok(dograhContextKeys.includes(match[1]), `unknown context key: ${match[1]}`);
      used.add(match[1]);
    }
  }
  for (const key of ["learner_name", "level", "accent", "speech_pace", "correction_style", "vietnamese_allowed", "topic",
    "scenario", "session_mode", "target_vocabulary", "review_vocabulary", "grammar_focus", "weak_points"])
    assert.ok(used.has(key), `prompts never use ${key}`);
});

test("webhook node posts the FluentAI v2 payload and stays disabled until TR-01", () => {
  const webhook = definition.nodes.find((node) => node.type === "webhook");
  assert.equal(webhook.data.enabled, false);
  assert.equal(webhook.data.http_method, "POST");
  assert.equal(webhook.data.endpoint_url, WEBHOOK_URL);
  assert.equal(webhook.data.credential_uuid, null);
  const template = webhook.data.payload_template;
  assert.equal(template.session_id, "{{initial_context.session_id}}");
  const allowed = new Set(["initial_context.session_id", "workflow_run_id", "transcript_url", "recording_url",
    "gathered_context.call_summary", "cost_info.call_duration_seconds"]);
  for (const value of Object.values(template)) for (const placeholder of placeholders(value)) assert.ok(allowed.has(placeholder), placeholder);
  assert.ok(!definition.edges.some((edge) => edge.source === "webhook" || edge.target === "webhook"));
  const end = definition.nodes.find((node) => node.type === "endCall");
  assert.deepEqual(end.data.extraction_variables.map((variable) => variable.name), ["call_summary"]);
});

test("the committed seed matches the spec", () => {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8"));
  assert.deepEqual(seed.workflow_definition, definition, "run npm run dograh:seed after editing dograh/workflow-spec.md");
});
