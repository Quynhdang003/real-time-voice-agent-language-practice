# Code Standards

## General

- Keep modules small and single-purpose: one domain concern per file in
  `lib/practice/` and `lib/dograh/`
- Domain logic is pure and gets its dependencies injected. A `*Store`/`*Reader`
  object passed as an argument provides `transaction`, `readDocument`,
  `writePatch`, `generate`, `onError`, `now` and so on. Real SDK wiring lives
  only in the `server.ts` adapters.
- Results are discriminated unions: `{status: "ok", …} | {status: "not_found" | …}`.
  Do not throw across boundaries for expected outcomes.
- Fix root causes, do not layer workarounds. Keep comments for the reason
  behind non-obvious behavior (see `lib/dograh/call.ts`).

## TypeScript

- `strict: true` (`tsconfig.json`). Do not use `any`.
- External input (request bodies, Firestore documents, widget callbacks,
  webhook payloads, Gemini output) is `unknown` until a type guard or parser
  accepts it.
- Reuse the guards in `lib/practice/guards.ts` (`isRecord`, `isKeyOf`,
  `isOneOf`, `isBoundedText`, `normalizeText`, `textKey`) and in
  `lib/practice/session.ts` (`isLabel`, `isRunId`, `isCallDuration`,
  `isPracticeSessionId`). Validators return `Validated<T>` with dotted
  `fieldErrors` paths.
- New practice modules import from `guards.ts` / `catalog.ts`, not from
  `session.ts`. `session.ts` may import them, which avoids import cycles.
- Parsers are allowlists. They copy known fields into a new object, enforce
  length and count limits, and return `null` on any invalid field.
- Enumerations are `as const` arrays or objects, with types derived from them
  (`(typeof practiceLevels)[number]`, `keyof typeof practiceLanguages`).
- `lib/practice/session.ts` is shared by client and server. Keep React, icons
  and Firebase SDKs out of it.
- Versioned documents: new writes carry `schemaVersion` (sessions and reviews
  are v2 from SET-03 / RV-01). Parsers branch on it and keep reading older
  versions.
  - Keep two separate checks: "creatable", which accepts only current values
    (English, CEFR A1–C2, 10/15/20 minutes), and "readable", which also accepts
    legacy values (other languages, `Beginner`, 5 minutes), so old sessions
    never become `invalid_data`.
- The client and the server share the same validation functions (pure modules
  in `lib/practice/`). The server is the authority and returns `fieldErrors`.

## Next.js

- This is Next.js 16. Read `node_modules/next/dist/docs/` before writing
  framework code (see `AGENTS.md`).
- Server components are the default. Add `"use client"` only for browser
  interactivity (forms, the setup screen, the call experience, the review
  panel, the user menu).
- Use the generated route types: `PageProps<"/voice-call">`, `LayoutProps<"/">`,
  `RouteContext<"/api/practice-session/[sessionId]/call-event">`. Always `await`
  `searchParams` and `params`. Run `npx next typegen` before `npx tsc --noEmit`
  when routes change.
- Session pages call `getPracticeSession(searchParams.sessionId)`:
  - `unauthenticated` → `redirect("/sign-in")`
  - any other non-`ok` status → `<SessionAccessNotice status={…} />`
- Each page sets `export const metadata = { title: "…" }`. The root layout adds
  the `%s | FluentAI` template.
- Server-only modules start with `import "server-only"` (`firebase/admin.ts`,
  `lib/practice/server.ts`, `lib/dograh/server.ts`, `lib/ai/review.ts`).

## Firebase

- Server code uses `adminAuth` / `adminDb` from `firebase/admin.ts`. Firestore
  is never read or written from the browser.
- Browser code uses `auth` / `storage` from `firebase/client.ts`, only for
  sign-in, registration, password reset and the profile-photo upload. Set
  `inMemoryPersistence` and sign the client out once the server session cookie
  exists.
- Every Firestore write sets `updatedAt: FieldValue.serverTimestamp()`. New
  documents also set `createdAt`.
- State changes that depend on the current document (call events, the review
  claim) run inside `adminDb.runTransaction`. Ownership is read in the same
  transaction.
- Webhook updates write nested fields with dot paths (`dograh.transcript`), so
  call fields are not overwritten.

## Styling

- Use the `app-*` color tokens (`bg-app-primary`, `text-app-text`,
  `text-app-muted`, `border-app-border`, …) and the shadows `shadow-card` /
  `shadow-highlight` defined in `app/globals.css`.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Current practice also uses raw Tailwind palette classes for tints and states
  (`bg-indigo-50`, `hover:bg-indigo-700`, `ring-indigo-100/200`, `slate-*`,
  `red-*`, `emerald-*`, `green-*`). Match nearby code. No token exists for these
  yet.
- Follow the radius usage in `ui-context.md`.

## API Routes

- `export const runtime = "nodejs"`.
- Order: `getCurrentUser()` (or the webhook secret) → `request.json()` in
  `try/catch` → call one `lib/` function → map its `status` through a
  `failures` table to `[httpStatus, message]`. Wrap the handler in `try/catch`
  that returns a generic 500.
- Never accept `userId` or ownership from the body. Pass `user.id` from the
  cookie.
- Admin routes and the `/admin` page: `getCurrentUser()`, then
  `isAdmin(user.id)` (`lib/practice/access.ts`, compared with `ADMIN_UID` on
  the server). Anyone else gets the same 404 as a missing route. Never accept
  `kind`, access status or an admin flag from the body or the client
  (ACC-01…ACC-03).
- Response shape: `{success: true, …}`, or `{success: false, message}` (plus
  `reason` where the client branches on it). Keep `api-contracts.md` in sync.
- Log as `console.error("[area.action]", {code: error.name})`. Never log
  documents, tokens, URLs or provider messages.

## Data and Storage

- Session data, call metadata, the parsed transcript and the review all live
  on the `practiceSessions` document, within the parser limits in
  `lib/practice/session.ts`.
- Binary media stays outside Firestore: profile photos in Firebase Storage,
  call audio and the raw transcript in Dograh. Store URLs only.
- Pages and the client receive `PracticeSession` from `parsePracticeSession`,
  never a raw document. `userId` and timestamps are not exposed.
- Empty optional input is stored as `null` (scalars) or `[]` (lists), never as
  `"none"` or `""`. The literal `"none"` and `"; "`-joined lists are produced
  only by the Dograh context builder (`lib/practice/dograh-context.ts`).
- Compare vocabulary and weak points case-insensitively after trimming and
  collapsing whitespace, but store the learner's original spelling.
- AI output is untrusted input. Store a review only after the v2 validator
  passes (see `api-contracts.md` → Review v2). Never repair it silently.

## Dograh Configuration

- `dograh/workflow-spec.md` is the source of truth for the workflows (American
  and British). They must stay identical except for the TTS voice.
- Prompts, greetings, edge conditions and the webhook payload live only in the
  spec's fenced blocks tagged `text <key>` / `json <key>`. The graph shape lives
  in `dograh/scripts/build-seed-workflow.mjs`.
  - After editing either, run `npm run dograh:seed`.
    `tests/dograh-workflow.test.mjs` fails when the committed seed is stale, or
    when a placeholder is not `{{initial_context.<known key> | fallback}}`.
- Change a live workflow in the Dograh Cloud UI only together with the spec,
  then re-export it with `npm run dograh:export -- <id> <file>`. Never
  hand-edit `dograh/workflows/*.json`.
- Dograh Cloud is upgraded by Dograh, not by this repo. When Cloud behaves
  differently from `context/api-contracts.md` → "Dograh platform contract",
  update the contract (and "Observed on Dograh Cloud") first, then the code.
- Exports must not contain credential UUIDs, embed tokens or provider keys.
  Those are re-linked by hand after an import.
- Every prompt variable is written as `{{initial_context.<key> | <fallback>}}`.
  A missing key without a fallback renders as an empty string.
- `.env.example` lists every variable name with an empty or placeholder value
  and no secrets. Update it in the same change that adds or removes a variable.

## Deployment (Vercel)

- Code runs unchanged on Vercel Functions and on `next dev`. Do not write to
  the file system at runtime, and do not keep state in memory between
  requests.
- Work after a response uses `after()` only, and must finish within the
  route's `maxDuration`. Never start a promise without awaiting it or passing
  it to `after()`.
- A route whose outbound work can take more than a few seconds (the webhook,
  `generate-review`) exports `maxDuration = 60`, which fits the Vercel Hobby
  plan. Nothing may rely on running longer.
- Hosts and URLs come from environment variables. No `localhost` URL or
  provider host is hard-coded in app code. A default value may name the
  production provider, as `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` does with
  `app.dograh.com`.
- A new variable is added, in the same change, to `.env.example`, to the
  Environment Variables table in `architecture.md` (with where it is set),
  and to the unit's manual steps for the Vercel project.
- No FluentAI variable is `NEXT_PUBLIC_*` (after DG-05). A value the browser
  needs, such as the widget script URL, is read on the server and passed as
  a prop, only to the user who is allowed to use it. Secrets stay
  server-only.
- Keep `patches/jwks-rsa+4.1.0.patch` and the `postinstall` script: Firebase
  Admin needs them on Vercel (C-06).

## Imports and Modules

- Use the `@/` alias by default.
- Modules loaded by the `--experimental-strip-types` test use relative imports
  with the `.ts` extension and no `@/` alias: `lib/practice/session.ts`,
  `call-state.ts`, `read-session.ts`, `lib/dograh/call.ts`, `widget.ts`.
- Style: double quotes and semicolons. `components/ui/*` keeps the shadcn
  generator's style.

## Tests

- `tests/*.test.mjs` use `node:test` + `node:assert/strict`. TS modules load
  through `loadTs(entry, mocks)` (`tests/helpers/load-ts.mjs`), and fixtures
  come from `tests/helpers/fixtures.mjs`.
- `loadTs` also loads `.tsx` components (JSX `react-jsx`). Component tests
  render the initial markup with `react-dom/server` `renderToStaticMarkup`
  and mock `next/navigation`; effects do not run there, so polling and retry
  rules live in pure modules (e.g. `lib/practice/review-view.ts`) and are
  tested directly.
- Mock only external boundaries (Firebase, Gemini, `fetch`, the widget). Test
  the real domain logic.
- `npm test` runs everything with synchronous `require(ESM)` disabled. Type
  safety is checked separately by `tsc` / `next build`.
- Every validator gets boundary tests: min/max counts, lengths, duplicates
  (case-insensitive), `;` in items, and fabricated evidence for reviews.
- Update `docs/TESTING.md` when coverage or real-service results change.

## File Organization

- `app/` — routes only: `(auth)/`, `(root)/`, `api/`, root layout, `globals.css`
- `components/fluent/` — feature components and the `use-dograh-widget` hook;
  `components/fluent/types.ts` holds presentation types
- `components/layout/` — app chrome (header)
- `components/ui/` — generated shadcn primitives (protected)
- `lib/practice/`, `lib/dograh/`, `lib/ai/`, `lib/actions/` — logic by domain
- `firebase/` — SDK initialization
- `dograh/` — workflow spec, workflow exports and import/export scripts for
  Dograh Cloud (DG-02, DG-03, DC-01)
- `tests/`, `scripts/` (smoke checks), `patches/`, `docs/`, `context/`
