// Creates a workflow in FluentAI's Dograh from a JSON file ({name?, workflow_definition}).
// Usage: npm run dograh:import -- "FluentAI Tutor - American" [dograh/workflows/fluentai-tutor.seed.json]
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dograhRequest, stripInstanceReferences } from "./lib.mjs";

const [name, file = "dograh/workflows/fluentai-tutor.seed.json"] = process.argv.slice(2);
if (!name) {
  console.error('Usage: npm run dograh:import -- "<workflow name>" [file.json]');
  process.exit(1);
}
const source = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));
if (!source?.workflow_definition?.nodes) throw new Error(`${file} has no workflow_definition.nodes`);

const created = await dograhRequest("/workflow/create/definition", {
  method: "POST",
  body: { name, workflow_definition: stripInstanceReferences(source.workflow_definition) },
});
console.log(`Created workflow ${created?.id ?? "?"}: ${created?.name ?? name}`);
console.log("Next: set models/voice, select the webhook credential, publish, then create the embed token (dograh/README.md).");
