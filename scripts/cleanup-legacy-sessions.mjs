// DATA-01: remove legacy v1 practice sessions (rule in legacy-sessions-rule.mjs).
//
//   npm run data:cleanup-legacy                     dry run: lists the matching sessions, changes nothing
//   npm run data:cleanup-legacy -- --apply --expect=N
//                                                   deletes them, only if exactly N still match
//
// Uses the Firebase Admin credentials in .env.local (the shared development/production project).
// Prints session IDs, dates and groups only: never user data, transcripts or credentials.
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { legacyCleanupGroup, legacyGroups } from "./legacy-sessions-rule.mjs";

const clean = (value) => (value ?? "").trim().replace(/,\s*$/, "").trim().replace(/^["']/, "").replace(/["']$/, "");
const projectId = clean(process.env.FIREBASE_PROJECT_ID);
const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n").trim();
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY (run with --env-file=.env.local).");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const expectArg = process.argv.find((arg) => arg.startsWith("--expect="));
const expected = expectArg ? Number(expectArg.slice("--expect=".length)) : NaN;
if (apply && !Number.isInteger(expected)) {
  console.error("--apply needs --expect=<count from the dry run>.");
  process.exit(1);
}

const db = getFirestore(initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }));
const snapshot = await db.collection("practiceSessions").get();
const matches = [];
const kept = { v2: 0, v1: 0 };
for (const doc of snapshot.docs) {
  const data = doc.data();
  const group = legacyCleanupGroup(data);
  if (group) matches.push({ id: doc.id, group, createdAt: data.createdAt?.toDate?.().toISOString().slice(0, 10) ?? "?" });
  else kept["schemaVersion" in data ? "v2" : "v1"] += 1;
}

console.log(`Project ${projectId}: ${snapshot.size} practice sessions.`);
for (const [group, label] of Object.entries(legacyGroups)) {
  const rows = matches.filter((match) => match.group === group);
  console.log(`\nGroup ${group} (${label}): ${rows.length}`);
  for (const row of rows) console.log(`  ${row.id}  ${row.createdAt}`);
}
console.log(`\nTo delete: ${matches.length}. Kept: ${kept.v2} v2 + ${kept.v1} other v1 sessions.`);

if (!apply) {
  console.log(`Dry run only. To delete, run again with: --apply --expect=${matches.length}`);
  process.exit(0);
}
if (matches.length !== expected) {
  console.error(`Expected ${expected} matching sessions but found ${matches.length}; nothing was deleted.`);
  process.exit(1);
}
for (let index = 0; index < matches.length; index += 400) {
  const batch = db.batch();
  for (const { id } of matches.slice(index, index + 400)) batch.delete(db.collection("practiceSessions").doc(id));
  await batch.commit();
}
console.log(`Deleted ${matches.length} sessions.`);
