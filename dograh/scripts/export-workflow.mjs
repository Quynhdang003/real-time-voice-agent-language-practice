// Exports a workflow definition from FluentAI's Dograh into dograh/workflows/<file>.json,
// without credentials, embed tokens, recordings or provider settings.
// Usage: npm run dograh:export -- <workflowId> <file-name>   e.g. 1 fluentai-tutor-american
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dograhRequest, stripInstanceReferences } from "./lib.mjs";

const [workflowId, fileName] = process.argv.slice(2);
if (!/^[1-9]\d*$/.test(workflowId ?? "") || !/^[\w-]+$/.test(fileName ?? "")) {
  console.error("Usage: npm run dograh:export -- <workflowId> <file-name>");
  process.exit(1);
}
const workflow = await dograhRequest(`/workflow/fetch/${workflowId}`);
const output = {
  name: workflow.name,
  exported_from: { dograh_version: "1.50.0", workflow_id: workflow.id, version_number: workflow.version_number ?? null },
  workflow_definition: stripInstanceReferences(workflow.workflow_definition),
};
const dir = resolve(process.cwd(), "dograh", "workflows");
mkdirSync(dir, { recursive: true });
const target = resolve(dir, `${fileName}.json`);
writeFileSync(target, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Exported workflow ${workflow.id} (${workflow.name}) to ${target}`);
