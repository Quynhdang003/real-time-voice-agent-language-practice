# Progress Tracker

Update this file after every meaningful implementation
change.

## Current Phase

- v2 in progress. Done in code (2026-11-10):
  - phase (3) English-only and phase (4) setup: EN-01, SET-01…SET-05
  - the code side of phase (1), the Dograh workflows: DG-01…DG-04
- **Scope change on 2026-11-13 (CTX-02, docs only, approved by the user on
  2026-11-13, C-19):**
  - public deployment on Vercel (new project, Hobby, default domain);
  - Dograh Cloud (`https://app.dograh.com`) replaces the self-hosted Dograh
    stack, as in the first version of the project;
  - one 1-minute trial call per account, and full use only after the single
    admin approves it;
  - a daily call limit for approved learners;
  - the embed script URLs become server-only.

  DG-01 (the Docker stack) is retired. DG-02…DG-04 stay valid with Dograh
  Cloud values. DG-05 changes how DG-04 passes the URLs.
- Pending manual steps by the user:
  - the SET-04 UI check
  - the new Vercel project (DEP-01)
  - the Dograh Cloud setup: providers, the 2 workflows, the credential, the
    embed tokens, `.env.local` and the Vercel variables (I-02)
  - the real call check per accent (DC-01)
- Next units: DEP-01 → DG-05 → DC-01 → ACC-01 → ACC-02 → ACC-03 → LIM-01 →
  TR-01.
- Working today with real services: sign-in → practice setup (v1) → real
  Dograh voice call → `completed`. This was run locally, against Dograh
  instances that are gone now.
- The transcript → review pipeline exists in code but has never produced a
  `ready` transcript or a review (see Session Notes).

## Current Goal

- Deliver v2 on a public Vercel deployment with Dograh Cloud:
  - English-only practice
  - learner profile and new session variables
  - two tutor workflows rebuilt in Dograh Cloud
  - `main` deployed on Vercel, with local development kept
  - one 1-minute trial call per account, and access approval by a single
    admin
  - a daily call limit for approved learners
  - a webhook linked by `session_id`, with a background review
  - review v2 and weak-point carry-over

Order: (3) English → (4) setup → (1) Dograh → (5) Vercel + Dograh Cloud →
(2) transcript/review.

## Completed

Only work confirmed against real services, or by checks that run real code
without mocks.

- **C-01** Sign-in sets the server session cookie (`fluentai_session`, 7 days,
  revocation-checked).
  - Verify: `tests/auth.test.mjs`.
  - Exercised for real as a prerequisite of C-03 to C-05.
- **C-02** Page protection and API 401s.
  - Verify: `npm run start -- -p 3100`, then `npm run test:smoke` (9/9 on
    2026-09-10, `docs/TESTING.md`).
- **C-03** `POST /api/practice-setup` (v1) creates an owned session, and the
  app opens `/voice-call?sessionId=…`.
  - Verify: run it for real; `tests/practice-session.test.mjs`,
    `tests/api.test.mjs`.
- **C-04** `/voice-call` loads only the owner's session.
  - Verify: run it for real; `tests/practice-session.test.mjs`.
- **C-05** Real voice call through the Dograh widget, reaching `completed` with
  `workflowRunId`, `startedAt`, `endedAt` and `durationSeconds` (32 completed
  sessions in Firestore).
  - Verify: a real call; `tests/dograh-call.test.mjs`.
- **C-06** Firebase Admin works with synchronous `require(ESM)` disabled.
  - Verify: `npm run test:firebase-runtime`.
- **C-07** Tooling baseline on 2026-11-09: `npm test` 45/45 pass;
  `npx next typegen && npx tsc --noEmit --incremental false` passes.
- **C-08** CTX-01: context files updated with the v2 decisions (docs only,
  2026-11-09).
  - Verify: read `context/*.md`. No code changed.
- **C-09** EN-01 English only (2026-11-09):
  - `parseCreatablePracticeSetup` accepts only `english`; `parsePracticeSetup`
    still reads all 6 languages.
  - The language picker, `language-card.tsx` and its sample progress data are
    removed.
  - `.language-check.mjs` is deleted (fixes N-06).
  - Verify:
    - `npm test` 46/46 (new: English-only creation, legacy Japanese session
      still parses, API rejects `japanese` with 400)
    - `tsc` and `npm run build` pass
    - lint: only the N-02c baseline error remains
- **C-10** SET-01 pure validators (2026-11-09):
  - `lib/practice/profile.ts`: profile enums, defaults, `validateLearnerProfile`,
    `learnerProfileDraft`.
  - `lib/practice/session-setup.ts`: `validateSessionSetup` with the
    `api-contracts.md` field rules.
  - Shared helpers moved to `lib/practice/guards.ts` and the static catalog to
    `lib/practice/catalog.ts`; both are re-exported by `session.ts`, so no
    import cycle.
  - Verify: `tests/setup-v2.test.mjs` (6 tests); `npm test` 52/52;
    `npm run test:dograh-call` 5/5 (strip-types); `tsc` and build pass.
- **C-11** SET-02 learner profile storage (2026-11-10):
  - `saveLearnerProfile` (pure, `profile.ts`)
  - `updateLearnerProfile` / `getLearnerProfileDraft` (`profile-server.ts`)
  - `PUT /api/learner-profile`
  - Verify: `npm test` 54/54 (save validation/ownership, route 401/400/200/500);
    smoke script now also checks PUT 401; `tsc` and build pass. A real
    Firestore write is checked in SET-04.
- **C-12** SET-03 session v2 (2026-11-10):
  - `createPracticeSessionDocumentV2` writes `schemaVersion: 2`.
  - `parsePracticeSession` dispatches v1/v2 and rejects unknown versions. v2
    is re-validated with the creation rules.
  - The DTO has `schemaVersion`, `profile?` and `setup?`.
  - `POST /api/practice-setup` accepts `{profile, setup}` (400 with
    `fieldErrors`). The v1 body is still accepted until SET-04.
  - Verify: `npm test` 56/56 (round-trip, corrupt v2 rejected, v1 still
    parsed, API stores v2 with the cookie's `userId` and English);
    strip-types 5/5; `tsc` and build pass.
- **C-13** SET-04 setup form v2 (2026-11-10):
  - `/` now passes the stored profile (or the defaults) to
    `HomePracticeSetup`.
  - **Session** block: topic with suggestions, scenario with counter, mode
    pills, target/review/weak-point chip inputs, grammar focus, 10/15/20.
  - **Learner profile** block: name, CEFR A1–C2, accent, pace, correction
    style, Vietnamese use, and **Save as default**.
  - Client validation reuses `validatePracticeSetupRequest`, and server
    `fieldErrors` show under each field.
  - New components: `option-pills.tsx`, `chip-input.tsx`. `topic-card.tsx` and
    `parseCreatablePracticeSetup` are removed, and the route rejects the v1
    body.
  - Verify: `npm test` 56/56; `tsc` and build pass; lint shows only the N-02c
    baseline.
  - **Manual check pending (user):** sign in → the form pre-fills the profile
    → field errors show → **Save as default** persists after a reload → Start
    creates a v2 session.
- **C-14** SET-05 Dograh context (2026-11-10):
  - `lib/practice/dograh-context.ts` builds the 18 keys, with `session_id`
    first; empty values become `"none"` and lists are joined with `"; "`.
    Legacy v1 sessions get the default profile and `"none"`.
  - `use-dograh-widget.ts` sends it through `data-dograh-context` +
    `setContext` (the hook now takes `learner.name`).
  - `dograhContextBytes` reproduces Dograh's size rule (Python `json.dumps`,
    `ensure_ascii`).
  - Verify: `tests/dograh-context.test.mjs` (4 tests, including the
    largest-ASCII-setup limit check); `npm test` 60/60; strip-types 5/5;
    `tsc` and build pass.
  - The real `/init` payload is checked in DG-04.
- **C-15** DG-01 Dograh stack in the repo (2026-11-10):
  - `dograh/docker-compose.yml`:
    - project `fluentai-dograh`
    - images pinned by tag and digest (api/ui 1.50.0, minio 2026.09.22,
      pgvector pg17, redis 7)
    - UI 3020, API 8020, MinIO 9020/9021, all on 127.0.0.1
    - `BACKEND_API_ENDPOINT=http://localhost:8020`,
      `MINIO_PUBLIC_ENDPOINT=http://localhost:9020` (the scheme is required)
    - `host.docker.internal:host-gateway`
  - Also: `dograh/.env.example`, `dograh/README.md` (Vietnamese manual steps),
    `scripts/backup.ps1` / `restore.ps1` (requires `-Force`), npm scripts
    `dograh:*`, and `.gitignore` (`!.env.example`, `/dograh/backups/`).
  - Verify (run on 2026-11-10 with a temporary JWT secret):
    - `docker compose config` OK; all 5 services healthy
    - `/api/v1/health` 200, UI 307, `/embed/dograh-widget.js` 200, MinIO live 200
    - from the API container, IPv4 `host.docker.internal:3000` is reachable
      (connection refused while Next.js was stopped)
    - backup → restore `-Force` drill OK, health 200 afterwards; without
      `-Force` the restore refuses
  - The stack was stopped afterwards (`down`, volumes kept), so the user sets
    their own `DOGRAH_JWT_SECRET` before signing up.
  - **Retired on 2026-11-13:** Dograh Cloud replaces this stack. DC-02
    removes it.
- **C-16** DG-02 workflow spec (2026-11-10):
  - `dograh/workflow-spec.md`: global rules, Greeting (startCall), Practice,
    Wrap up, End call (extraction `call_summary`), webhook node (disabled until
    TR-01) with the v2 payload, 3 edges, per-workflow settings.
  - All prompts use `{{initial_context.<key> | fallback}}`.
  - Verify: `tests/dograh-workflow.test.mjs`. Every placeholder is a known
    context key with a fallback; the webhook placeholders are allowlisted; the
    webhook is disabled and unconnected; the committed seed equals the spec.
  - A test call from the Dograh UI is pending (user).
  - Still valid for Dograh Cloud. DC-01 changes the webhook endpoint to the
    production domain and rewrites the self-hosted setup steps.
- **C-17** DG-03 export/import (2026-11-10):
  - `dograh/scripts/build-seed-workflow.mjs` turns the spec into
    `dograh/workflows/fluentai-tutor.seed.json`.
  - `import-workflow.mjs` (`POST /api/v1/workflow/create/definition`) and
    `export-workflow.mjs` (`GET /api/v1/workflow/fetch/{id}`) use `X-API-Key`
    and strip credential/recording/tool references (`lib.mjs`).
  - Verify:
    - the seed passes Dograh 1.50.0's own validators, run offline in the API
      image: `ReactFlowDTO`, node instance, transition-tool and trigger-path
      checks, 0 errors
    - both API paths answer 401 with a bad key, so the routes exist
  - A real import/export needs the user's API key (pending).
  - Reused against Dograh Cloud. DC-01 changes the default base URL to
    `https://app.dograh.com` and checks the two API paths there.
- **C-18** DG-04 FluentAI wiring (2026-11-10):
  - `use-dograh-widget.ts` picks `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN` /
    `_BRITISH` by `session.profile.accent` (v1 sessions → American), with an
    explicit error naming the missing variable.
  - `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` is no longer read.
  - `.env.example` lists every variable; the root README points to `dograh/`.
  - Verify: `npm test` 63/63; `tsc` and build pass; lint shows only the N-02c
    baseline.
  - The real call per accent is pending (user). It is now done on Dograh
    Cloud, in DC-01.
  - DG-05 replaces the two `NEXT_PUBLIC_*` variables with server-only ones.
- **C-19** CTX-02 scope change (docs only, approved by the user on
  2026-11-13). The context files now define:
  - Public deployment on Vercel: a new project on the Hobby plan, Production
    Branch `main`, the default `*.vercel.app` domain, and `maxDuration = 60`.
    The `production` branch is deleted in DEP-01.
  - Dograh Cloud (`https://app.dograh.com`) instead of the self-hosted stack,
    which DC-02 deletes. The webhook goes only to the production domain, and
    public-mode downloads follow validated redirects (TR-02).
  - One Firebase project for development and production.
  - Access model: one 1-minute trial call per account, requests approved by
    the single `ADMIN_UID` account (ACC-01…ACC-03), and a daily call limit for
    approved learners (LIM-01).
  - Server-only embed script URLs (DG-05).

  Verify: read `context/*.md`. No code, spec, README or branch changed.

## In Progress

- **I-01** Implemented, awaiting a real-service check (staging case E01):
  registration + profile document, sign-out, password-reset email,
  profile-photo upload. Run it on the deployment after DEP-01.
- **I-02** Manual Dograh Cloud setup by the user. DC-01 rewrites
  `dograh/README.md` with these steps; the self-hosted steps (`dograh/.env`,
  `dograh:up`, sign-up) are no longer needed.
  1. Sign in at `https://app.dograh.com` and configure the providers (LLM,
     STT, TTS).
  2. Create an API key. Put `DOGRAH_API_KEY` and
     `DOGRAH_API_BASE_URL=https://app.dograh.com` in `.env.local`, then run
     `dograh:seed` + `dograh:import` ×2.
  3. Set the TTS voice per workflow (American, British) and the
     `bearer_token` credential (= the Vercel `DOGRAH_WEBHOOK_SECRET`). Set the
     Webhook node endpoint to
     `https://<production-domain>/api/dograh/transcript-webhook`, and keep the
     node disabled until TR-01 is deployed.
  4. Publish both workflows. Create one embed token per workflow with allowed
     domains `<production-domain>` and `localhost:3000`.
  5. Put both widget URLs in `.env.local` and in the Vercel project as the
     server-only `DOGRAH_WIDGET_SRC_AMERICAN` / `_BRITISH` (after DG-05),
     then restart Next.js and redeploy.
  6. Make a real call per accent on the deployment and on `localhost:3000`,
     then `dograh:export` ×2.
- **I-03** DEP-01, started 2026-11-13.
  - Done in the repo:
    - pre-deploy checks: `npm test` 63/63; typegen + `tsc` pass; lint shows
      only the N-02c baseline; `npm run build` passes; `npm run test:smoke`
      10/10 against `next start -p 3100` (Node 22.15.0 locally)
    - README "Deploy on Vercel" rewritten as the step list (project, Node
      24.x, `npm ci`, Production Branch, protection, variables, Firebase
      authorized domain, verification)
    - `.env.example` transcript comments updated for Vercel
  - **Blocker:** none of the v2 work (EN-01, SET-01…05, DG-01…04, `context/`,
    `dograh/`) is committed. `origin/main` is still `1102a28` (v1), so Vercel
    would deploy v1 until the work is committed and pushed to `main`.
  - Remaining:
    - commit and push (waiting for the user's choice)
    - the user creates the Vercel project, sets the variables and adds the
      Firebase authorized domain (README "Deploy on Vercel")
    - smoke test and log check on the deployment; record the domain here
    - delete the `production` branch locally and on `origin`

## Next Up

Rules for every unit:
- Update the related context file first.
- After coding: `npm test`, `npm run build`, `npm run lint` (no new errors).
- Then update this file.

"Fixes" refers to the known defects listed below the table.

| ID | Unit | Depends on | Verify |
|---|---|---|---|
| **DEP-01** | Vercel deployment of `main`. Steps: (1) create a **new** Vercel project (Hobby), Production Branch `main`, Node.js 24.x, default `<project>.vercel.app` domain, and record the real domain in the context files; (2) set the variables (Firebase, Gemini, `DOGRAH_WEBHOOK_SECRET`, `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`; widget URLs once DC-01 has them); (3) add the domain to Firebase Auth authorized domains; (4) update README "Deploy on Vercel"; (5) once production serves `main`, delete the `production` branch locally and on `origin`. No app behavior change expected (fixes N-04 Node 24, N-07) | CTX-02 ✓ | On the deployment: `TEST_BASE_URL=https://<production-domain> npm run test:smoke` passes; no `ERR_REQUIRE_ESM` in the Function logs; sign-in and setup v2 work; a Preview URL is protected; `git ls-remote origin production` is empty |
| **DG-05** | Server-only embed script URLs (decided 2026-11-13). Rename `NEXT_PUBLIC_DOGRAH_WIDGET_SRC_AMERICAN` / `_BRITISH` to `DOGRAH_WIDGET_SRC_AMERICAN` / `_BRITISH`. The `/voice-call` server component picks the URL by the session's accent (v1 → American) and passes it to `VoiceCallExperience` only for the owner's session in `ready` status, the only status that can start a call. `use-dograh-widget.ts` takes it as a prop and keeps the URL checks and the error that names the missing variable. Update `.env.example` and the README. Done before DC-01, so the user sets each variable once, under its final name | DEP-01 | Tests: URL chosen by accent; no URL for a session that is not `ready`, or for another user's session; a missing variable gives the named error. After `npm run build`, no `dograh-widget.js` or `token=` string in `.next/static`. The real call is checked in DC-01 |
| **DC-01** | Dograh Cloud. Spec first: `workflow-spec.md` webhook endpoint and embed steps; `dograh/README.md` rewritten for Cloud; then `lib.mjs` default base URL `https://app.dograh.com` and `.env.example`. The user does I-02. Re-check the platform contract on Cloud and fill in "Observed on Dograh Cloud" in `api-contracts.md`, including the storage host and any account spending limit (set it if it exists) (fixes N-08) | DEP-01 (needs the domain), DG-05 | `tests/dograh-workflow.test.mjs` passes; a real call per accent on the deployment and on `localhost:3000` reaches `completed`; `/init` carries the 18 keys; the storage host is recorded and set in `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` |
| **ACC-01** | Access model and trial, server side (`api-contracts.md` → Access and trial). Spec first: `workflow-spec.md` tells the tutor how to run a 1-minute session (greeting and 2–3 short exchanges). Then: `lib/practice/access.ts` (pure rules, `isAdmin`), `access-server.ts`; `users/{uid}.access`; session `kind` and the 1-minute trial in the `practice-setup` transaction; 403 `access_required`; v2 parser reads `kind` (missing → `full`) and `durationMinutes: 1` only for trial; `ADMIN_UID` in `.env.example` and on Vercel | DC-01 | Tests: first setup → trial session, `trialUsed` set; second → 403 with no write; approved → full; admin → full; concurrent trial setups create one session; `kind` in the body ignored; old v2 sessions still parse |
| **ACC-02** | Learner side: `POST /api/access-request`; access banner on `/` (trial available, trial used, pending, rejected, approved); trial form without the duration choice; 403 handling | ACC-01 | Route tests (401/400/409/200, `none`/`rejected` → `pending`); on the deployment, a new account sees the trial, makes a 1-minute call that gets reviewed, then sends a request |
| **ACC-03** | Admin side: `/admin` page (pending and approved lists), `POST /api/admin/access/[uid]` (approve/reject/revoke), header link with the pending count, admin-only | ACC-02 | Tests: non-admin → 404 on the page and the route; each transition and invalid one (409); a decision about `ADMIN_UID` → 409. On the deployment: approve → the learner creates a full session; revoke → 403 again |
| **LIM-01** | Daily call limit for approved learners (`api-contracts.md` → Daily call limit). Pure rules in `lib/practice/call-quota.ts`; `users/{uid}.callQuota` checked and incremented in the ACC-01 transaction; 429 `call_limit_reached`; calls left and reset time on `/`; admin exempt; `PRACTICE_DAILY_CALL_LIMIT` in `.env.example` and on Vercel. Share the production URL with other people only after this unit | ACC-03, Open Question 11 (default) | Tests: under the limit → session created and `used` + 1; at the limit → 429 with no session and no write; a new day resets; concurrent requests never pass the limit; invalid env → default. On the deployment, the limit is reached and the form shows it |
| **DC-02** | Delete the retired self-hosted stack (confirmed 2026-11-13): `dograh/docker-compose.yml`, `dograh/.env.example`, `backup.ps1` / `restore.ps1`, the `dograh:up|down|logs|backup` scripts, the `local` transcript mode and its variables; update README, tests and context | DC-01 | `npm test`, build and lint pass; no `localhost:8020`, `fluentai-dograh` or `DOGRAH_TRANSCRIPT_MODE` left in code or docs |
| **TR-01** | Webhook v2: Bearer auth, flat payload, `""` means absent, lookup by `session_id`, run cross-check, idempotent transaction; remove `getDograhRun` / `DOGRAH_WORKFLOW_ID` (fixes N-01a,c,d,e). Then enable the Webhook node in both Cloud workflows | DC-01 | Wrong Bearer → 401; redelivery is a no-op; an old session with the same run ID is untouched; on the deployment, a real Cloud delivery is linked by `session_id` |
| **TR-02** | Download reason codes (`transcriptError`); 503 for transient failures until the final attempt; public mode follows ≤ 3 redirects, each hop validated against the allowlist (fixes N-01b, N-01f) | TR-01 | Tests per reason code and per redirect case (allowed, off-list, too many hops); on the deployment, a real Cloud transcript reaches `ready` |
| **TR-03** | `reviewStatus: pending` + `after()` trigger; 3-minute lease on `processing`; `maxDuration = 60` (Vercel Hobby) on the webhook and `generate-review` routes (fixes N-03a) | TR-02 | On the deployment: the webhook answers in < 15 s and the review completes without opening the page; lease test |
| **RV-01** | Review v2 schema, prompt and validator (fixes N-03b,c,d) | TR-03 | Validator rejects fabricated evidence and missing words; one real Gemini call |
| **RV-02** | Review page v2 + state banners + retry (fixes N-02a,b,c) | RV-01 | Each state via fixtures; two tabs; lint loses the N-02c error |
| **RV-03** | Weak-point carry-over (3 latest completed reviews, max 5). The user creates the composite index | RV-02, SET-04 | Session N+1 shows the weak points of session N, editable |
| **DATA-01** | Legacy session cleanup ("dọn bớt"). The rule must be confirmed first (Open Question 1) | User confirmation | A dry-run list, then deletion; counts recorded here |
| **E2E-01** | Run the end-to-end checklist below on the Vercel deployment and record it in `docs/TESTING.md` | All above | All steps pass |

**End-to-end checklist (E2E-01)**, on `https://<production-domain>` unless
stated otherwise
1. Vercel production serves the latest `main`, and the Dograh Cloud workflows
   match the exports.
2. A v2 session is created, with Firestore `null` for empty optional fields.
3. The `/init` payload carries `session_id`, `"none"` for empty fields and
   `"; "`-joined lists.
4. In the real call, the tutor uses the learner's name, accent, pace, scenario,
   mode and target words. The session ends `completed`.
5. Within 30 s, the delivery is 2xx and the session has
   `transcriptStatus: ready`, then `reviewStatus` goes `pending → processing →
   completed` without the page open.
6. The review passes v2 and shows on `/review`. A refresh does not call Gemini
   again.
7. A redelivery is a no-op; a wrong Bearer gets 401.
8. A forced Gemini failure, then **Try again**, succeeds.
9. The next session shows the carried-over weak points.
10. A call started on `localhost:3000` is delivered to the deployment and
    gets its review (one shared Firebase project).
11. After the daily limit is used, setup answers 429 `call_limit_reached`, no
    session is created, and the form shows the reset time.
12. A new account: one trial session of 1 minute, ended by the countdown and
    reviewed. The second setup gets 403. The request goes pending, the admin
    approves it on `/admin`, the learner creates a full session, and a revoke
    brings back the 403. A non-admin gets 404 on `/admin`.
13. Negative cases:
    - microphone denied
    - a call with no speech → `empty`
    - a delivery answered 503 (a forced transient download failure) → Dograh
      retries → `ready`
    - an old session with a colliding run ID is unchanged
    - a Preview deployment URL cannot start a call (not an allowed embed
      domain)

**Known defects in current code** (each unit above lists which ones it fixes)
- **N-01** Transcript webhook:
  - a. Unknown run → 200 `skipped`; the delivery is lost.
  - b. A failed download is answered with 200, so Dograh does not retry.
  - c. Find-then-update is not transactional.
  - d. The lookup uses the browser-reported run ID with `limit(1)`, so it can
    hit an old session after a reinstall.
  - e. `""` URLs → 400, which Dograh dead-letters.
  - f. Redirects are rejected outside local mode. **In scope since
    2026-11-13:** Dograh Cloud's download links redirect to storage, so every
    Cloud transcript download fails today. Fixed by TR-02.
- **N-02** Review page:
  - a. Polls forever while the transcript is unset.
  - b. Can stay stuck on "Generating your review with AI…" after
    `already_processing` *(inferred)*.
  - c. ESLint `react-hooks/set-state-in-effect` at `review-panel.tsx:35`.
- **N-03** Review generation:
  - a. No lease on `processing`.
  - b. The prompt is fixed to "English language tutor" and English output
    (practice is now English only; the comment language is still open).
  - c. The transcript is cut at 12,000 chars, possibly mid-turn.
  - d. Prompt injection is untested.
- **N-04** Staging cases E01–E13 not run; Node 24 not verified (local 22.15.0;
  DEP-01 verifies it on Vercel); browser smoke not run.
- **N-05** Placeholder data on `/`: "Recent practice", per-language progress,
  a `SessionCard` link without `sessionId`, "View all", "Good evening",
  unused `PerformanceCard`.
- **N-06** ESLint `@next/next/no-assign-module-variable` in
  `.language-check.mjs:14` (removed by EN-01).
- **N-07** The `production` branch (`b4c06f5`) removes the transcript webhook
  and review code. A deployment of it answers webhooks with 404 (runs 40–44).
  DEP-01 deploys `main` from a new Vercel project and deletes the branch.
- **N-08** Self-hosted Dograh values in the repo:
  - `dograh/scripts/lib.mjs` defaults to `http://localhost:8020`.
  - `dograh/workflow-spec.md` uses `http://host.docker.internal:3000` for the
    webhook and `localhost:3020/8020` in the embed steps.
  - `dograh/README.md` describes the Docker stack.
  - The README's Dograh section points to the stack.

  Fixed by DC-01; the stack files themselves go in DC-02.

## Open Questions

1. DATA-01 ("dọn bớt"): which legacy sessions should be deleted?
   - (a) the 17 `ready` sessions that never started a call
   - (b) the 32 `completed` sessions without a transcript
   - (c) both
   - or another rule?
2. Confirm the proposed profile defaults in `api-contracts.md` → Field rules:
   `american`, `normal`, `gentle_recast`, `only_when_stuck`, and no default
   `level` (picked on the first session). SET-02 uses them until confirmed.
3. Review v2 has no pronunciation criterion. Should the "Pronunciation —" card
   be removed from the review page? Are pronunciation scoring, more tutors or
   resuming an interrupted call in scope at all?
4. Is session history / a progress dashboard in scope beyond weak-point
   carry-over? If not, should the placeholder "Recent practice" section (N-05)
   be removed?
5. Is email verification required before practice?
6. Is the 10/15/20-minute limit enough as a client-side timer, or should the
   workflow also wrap up by itself (it cannot see the clock)?
7. Should the stored `recordingUrl` and `summary` be shown to the learner?
8. Where should the Terms of Service and Privacy Policy links (currently `#`)
   point?
9. Should the Firestore/Storage rules and indexes (e.g. the RV-03 composite
   index) be versioned in the repo (`firestore.indexes.json`), or kept only in
   the Firebase console?
10. For C2 sessions, the skill score 5 is assumed to mean "consistently at the
    top of C2 (near-native)". Confirm or adjust.
11. LIM-01: how many calls per approved learner per day? Proposed default: 5
    (each ≤ 20 minutes, so ≤ 100 minutes per learner per day). The value can
    be changed on Vercel through `PRACTICE_DAILY_CALL_LIMIT`. LIM-01 uses 5
    until this is answered.

**Resolved on 2026-11-13** (answers by the user; details in Architecture
Decisions):
- `production` branch (N-07) → delete it, in DEP-01.
- Vercel → a new project, on its default `*.vercel.app` domain.
- Firebase → one project for development and production.
- Self-hosted Dograh stack → delete it completely, in DC-02.
- Cost → registration stays open; calls are limited per learner per day
  (LIM-01).
- Vercel plan → Hobby; `maxDuration = 60`.
- Access model (ACC-01…ACC-03), all proposed defaults accepted:
  - a. one trial call per account in total;
  - b. the trial uses the normal setup form without the duration choice, and
    gets the normal AI review;
  - c. the admin is identified by `ADMIN_UID`;
  - d. the admin has full access without the daily limit;
  - e. the admin can revoke; a rejected or revoked learner can send a new
    request, one pending at a time, with an optional message ≤ 300 chars;
  - f. notifications are in-app only.
- Embed token exposure → the script URLs become server-only, passed only by
  `/voice-call` for the owner's `ready` session (DG-05).

## Architecture Decisions

- **Server session cookie, in-memory client auth.** The client exchanges a
  fresh ID token (≤ 5 min) for a 7-day httpOnly cookie and signs out of the
  Firebase client. Server components and route handlers can then authorize
  every request without client state.
- **Firestore only through the Admin SDK.** Ownership is enforced in server
  code (`isOwnedSession`), so correctness does not depend on client-side
  security rules.
- **One isolated iframe per call session.** Removing it cancels a pending
  start or `getUserMedia`, which `end()` alone does not. A real same-origin
  document keeps Dograh's allowed-domain check working.
- **Injected stores for domain logic.** Logic runs in `node:test` with
  in-memory stores; SDKs stay in thin adapters.
- **Transcript and review stored on the session document**, within bounded
  limits.
- **`jwks-rsa` patch + override** so Firebase Admin starts with synchronous
  `require(ESM)` disabled (README).

Decided 2026-11-09:
- **English only; `language` kept** in the data model. Other languages stay
  readable for legacy sessions.
- **[superseded 2026-11-13] Local only for the thesis.** Next.js runs on the
  host. Public deployment (Vercel, public Dograh, tunnels) is out of scope,
  and so is the redirect issue N-01f. The embed token in the client bundle is
  acceptable for this scope.
- **[superseded 2026-11-13] FluentAI's own Dograh stack** (`fluentai-dograh`,
  pinned 1.50.0, ports 3020/8020/9020/9021), separate from ai-companion. This
  isolates workflows, run IDs and volumes.
- **Accent = TTS voice, through two workflows/embed tokens** (American,
  British) with identical prompts. **Pace = prompt.** Not a pre-call hook: its
  request carries no session context.
- **Link calls by `session_id`** passed in the widget context (→
  `initial_context`) and echoed by the Webhook `payload_template`. Run IDs are
  a cross-check only, because they belong to one Dograh instance (earlier
  local stacks, now Dograh Cloud) and can repeat across instances.
- **Webhook auth = Bearer token** (`bearer_token` credential). The
  `x-dograh-webhook-secret` header is dropped.
- **Webhook = download + store only.** 503 for transient failures lets Dograh
  retry. The review starts with `after()`, and the page can trigger it as a
  fallback under a 3-minute lease.
- **Profile edits in the session form apply to that session only.** **Save as
  default** persists them.
- **Topic is free text** (3–80 chars). Scenario is ≤ 500 chars; vocabulary
  items are phrases ≤ 40 chars, compared case-insensitively. Durations are
  10/15/20.
- **`null` in Firestore, `"none"` only in the Dograh context.**
- **Review v2 has two groups:** objective session goals, and speaking skills
  scored 1–5 against the session's CEFR level. Every judgment is backed by
  evidence from learner turns.
- **Review text is bilingual.** Every comment, explanation and correction is
  `{en, vi}`. Score 5 = the skill already meets the next CEFR level (e.g. B1 →
  B2).
- **Weak points are merged from the 3 latest completed reviews** (drop
  `improved`, dedupe, max 5), pre-filled and editable.
- **`.language-check.mjs` will be deleted**, `.env.example` will be created,
  and workflow JSON exports are stored in the repo.

Decided 2026-11-13 (CTX-02, approved by the user):
- **Public deployment on Vercel.** A new Vercel project on the Hobby plan,
  with Production Branch `main`, Node.js 24.x and the project's default
  `<project>.vercel.app` domain (no custom domain). The old Vercel project is
  not reused. The `production` branch is deleted in DEP-01. Local development
  (`next dev`, `localhost:3000`) stays.
- **One Firebase project** for development and production. Calls started on
  `localhost:3000` are processed by the deployment's webhook.
- **Vercel Hobby limits:** the webhook and `generate-review` routes use
  `maxDuration = 60`. The 3-minute lease covers an invocation that is cut
  off.
- **Dograh Cloud (`https://app.dograh.com`)** for development and production,
  as in the first version of the project. One account, two workflows
  (American, British) and two embed tokens. The allowed domains are the
  production domain and `localhost:3000`. The self-hosted stack (DG-01) is
  retired and deleted completely in DC-02.
- **The Webhook node posts only to the production domain.** Dograh Cloud
  cannot reach `localhost`, and tunnels stay out of scope. Preview
  deployments stay protected and take no calls. Webhook behavior is verified
  on the deployment.
- **Transcript downloads use public mode only.** They follow Dograh's
  redirect to its storage host and validate every hop against the allowlist,
  so N-01f is in scope (TR-02).
- **The platform contract is re-checked on Cloud.** Dograh Cloud's version is
  not pinned, so the 1.50.0 source checks are evidence only. DC-01 re-checks
  what FluentAI relies on with real calls. A later Cloud change that breaks
  the contract becomes a new unit.
- **The embed script URLs are server-only (DG-05).** This replaces the
  DG-04 choice of `NEXT_PUBLIC_*` variables. `/voice-call` passes the URL for
  the session's accent only to the owner of a `ready` session, so anonymous
  visitors and the public JS bundle never see the token. A learner in a call
  can still read it. That residual risk is accepted, and limited by the
  allowed domains and a Dograh Cloud spending limit if one exists.
- **Registration stays open; calls are limited** to a number per learner per
  day (`Asia/Ho_Chi_Minh`), counted when a session is created, in the same
  transaction (LIM-01). Calls are not given back, because the browser reports
  call events. Calls made with the token outside FluentAI are not counted, so
  DC-01 also sets a Dograh Cloud spending limit if one exists.
- **Trial and admin approval** (ACC-01…ACC-03, user request on 2026-11-13).
  Every account gets one trial call of 1 minute. Full use (10/15/20-minute
  sessions within the daily limit) needs a request approved by the single
  admin account (`ADMIN_UID`).
  - The server decides the session kind in the session-creation transaction.
  - Access is stored on `users/{uid}.access`.
  - **Rules:**
    - one trial per account in total; it uses the normal form without the
      duration choice, and gets the normal review;
    - the admin is `ADMIN_UID` and is exempt from the daily limit;
    - the admin can revoke, and a rejected or revoked learner can request
      again (one pending request, optional message ≤ 300 chars);
    - notifications are in-app only.
  - The 1-minute cap relies on the browser countdown, because trial and full
    sessions share the same workflows.
- **Backups are the workflow exports only.** FluentAI's own data is in
  Firestore. Dograh Cloud's call data is not backed up.
- **Unit order:** DEP-01 → DG-05 → DC-01 → ACC-01 → ACC-02 → ACC-03 → LIM-01
  → TR-01 …
  - The domain comes first, because the embed tokens and the Webhook node
    need it.
  - DG-05 comes before DC-01, so the user sets each widget variable once,
    under its final name.
  - The access units and LIM-01 come before the production URL is shared
    with anyone.

## Session Notes

- **Root cause of "no transcript / no review" (Firestore, 49 sessions, 3 users,
  read on 2026-11-09).** 32 sessions are `completed`, 0 transcripts are
  `ready`, 7 are `error`, and no session ever had a `reviewStatus`. By run:
  - runs ≤ 30 predate the webhook;
  - runs 31–32 come from commit `4968320`, which stored the URL only;
  - run 33 was blocked by the old downloader;
  - runs 34–39 still errored after fix `1102a28`. The reason is unknowable,
    because errors are collapsed and the Dograh volume is gone. Most likely
    Next.js was not restarted after the env change.
  - runs 40–44 ran on the `production` branch, which has no webhook route.
    Dograh received 404 and dead-lettered the deliveries.
- **The running Dograh is ai-companion's**: API `:8010`, UI `:3010`, MinIO
  `:9000`. FluentAI's `.env.local` still allows only `:8000`, and its widget
  source points at dead `trycloudflare.com` tunnels. `DOGRAH_WORKFLOW_ID=1` may
  belong to ai-companion.
- **2026-11-13:** `.env.local` still uses the single old
  `NEXT_PUBLIC_DOGRAH_WIDGET_SRC`, which is no longer read. After DG-05, DC-01
  replaces it with the two server-only Dograh Cloud URLs. The code still holds parts of the first
  Dograh Cloud integration (since `b8af366`): `getDograhRun` calls
  `https://app.dograh.com/api/v1`, and `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`
  defaults to `app.dograh.com`.
- Gemini `gemini-3.5-flash-lite` is available for the configured key
  (metadata check, 2026-11-09).
- Check order: `npm test` → `npx next typegen` → `npx tsc --noEmit
  --incremental false` → `npm run lint` → `npm run build`
  (+ `npm run test:smoke` against `npm run start -- -p 3100`).
- `docs/CHUONG_3.md` (an untracked thesis chapter) describes the `production`
  branch, not `main`. After DEP-01 deletes that branch, the chapter describes
  code that no longer exists. The units do not edit it.
