# Architecture Context

Sections describe the **current code** unless marked **[planned UNIT]** or
**[retired]**. Planned items were decided on 2026-11-09 (v2) or 2026-11-13
(Vercel deployment and Dograh Cloud). Their units are in `progress-tracker.md`.

## Stack

| Layer      | Technology                                                    | Role                                                              |
| ---------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Framework  | Next.js 16.3.3 (App Router) + React 19.2.8 + TypeScript 5 (strict) | Pages, server actions, API route handlers, `after()` for background work [planned] |
| UI         | Tailwind CSS v4 + shadcn (`base-nova`, `@base-ui/react`) + lucide-react | Styling, a few generated primitives, icons                        |
| Auth       | Firebase Authentication (client SDK 12, Admin SDK 14)         | Email/password sign-in; server session cookie                     |
| Database   | Cloud Firestore (accessed only through the Admin SDK)         | Profiles, practice sessions, transcripts, reviews                 |
| File store | Firebase Storage (client SDK)                                 | Optional profile photos                                           |
| Voice      | **[planned DC-01]** Dograh Cloud, `https://app.dograh.com` (hosted; the version is set by Dograh). Embed widget: voice, headless. The self-hosted Dograh 1.50.0 stack (DG-01) is **[retired]** | Real-time English tutor; end-of-call Webhook node                 |
| AI review  | Google Gemini via `@google/genai`, model `gemini-3.5-flash-lite` (available, checked 2026-11-09) | Structured JSON review of the transcript                          |
| Hosting    | **[done DEP-01]** Vercel, Hobby plan: a new project (Git integration, Production Branch `main`, `real-time-voice-agent-language-prac-one.vercel.app`) | Serves pages and route handlers as Node.js Functions; `after()` runs through Vercel's `waitUntil` |
| Runtime    | Node.js 24.x on Vercel; `next dev` on `localhost:3000` for development | `patch-package` (`jwks-rsa`) kept for Firebase Admin on Vercel    |
| Tests      | `node:test` + `tests/helpers/load-ts.mjs`                     | Logic tests with mocked providers                                 |

## System Boundaries

- `app/(auth)/` — `/sign-in`, `/register`. Signed-in users are redirected to `/`.
- `app/(root)/` — `/`, `/voice-call`, `/review`. Anonymous users are redirected
  to `/sign-in`. **[done ACC-03]** `/admin`: only the `ADMIN_UID` account;
  any other signed-in user gets `notFound()`.
- `app/api/` — thin route handlers: authenticate → parse → call `lib/` → map to
  HTTP.
- `lib/practice/` — the domain:
  - `catalog.ts`: static languages, topics, tutors and legacy levels/durations
  - `guards.ts`: shared type guards, text normalization, `FieldErrors` /
    `Validated`
  - `profile.ts`, `session-setup.ts`: v2 validators (SET-01)
  - `session.ts`: types and parsers; re-exports the catalog and `isRecord`
  - `read-session.ts`
  - `call-state.ts`: call state machine
  - `review-state.ts`: review claim and generation
  - `server.ts`: Firestore adapters
  - `dograh-context.ts`: widget context builder (SET-05)
  - **[planned LIM-01]** `call-quota.ts`: pure daily-limit rules (day key in
    `Asia/Ho_Chi_Minh`, calls left, reset time, allow/deny)
  - **[done ACC-01]** `access.ts`: pure access rules (`parseUserAccess`,
    `isAdmin`, `accessLevelOf`, `sessionKindFor`). **[done ACC-02]** It also
    has `AccessView`, `accessViewOf`, `canRequestAccess`, `requestAccess` and
    `formatAccessDate` (Vietnam time). **[done ACC-03]** It also has the
    admin transitions (`decideAccess`, `isUserId`) and the list rows
    (`toAccessAccountRow`, `accessAccountLists`).
  - **[done ACC-02]** `access-server.ts`: Firestore adapters
    (`getAccessView`, `requestUserAccess`; one transaction on `users/{uid}`,
    `set` with merge). **[done ACC-03]** It also has `isAdminUser`,
    `decideUserAccess`, `listAccessAccounts` (single-field queries on
    `access.status`, at most 200 each, sorted in memory) and
    `countPendingRequests` (`count()` for the header badge).
  - **[done ACC-01]** `create-session.ts`: the session-creation transaction
    (`createPracticeSessionForUser`, pure). Its adapter is
    `createPracticeSession` in `server.ts`.
- `lib/dograh/` — the widget type, the browser call controller, transcript
  fetch/parse/webhook logic and `server.ts`.
- `lib/ai/` — the Gemini client and the review prompt/schema (`server-only`).
- `lib/actions/auth.action.ts` — auth server actions.
- `firebase/` — `client.ts` (Auth, Storage), `admin.ts` (`server-only`; Auth,
  Firestore).
- `components/fluent/`, `components/layout/`, `components/ui/` (generated).
- `public/dograh-frame.html` — same-origin host document for the widget.
- `dograh/` **[done DG-01…DG-03; Dograh Cloud changes planned DC-01, DC-02]**:
  - Kept for Dograh Cloud:
    - `workflow-spec.md`: the source of truth for prompts and graph
    - `workflows/fluentai-tutor.seed.json`: built from the spec;
      `workflows/*.json` hold exports without credentials or tokens
    - `scripts/`: `build-seed-workflow.mjs`, `import-workflow.mjs`,
      `export-workflow.mjs`, `lib.mjs`. They call the Dograh Cloud API
      (`DOGRAH_API_BASE_URL=https://app.dograh.com`, DC-01).
    - `README.md`: manual steps, in Vietnamese; rewritten for Dograh Cloud in
      DC-01
  - **[retired]** Self-hosted stack, deleted in DC-02 (decided 2026-11-13):
    `docker-compose.yml`, `.env.example` (for `dograh/.env`),
    `scripts/backup.ps1`, `scripts/restore.ps1`
- External, configured by hand:
  - In the Dograh Cloud UI: providers, voices, credentials, embed tokens,
    allowed domains and the Webhook node endpoint.
  - In the Firebase console: rules, indexes and Auth authorized domains.
  - **[planned DEP-01]** In the Vercel dashboard: Git link, Production Branch,
    Node.js version, environment variables, domain and Deployment Protection.

## Dograh Platform

- **[planned DC-01] Dograh Cloud** (`https://app.dograh.com`), in the user's
  account. Decided 2026-11-13. It replaces the self-hosted stack for both
  development and production, as in the first version of the project (commit
  `b8af366`).
  - Dograh hosts and upgrades it, so FluentAI cannot pin the version. The
    platform contract in `api-contracts.md` was verified on the 1.50.0 source.
    DC-01 re-checks what FluentAI relies on with real Cloud calls.
  - Two workflows (American, British), built from `dograh/workflow-spec.md`
    and imported with `npm run dograh:import`. The API key comes from the
    Cloud dashboard.
  - One embed token per workflow. Allowed domains: `<production-domain>` and
    `localhost:3000`. Preview deployments are not listed.
  - The widget script is served by Dograh Cloud. Its URL is copied from the
    Cloud embed dialog. DC-01 checks whether it needs `apiEndpoint` when the
    page runs on `localhost:3000`: the 1.50.0 widget defaults to
    `http://localhost:8000` on localhost.
  - Webhook node: `https://<production-domain>/api/dograh/transcript-webhook`
    in both workflows. Dograh Cloud cannot reach `localhost`, so deliveries
    for calls started in development also go to the deployment (see
    Deployment).
  - Transcript links: expected at
    `https://app.dograh.com/api/v1/public/download/workflow/{token}/transcript`,
    answering 302 to Dograh's storage host with a URL signed for 1 h. DC-01
    confirms this with a real call and records the storage host, which is then
    allowlisted.
  - Backups: FluentAI does not back up Dograh Cloud data. Recovery is a
    re-import of the JSON exports in `dograh/workflows/`, then re-linking the
    credential, voices and embed tokens by hand.
- **[retired] FluentAI's self-hosted stack (DG-01, built and verified
  2026-11-10):** `dograh/docker-compose.yml` (compose project
  `fluentai-dograh`, Dograh 1.50.0 pinned by tag and digest, ports
  3020/8020/9020/9021 on 127.0.0.1, `host.docker.internal` for the webhook),
  plus `backup.ps1` / `restore.ps1`. It is no longer used. DC-02 deletes it,
  with the `dograh:up|down|logs|backup` scripts and the `local` transcript
  mode.
- The ai-companion project's Dograh (API `:8010`, UI `:3010`, MinIO `:9000`) is
  not used by FluentAI.

## Deployment (Vercel) **[done DEP-01, 2026-11-13]**

- **Project:** a new Vercel project on the **Hobby** plan, created in DEP-01
  and linked to the GitHub repo. The Production Branch is `main`, so every
  push to `main` deploys production. Other branches get Preview deployments.
  The Vercel project that deployed the old `production` branch is not reused.
  That branch is deleted in DEP-01.
- **Build:** `npm ci` (its `postinstall` applies `patches/jwks-rsa+4.1.0.patch`),
  then `next build`, on Node.js 24.x from `package.json` `engines`.
- **Domain:** the new project's default production domain,
  **`real-time-voice-agent-language-prac-one.vercel.app`** (recorded in
  DEP-01, 2026-11-13). The context files write it as `<production-domain>`.
  No custom domain. The Dograh embed tokens, the
  Webhook node and the Firebase authorized domains all use it, so renaming the
  project later means re-configuring them.
- **Deployment Protection:** Preview deployments stay protected (the Vercel
  default), so Dograh never posts to them. Their URLs are not allowed embed
  domains either. Calls run only on the production domain and on
  `localhost:3000`.
- **Functions:** every route uses `runtime = "nodejs"`. **[planned TR-03]** The
  webhook and `generate-review` routes export `maxDuration = 60`, which fits
  the Hobby plan with or without Fluid Compute. Within those 60 s, the webhook
  answers in ≤ 15 s and the `after()` Gemini review uses the rest. If an
  invocation is cut off, the 3-minute `processing` lease lets the review page
  claim the review again.
- **Environment variables:** set in the Vercel project settings (see the table
  below). A change applies only to new deployments, so redeploy after it.
  After DG-05 no FluentAI variable is `NEXT_PUBLIC_*`, so none is inlined
  into the client bundle.
- **Development:** `npm run dev` on `localhost:3000` with `.env.local`. It uses
  the same Firebase project and the same Dograh Cloud workflows as production
  (decided 2026-11-13). A webhook for a call started in development reaches
  the deployment, which finds the session in the shared Firestore and
  processes it. Development and production data share Firestore, and calls
  started in development use the same daily call limit.
- **Firebase:** one project for development and production. The production
  domain is added to Auth → Authorized domains. The session cookie is
  `secure` in production, which HTTPS satisfies.
- **Verification:** `TEST_BASE_URL=https://<production-domain> npm run
  test:smoke`, then a check that the Function logs have no `ERR_REQUIRE_ESM`
  (C-06).

## Storage Model

- **Firestore `users/{uid}`**: `name`, `email`, `photoURL` (string | null),
  `emailVerified`, `createdAt`, `updatedAt`, `lastLoginAt`.
  - **[planned SET-02]** `learnerProfile`: `{learnerName, nativeLanguage:
    "Vietnamese", level: "A1"|…|"C2", accent: "american"|"british",
    speechPace: "slow"|"normal", correctionStyle:
    "gentle_recast"|"immediate"|"end_of_session", vietnameseAllowed:
    "never"|"only_when_stuck", updatedAt}`. Written only by **Save as
    default**.
  - **[planned LIM-01]** `callQuota`: `{day: "YYYY-MM-DD", used: int ≥ 0}`.
    `day` is the calendar day in `Asia/Ho_Chi_Minh`. Written only by the
    transaction that creates a practice session. A missing field, or a `day`
    other than today, means 0 calls used.
  - **[done ACC-01: read and `trialUsed`; ACC-02: the request fields; ACC-03: decisions]**
    `access`:
    - `status`: `none | pending | approved | rejected`
    - `trialUsed`: boolean
    - `requestedAt`: ISO string | null
    - `requestMessage`: string ≤ 300 | null
    - `decidedAt`: ISO string | null

    Timestamps are ISO strings written by server code, like
    `dograh.startedAt`, so the pure rules need no Firestore types.

    A missing field means `{status: "none", trialUsed: false}`, which covers
    accounts created before ACC-01. Writers:
    - `trialUsed` is written only by the session-creation transaction;
    - `status: pending` and the request fields only by the request route;
    - `approved` / `rejected` and `decidedAt` only by the admin route.

    The auth actions never write `access`. The admin account's own `access`
    is ignored.
- **Firestore `practiceSessions/{autoId}`**:
  - v1, current and legacy:
    - `userId`, `language {id, name}`, `topic {id, name}`, `level`
      (`Beginner|A1|A2|B1|B2`), `durationMinutes` (5|10|15), `tutor {id, name,
      role}`, `status` (`ready|connecting|active|completed|failed`),
      `createdAt`, `updatedAt`
    - `dograh {workflowRunId, agentId?, startedAt, endedAt, durationSeconds,
      endReason, transcriptUrl, recordingUrl, summary, transcript [{role, text,
      at}], transcriptStatus}`
    - `reviewStatus`
    - `review` (0–100 metrics). No stored session has a `review` today.
  - **[done SET-03] v2 (`schemaVersion: 2`)** keeps `userId`, `status`,
    `dograh`, `tutor`, timestamps, and adds:
    - `language: {id: "english", name: "English"}`
    - `topic: {id: "custom", name: <free text>}`
    - `level`: CEFR A1–C2 for this session; the single source of the session
      level
    - `durationMinutes`: 10|15|20
    - `profile: {learnerName, nativeLanguage, accent, speechPace,
      correctionStyle, vietnameseAllowed}`: snapshot used by this session
      (`level` lives at the top level)
    - `setup: {scenario, sessionMode, targetVocabulary: string[8–12],
      reviewVocabulary: string[] (0 or 3–5), grammarFocus: string | null,
      weakPoints: string[] (0–5)}`
    - `weakPointsSourceSessionIds: string[]` [planned RV-03]
    - **[done ACC-01]** `kind: "trial" | "full"`. A trial session has
      `durationMinutes: 1`, and the parser rejects a trial of any other
      length or a full session of 1 minute. A v2 session without `kind` is
      read as `full`.
  - **[planned TR-02]** `dograh.transcriptError`: a reason code
    (`untrusted_url|redirect_rejected|http_4xx|http_5xx|timeout|too_large|invalid_utf8|network`).
    Never a URL.
  - **[planned TR-03]** `reviewStatus`: `pending|processing|completed|failed`,
    plus `reviewClaimedAt` (lease).
  - **[planned RV-01]** `review` v2 (`schemaVersion: 2`); see
    `api-contracts.md` → Target contracts.
  - Optional fields left empty are stored as `null` or `[]`, never `"none"`.
  - Parsers read v1 and v2. New writes are v2 only.
- **Firebase Storage**: `profile-photos/{uid}/avatar.{jpg|png}`.
- **Dograh Cloud (external)**: audio and the transcript file in Dograh's
  storage. FluentAI stores only URLs.
- Security rules and indexes are not versioned in this repo. RV-03 needs a
  composite index on `practiceSessions`: `userId` +
  `reviewStatus` + `createdAt desc`.

## Auth and Access Model

- The browser signs in with the Firebase client SDK (`inMemoryPersistence`), and
  the ID token is exchanged in the `signIn`/`signUp` server action. Tokens older
  than 5 minutes are rejected. The result is the 7-day httpOnly session cookie
  `fluentai_session` (`secure` in production, `sameSite: lax`). The client then
  signs out of Firebase.
- `getCurrentUser()` verifies the cookie with revocation checking. Layouts
  protect pages; API routes check auth themselves. There is no middleware or
  proxy.
- One owner (`userId`) per session. Another user's session answers like a
  missing one (`not_found`). **[planned SET-02]** The profile is read and
  written only for the cookie's `uid`.
- **Access levels** (enforced at session creation since ACC-01; the
  request flow and the admin page are planned in ACC-02 and ACC-03):
  - **Trial:** any account that is not approved. It may create one session
    with `kind: "trial"` (1 minute).
  - **Full:** an account with `access.status: "approved"`. It may create
    `full` sessions (10/15/20 minutes) within the daily limit (LIM-01).
  - **Admin:** the single account whose `uid` equals `ADMIN_UID`. It has full
    access without the daily limit, and it alone can see and
    decide access requests. `isAdmin` is computed on the server from the
    cookie's `uid` on every request. It is never stored on the client or
    read from a body. With `ADMIN_UID` unset, nobody is admin and `/admin`
    is a 404.
  - The access level is checked on the server when a session is created.
    Pages only display it. Existing sessions stay readable, and their call
    and review continue after a revoke.
- Dograh → FluentAI webhook:
  - Current: header `x-dograh-webhook-secret`.
  - **[planned TR-01]** `Authorization: Bearer <DOGRAH_WEBHOOK_SECRET>`, from
    the Webhook node's `bearer_token` credential (Dograh sends no signature).
    It travels over HTTPS from Dograh Cloud to the production domain.
- The embed token sits in the widget script URL.
  - **[done DG-05]** The URLs are server-only. `/voice-call` passes the URL
    for the session's accent only to the owner of a `ready` session, so
    anonymous visitors and learners without a callable session never see it.
    Before DG-05 it was in the public JS bundle (`NEXT_PUBLIC_*`).
  - A learner in a call can still read the token. Allowed domains stop
    browsers on other origins, but not scripted requests. This residual risk
    is accepted for the thesis.
  - **[planned LIM-01, ACC-01]** The trial rule and the daily call limit
    bound the calls started through FluentAI.
  - The 1-minute trial ends through the browser countdown, which a user can
    bypass. Calls made with the token outside FluentAI are not counted. DC-01
    sets a Dograh Cloud spending limit and a maximum call duration (20
    minutes, the longest full session) if they exist.
- Registration stays open to anyone (decided 2026-11-13). Use beyond the
  trial needs the admin's approval.

## Dograh Call Flow

1. `/voice-call` creates a hidden iframe (`/dograh-frame.html`) and injects the
   embed script with `data-dograh-context`. It waits until `DograhWidget` is
   initialized as voice, headless, with `autoStart` off, then calls
   `setContext`.
   - **[done DG-04]** The script is chosen by the session's accent:
     `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN` / `_BRITISH`; v1 sessions use
     American. Each points at its own workflow's embed token. **[planned
     DC-01]** Both are Dograh Cloud script URLs. **[done DG-05]** They are
     server-only `DOGRAH_WIDGET_SRC_AMERICAN` / `_BRITISH`. The `/voice-call`
     server component picks the URL (`selectWidgetSource`) and passes it as
     the `widgetSrc` prop, only for the owner's `ready` session.
   - **[done SET-05]** The context is the 18 v2 keys from `buildDograhContext`,
     with `session_id` first (see `api-contracts.md`).
2. **Start Call** calls `widget.start()` synchronously in the click. The widget
   POSTs `/api/v1/public/embed/init` with `context_variables`. Dograh sanitizes
   them (verified in the 1.50.0 source; re-checked on Dograh Cloud in DC-01):
   - names must not contain `.`, whitespace, `|` or `{}`
   - at most 50 variables, each ≤ 2,000 chars, ≤ 8 KiB in total
   - reserved keys are dropped

   Dograh then creates the run with them as `initial_context`, before the
   microphone permission prompt.
3. `onCallConnected({workflowRunId})` → the `connected` event is saved. The
   countdown auto-ends the call at the chosen duration. The end saves
   `disconnected`/`error`, removes the iframe and opens `/review`.
4. After the run, Dograh's worker sends the Webhook node:
   - Current: payload with `workflow_run_id` + `transcript_url`; the session is
     found by run ID.
   - **[planned TR-01]** Flat payload with `session_id` from
     `{{initial_context.session_id}}`. The webhook endpoint is
     `https://<production-domain>/api/dograh/transcript-webhook` (Dograh
     Cloud → Vercel).
5. Webhook → download (`https://app.dograh.com/api/v1/public/download/…`,
   expected to answer 302 to Dograh's storage with a URL signed for 1 h;
   confirmed in DC-01) → parse → store.
   - Current: download failures are acknowledged with 200. Public mode
     rejects redirects, so every download from Dograh Cloud fails today
     (N-01f).
   - **[planned TR-02]** Public mode follows up to 3 redirects and validates
     every hop against the allowlist. Transient failures answer 503, so Dograh
     retries (≤ 5 attempts). The final attempt stores `error` with a reason
     code.
6. Review:
   - Current: triggered by the review page (`generate-review`).
   - **[planned TR-03]** The webhook marks `reviewStatus: pending` and starts
     generation with `after()`, which Vercel keeps alive up to the route's
     `maxDuration`. The page call stays as a fallback. A `processing` claim
     older than the lease (3 min) can be reclaimed.

## Invariants

1. `userId` comes only from the verified session cookie, never from a request
   body, query or client state.
2. Every read or change of a session or profile checks ownership first. Never
   reveal whether another user's document exists.
3. Firestore is accessed only through the Admin SDK in `server-only` modules.
   The client SDK is used only for Auth and the profile-photo upload.
4. Documents and provider payloads are `unknown` until parsed by an allowlist
   parser. Raw documents never reach the client.
5. The call state only moves forward. Terminal states never reopen,
   `workflowRunId` is set once, identical repeats are no-ops, and changes run
   in transactions.
6. At most one Gemini review runs per session at a time (claimed
   `processing`). A completed review is never regenerated automatically.
7. The webhook fails closed without a configured secret. Downloads come only
   from allowlisted HTTPS hosts (`DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`), with
   ≤ 256 KiB, 15 s, ≤ 3 redirects, strict UTF-8 and no forwarded credentials.
   **[planned TR-02]** Every redirect target is checked against the same
   allowlist before it is requested. The current code also has a `local` mode
   with exact local origins, which DC-02 removes with the self-hosted stack.
8. Logs never contain documents, tokens, signed URLs, transcript text or
   provider messages.
9. Domain logic gets its storage and providers injected. SDK calls live only in
   the adapters (`server.ts`, `lib/ai/*`, `lib/actions/*`).
10. **[planned TR-01]** The webhook links a delivery to a session **only by
    `session_id`**. The run ID is a cross-check, never the lookup key. Run IDs
    belong to one Dograh instance: the stored runs 10–44 come from earlier
    local stacks, and Dograh Cloud numbers its runs on its own, so the same ID
    can name different calls.
11. **[planned TR-01, TR-02]** Webhook processing is idempotent per
    `(session_id, workflow_run_id)` and answers within Dograh's 30 s timeout.
    Review generation never runs inside the webhook response.
12. **[planned RV-01]** A review is stored only if it passes the v2 validator:
    - every listed word or weak point is judged exactly once;
    - every evidence quote is found in a learner turn;
    - scores are integers 1–5.
13. **[done SET-05]** `"none"` and `"; "`-joined lists exist only in the
    Dograh context. Firestore stores `null` / arrays.
14. **[done DEP-01, DG-05]** Every FluentAI variable is server-only (Vercel
    project settings, `.env.local`); none is `NEXT_PUBLIC_*`. The only
    configuration value that reaches the browser is the widget script URL for
    one callable session, passed as a prop by `/voice-call`. The Dograh API
    key is never set on Vercel.
15. **[planned LIM-01]** The daily call limit is checked and incremented in
    the same Firestore transaction that creates the session. A session is
    never created over the limit, and used calls are never given back. The
    count shown on the page is only advisory.
16. **[done ACC-01]** The session kind and duration are decided by the
    server from the stored access, in the same transaction that sets
    `trialUsed` and creates the session. The body never chooses `kind`, and a
    trial account never gets more than one session or more than 1 minute.
17. **[done ACC-02, ACC-03]** `access.status` changes only in two places:
    the owner's request route (`none` / `rejected` → `pending`) and the admin
    route (`pending` → `approved` / `rejected`, `approved` → `rejected`).
    Both run in transactions. Admin routes and the admin page answer 404 to
    everyone except `ADMIN_UID`.

## Environment Variables

Names only. Values live in the Vercel project settings (production) and
`.env.local` (development), plus `dograh/.env` for the retired stack until
DC-02. `.env.example` documents every name with no secrets (DG-04). Restart
`npm run dev` after editing `.env.local`. Redeploy on Vercel after changing a
variable there.

"Where" says where a value must be set: **V** = Vercel, **L** = `.env.local`.

| Variable | Used by | Where | Notes |
| --- | --- | --- | --- |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | `firebase/admin.ts` | V, L | Required. `firebase/admin.ts` turns `\n` escapes in the private key into newlines |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `lib/ai/gemini.ts` | V, L | Required for reviews |
| `NEXT_PUBLIC_DOGRAH_WIDGET_SRC`, `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN`, `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_BRITISH` | nothing | Neither | No longer read since DG-05 (they put the token into the public bundle). Delete them from `.env.local` |
| `DOGRAH_WIDGET_SRC_AMERICAN`, `DOGRAH_WIDGET_SRC_BRITISH` | `/voice-call` page (server, `selectWidgetSource`) → `use-dograh-widget.ts` prop | V, L | **[done DG-05]** Required per accent. Server-only. **[planned DC-01]** Dograh Cloud script URLs, copied from the Cloud embed dialog (e.g. `https://app.dograh.com/embed/dograh-widget.js?token=…`; whether `apiEndpoint` is needed locally is checked in DC-01) |
| `PRACTICE_DAILY_CALL_LIMIT` | `POST /api/practice-setup`, the home page | V, L | **[planned LIM-01]** Full calls per approved learner per day (`Asia/Ho_Chi_Minh`). A positive integer; unset or invalid → the default 5 (decided 2026-11-13). Server-only; the page receives the computed count |
| `ADMIN_UID` | `createPracticeSession` (`lib/practice/server.ts` → `isAdmin`); `/admin` and the admin routes from ACC-03 | V, L | **[done ACC-01]** The Firebase Auth UID of the single admin account (the user registers it normally, then copies its UID from the Firebase console). Server-only. Unset → no admin |
| `DOGRAH_WEBHOOK_SECRET` | webhook route | V (L only to test the route locally) | Required. Unset means 401. **[planned TR-01]** Used as the Bearer token; the same value goes into the Dograh Cloud `bearer_token` credential |
| `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` | `lib/dograh/server.ts` | V | Public mode. The code defaults to `app.dograh.com`. **[planned DC-01]** Set to `app.dograh.com` plus the storage host found in DC-01 |
| `DOGRAH_TRANSCRIPT_MODE`, `DOGRAH_TRANSCRIPT_LOCAL_ORIGINS` | `lib/dograh/server.ts` | Neither | **[retired]** Only for the self-hosted stack. Must stay unset on Vercel. DC-02 removes them from the code |
| `DOGRAH_API_KEY`, `DOGRAH_API_BASE_URL` | `dograh/scripts/lib.mjs` (import/export); `DOGRAH_API_KEY` also by the unused `getDograhRun` | L only, never V | The API key is created in the Dograh Cloud dashboard. The base URL defaults to `https://app.dograh.com` (since batch 1; DC-01 confirms the API path) |
| `DOGRAH_JWT_SECRET`, `DOGRAH_*_PASSWORD`, `DOGRAH_MINIO_ROOT_*`, `DOGRAH_ENABLE_SIGNUP`, `DOGRAH_*_PORT` | `dograh/docker-compose.yml` via `dograh/.env` | Neither | **[retired]** Self-hosted stack only; removed in DC-02 |
| `DOGRAH_WORKFLOW_ID` | `getDograhRun` (unused) | Neither | **[planned TR-01]** Removed along with `getDograhRun`. The scripts take workflow IDs as arguments |
| `TEST_BASE_URL`, `BROWSER_TEST_TOOLING` | `scripts/*` | Shell | Test scripts only. `TEST_BASE_URL=https://<production-domain>` for the deployment smoke check |

The Firebase web config is hard-coded in `firebase/client.ts`.
