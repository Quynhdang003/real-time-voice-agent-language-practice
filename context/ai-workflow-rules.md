# AI Workflow Rules

## Approach

Build FluentAI incrementally using a spec-driven workflow. The files in
`context/` define what to build (`project-overview.md`), how the system is
structured (`architecture.md`, `api-contracts.md`), how it looks
(`ui-context.md`), how code is written (`code-standards.md`), and where work
stands (`progress-tracker.md`). Always implement against these specs. Do not
infer or invent behavior from scratch. This Next.js version has breaking
changes: read the relevant guide in `node_modules/next/dist/docs/` before
writing Next.js code (see `AGENTS.md`).

## Scoping Rules

- Work on one feature unit at a time
- Prefer small, verifiable increments over large
  speculative changes
- Do not combine unrelated system boundaries in a
  single implementation step

## System Boundaries

- `app/` — pages, layouts and thin API route handlers
- `lib/` — domain logic (`lib/practice`), Dograh integration (`lib/dograh`),
  Gemini (`lib/ai`), server actions (`lib/actions`)
- `firebase/` — SDK initialization (client: Auth + Storage; admin: Auth +
  Firestore)
- `dograh/` (DG-02, DG-03, DC-01) — the workflow spec, workflow exports and
  import/export scripts for Dograh Cloud (`https://app.dograh.com`). The live
  configuration (providers, voices, credentials, embed tokens, allowed
  domains, Webhook node endpoint) is set by hand in the Dograh Cloud UI. The
  self-hosted Docker stack (DG-01) was deleted in DC-02.
- Firebase config — Auth settings (including authorized domains), security
  rules and indexes, managed in the Firebase console, outside this repo
- Vercel project (DEP-01) — Git link, Production Branch, Node.js version,
  environment variables, domain and Deployment Protection, managed in the
  Vercel dashboard, outside this repo

## When to Split Work

Split an implementation step if it combines:

- The browser call controller (`lib/dograh/call.ts`,
  `components/fluent/use-dograh-widget.ts`) and the server call state machine
  (`lib/practice/call-state.ts`)
- Transcript ingestion (`lib/dograh/transcript-webhook.ts`,
  `fetch-transcript.ts`, `transcript-parser.ts`) and review generation
  (`lib/practice/review-state.ts`, `lib/ai/review.ts`)
- UI changes and changes to the Firestore document shape
- App code changes and changes to external configuration (Dograh Cloud
  workflow, embed or Webhook node; Firebase rules or authorized domains;
  Vercel project settings or environment variables)
- Changes to `dograh/workflow-spec.md` / workflow exports and FluentAI code
  changes that depend on them. Land the spec first, then the code.
- Destructive data operations (e.g. legacy session cleanup) and any other
  change. Run them only after the user confirms the exact rule.
- Behavior not clearly defined in the context files

If a change cannot be verified end to end quickly,
the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the
  context files
- If a requirement is ambiguous, resolve it in the
  relevant context file before implementing
- If a requirement is missing, add it as an open question
  in `progress-tracker.md` before continuing

## Protected Files

Do not modify the following unless explicitly instructed:

- `components/ui/*` — generated shadcn primitives
- `patches/jwks-rsa+4.1.0.patch` and the `overrides` / `postinstall` entries in
  `package.json` — required for Firebase Admin on Vercel (see README)
- The `nextjs-agent-rules` block in `AGENTS.md` — managed by `next dev`
- `.env*` files and `next-env.d.ts`. Exception: `.env.example` (names only, no
  secrets) may be created and updated.
- `dograh/workflows/*.json` — regenerate with the export script, never edit
  by hand
- Any third-party library internals (`node_modules/`)
- External Dograh Cloud, Firebase and Vercel configuration — describe the
  required change instead of assuming it was applied

## Keeping Docs in Sync

Update the relevant context file whenever implementation
changes:

- System architecture or boundaries
- Storage model decisions
- API routes, request/response shapes or error codes (`api-contracts.md`)
- Assumptions about the Dograh platform contract
- Code conventions or standards
- Feature scope

## Before Moving to the Next Unit

1. The current unit works end to end within its defined scope
2. No invariant defined in `architecture.md` was violated
3. `progress-tracker.md` reflects the completed work
4. `npm test` passes
5. `npm run build` passes
6. `npm run lint` passes. Until the two baseline errors listed in
   `progress-tracker.md` (N-02c, N-06) are fixed, a unit must not add new lint
   errors. After they are fixed, lint must be clean.
7. Units whose Verify column names the deployment (DEP-01, DC-01,
   ACC-02, ACC-03, LIM-01, TR-01…TR-03, E2E-01) are checked on Vercel
   production after `main` is deployed. Local tests alone do not complete them, because Dograh Cloud
   delivers webhooks only to the production domain.
