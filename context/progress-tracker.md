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
  - the SET-04 UI check (can now be done on the deployment)
  - the DEP-01 checks on the deployment (I-03)
  - the Dograh Cloud setup: providers, the 2 workflows, the credential, the
    embed tokens, `.env.local` and the Vercel variables (I-02)
  - the real call check per accent (DC-01)
- DEP-01 done on 2026-11-13 (C-20). Production:
  `https://real-time-voice-agent-language-prac-one.vercel.app`. The user's
  manual checks are I-03.
- Batches (decided 2026-11-13, at most 4 units each):
  1. DG-05, the repo part of DC-01, and the 1-minute trial guidance in the
     workflow spec (moved from ACC-01, so the user imports the workflows
     once). **Merged (PR #2)**, so production has it (smoke 10/10). DG-05 =
     C-21; the DC-01 repo part = I-02. DC-01 continues with the user's
     Dograh Cloud setup and real calls.
  2. ACC-01, ACC-02, ACC-03, LIM-01. **Code done 2026-11-13** on branch
     `feat/acc-access-and-call-limit` (C-22…C-25). After the merge, the user
     sets `ADMIN_UID` (and optionally `PRACTICE_DAILY_CALL_LIMIT`) on Vercel
     and does the manual checks listed under C-23…C-25.
  3. DC-02, TR-01, TR-02, TR-03. **Code done 2026-11-14** on branch
     `feat/tr-webhook-v2` (C-26…C-29), tested with mocks. After the merge,
     the user does I-04 on the deployment (Dograh Cloud credential and
     webhook node, the storage host in `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`, a
     real call that ends with a review).
  4. RV-01, RV-02, RV-03, DATA-01. **Code done 2026-11-14** on branch
     `feat/rv-review-v2` (C-30…C-33). DATA-01 already ran against the shared
     Firestore. After the merge, the user creates the RV-03 index and does
     the manual checks under C-31 and C-32.
  5. E2E-01 on the deployment, after batches 3 and 4 are merged and I-04 is
     done.
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
- **C-20** DEP-01 Vercel deployment (2026-11-13):
  - Production: `https://real-time-voice-agent-language-prac-one.vercel.app`.
    New Vercel project (Hobby), Production Branch `main`, deploying merge
    commit `5a4428e` (PR #1, `feat/v2-setup-vercel-deploy`). The repository is
    now `Quynhdang003/real-time-voice-agent-language-practice`; the old URL
    redirects.
  - Before the deploy: the v2 work (EN-01, SET-01…05, DG-01…04, `context/`,
    `CLAUDE.md`) had never been committed, and `origin/main` was still
    `1102a28` (v1). It was committed in 4 commits on the branch and merged by
    the user. `docs/CHUONG_3.md` stays uncommitted.
  - Repo changes: README "Deploy on Vercel" rewritten as a step list;
    `.env.example` transcript comments updated for Vercel.
  - Two failed builds, both from configuration:
    1. the Install Command had been typed with backticks (`` `npm ci` ``),
       so the shell ran npm's output as a command (exit 127);
    2. the `FIREBASE_*` variables were missing in Production, so
       `firebase/admin.ts` threw while `next build` collected page data.

    The third build passed: `npm ci`, `jwks-rsa@4.1.0 ✔`, `next build`.
  - Verify:
    - before the deploy: `npm test` 63/63, typegen + `tsc`, `npm run
      build`, lint with only the N-02c baseline, and `npm run test:smoke`
      10/10 against `next start -p 3100`;
    - on the deployment: `TEST_BASE_URL=https://real-time-voice-agent-language-prac-one.vercel.app
      npm run test:smoke` 10/10. The webhook answers 401, not 404, so this
      is `main`. Firebase Admin starts on Vercel.
  - The `production` branch (`b4c06f5`) is deleted locally and on `origin`;
    `git ls-remote origin production` is empty (fixes N-07).
  - Remaining manual checks by the user: I-03.
- **C-21** DG-05 server-only embed URLs (2026-11-13, batch 1):
  - `lib/dograh/widget.ts`:
    - `widgetSourceVariable(accent)` maps to `DOGRAH_WIDGET_SRC_AMERICAN` /
      `_BRITISH`;
    - `selectWidgetSource(session, env)` returns the trimmed URL only for a
      `ready` session (v1 → American).
  - `app/(root)/voice-call/page.tsx` reads `process.env` at request time,
    after `getPracticeSession` has checked ownership, and passes the
    `widgetSrc` prop. `VoiceCallExperience` and `useDograhWidget` take it.
  - The hook no longer reads `process.env`. A missing URL shows "Set
    DOGRAH_WIDGET_SRC_<ACCENT> on the server, then restart or redeploy the
    app."
  - Verify:
    - `tests/dograh-widget-source.test.mjs` (4 tests: accent choice and
      legacy default; no URL unless `ready`; blank or missing variable; no
      `NEXT_PUBLIC_DOGRAH` in `app/`, `components/` or `lib/`, and no
      `process.env` in the hook);
    - `npm test` 67/67; typegen + `tsc` pass;
    - **canary build:** `npm run build` with `DOGRAH_WIDGET_SRC_*` holding
      marker tokens → 0 files in `.next/static` contain the marker or
      `dograh-widget.js`. The marker appears only in the local Turbopack
      cache, which is never served.
  - The real call with the new variables is checked in DC-01 (I-02).
- **C-22** ACC-01 access model and trial, server side (2026-11-13, batch 2):
  - `lib/practice/access.ts`: `UserAccess` (ISO timestamps),
    `parseUserAccess` (lenient, but a used trial stays used), `isAdmin`
    (`ADMIN_UID`; unset or blank → nobody), `accessLevelOf`
    (admin > approved > unused trial > blocked), `sessionKindFor`.
  - `lib/practice/create-session.ts`: one transaction reads `users/{uid}` →
    access level → 403 if blocked → validation with the kind → for a trial,
    sets `access.trialUsed` → creates the v2 session with `kind` and
    `userId`. Its adapter `createPracticeSession` is in `server.ts`
    (`transaction.set` merge plus `transaction.create`).
  - `session-setup.ts`: `validateSessionSetup` / `validatePracticeSetupRequest`
    take `{kind}`. A trial ignores the body's duration and stores 1.
  - `session.ts`: the DTO has `kind`. A v2 document without `kind` is full.
    A trial must be 1 minute, and a full session cannot be.
  - `POST /api/practice-setup` is now thin: 201 / 400 / 403
    `access_required` + `accessStatus` / 500.
  - The UI is unchanged until ACC-02. A trial account still sees the
    duration pills, but its session is stored as 1 minute.
  - Verify: `tests/access.test.mjs` (10 tests: parsing, admin, level matrix,
    one trial then 403 with no write, 3 concurrent setups → 1 session,
    invalid input keeps the trial, approved/admin full, pending/rejected
    blocked, storage failure, strict trial/full parsing); route and creation
    tests in `tests/api.test.mjs`; `npm test` 78/78; strip-types 5/5;
    typegen + `tsc`; build; lint shows only the N-02c baseline.
- **C-23** ACC-02 learner side (2026-11-13, batch 2):
  - `access.ts`: `AccessView`, `accessViewOf`, `canRequestAccess`,
    `requestAccess` (none / rejected → pending; message trimmed, ≤ 300,
    non-string → invalid; pending → `already_pending`; approved or admin →
    `already_approved`), and `formatAccessDate` (Vietnam time).
  - `access-server.ts`: `getAccessView` (a read failure falls back to the
    initial view) and `requestUserAccess` (one transaction, `set` with merge).
  - `POST /api/access-request`: 200 / 400 / 409 `reason` / 500.
  - `/` loads the profile and the access view in parallel.
    `HomePracticeSetup` takes `initialAccess` and validates with `{kind}`.
    A trial hides the duration and says "Start 1-minute trial". A blocked
    account gets a disabled "Full access needed". A 403 switches the view to
    blocked.
  - New `AccessBanner` (UI in `ui-context.md` → Home access).
  - The smoke script also checks that `POST /api/access-request` answers 401.
  - Verify: `tests/access.test.mjs` +3 (request transitions, refusals and
    message rules, view and Vietnam-time date); `tests/api.test.mjs` +1
    (route mapping); `npm test` 82/82; typegen + `tsc`; build; lint shows
    only the N-02c baseline.
  - **Manual check pending (user, after deploy):** a new account sees the
    trial banner, makes a 1-minute call that is reviewed, then sends a
    request and sees "pending".
- **C-24** ACC-03 admin side (2026-11-13, batch 2):
  - `access.ts`: `decideAccess` and `isUserId`:
    - approve: pending → approved; reject: pending → rejected; revoke:
      approved → rejected;
    - an identical repeat is a no-op; anything else → `invalid_transition`;
    - the admin's own account → `invalid_transition`;
    - a missing user → `not_found`;
    - a non-admin → `not_admin`, before any read.

    It also has `toAccessAccountRow` and `accessAccountLists` (pending oldest
    first, approved newest first, the admin and malformed rows left out).
  - `access-server.ts`: `isAdminUser`, `decideUserAccess`,
    `listAccessAccounts` (single-field `access.status` queries, no composite
    index) and `countPendingRequests` (`count()`).
  - `POST /api/admin/access/[uid]`: 404 for anyone but the admin, before the
    body is read; 200 / 400 / 404 `not_found` / 409 `invalid_transition` /
    500.
  - `/admin` (`notFound()` for non-admins) with `AdminAccessPanel`. The
    `(root)` layout passes the admin flag and the pending count to
    `AppHeader` (link plus badge, admin only).
  - The smoke script also checks that `/admin` redirects anonymous users and
    that the admin route answers 404.
  - Verify: `tests/access.test.mjs` +4 (transitions and no-op repeats,
    refused transitions without a write, admin-only and input checks before
    any read, lists); `tests/api.test.mjs` +1 (404 before the body,
    mapping); `npm test` 87/87; typegen + `tsc`; build (`/admin`,
    `/api/admin/access/[uid]`); lint shows only the N-02c baseline;
    `npm run test:smoke` **13/13** against `next start -p 3100`.
  - **Manual check pending (user, after deploy):** set `ADMIN_UID` on
    Vercel, sign in as the admin → the header link appears → approve a
    request → that learner can choose 10/15/20 minutes; revoke → 403 again;
    another account gets 404 on `/admin`.
- **C-25** LIM-01 daily call limit (2026-11-13, batch 2):
  - `lib/practice/call-quota.ts` (pure):
    - `dailyCallLimit` (positive integer, else 5);
    - `quotaDay` / `quotaResetsAt` (Vietnam = UTC+7 with no DST, so a
      fixed offset);
    - `parseCallQuota`, `callsUsedToday`, `callQuotaView`, `consumeCall`.
  - `createPracticeSessionForUser`: for approved, non-admin accounts,
    `consumeCall` runs after validation, in the same transaction. Over the
    limit → `call_limit_reached` with no write. The store gets
    `dailyCallLimit` and `now`.
  - The route answers 429 `{reason, limit, resetsAt}`.
  - `AccessView.quota` (full accounts only) comes from `getAccessView`.
  - Home: a "Calls left today" row; at 0, a disabled "Daily limit reached"
    and the reopening date; a 429 sets the count to 0.
  - `.env.example` and the README list `PRACTICE_DAILY_CALL_LIMIT`.
  - Verify:
    - `tests/call-quota.test.mjs` (4: env parsing, the Vietnam midnight
      boundary and year rollover, stale or malformed quotas, consume);
    - `tests/access.test.mjs` +5 (the 6th call → 429 with no write; reset at
      17:00Z; 8 concurrent requests → exactly 5 sessions; invalid input
      uses no call; trial and admin have no quota; view);
    - `tests/api.test.mjs` +1 (429 body);
    - `npm test` 97/97; strip-types 5/5; typegen + `tsc`; build; smoke
      13/13 locally; lint shows only the N-02c baseline.
  - **Manual check pending (user, after deploy):** with a temporary
    `PRACTICE_DAILY_CALL_LIMIT=1` on Vercel, an approved learner creates
    one session, then sees "Daily limit reached".
- **C-26** DC-02 retired self-hosted stack deleted (2026-11-14, batch 3):
  - Deleted `dograh/docker-compose.yml`, `dograh/.env.example`,
    `dograh/scripts/backup.ps1` / `restore.ps1`, the npm scripts
    `dograh:up|down|logs|backup` and the `/dograh/backups/` ignore rule.
  - `fetch-transcript.ts` has one policy (HTTPS, allowlisted host, port 443,
    redirects rejected until TR-02); the `localOrigins` parameter and
    `DOGRAH_TRANSCRIPT_MODE` / `DOGRAH_TRANSCRIPT_LOCAL_ORIGINS` are gone
    from the code, `.env.example`, the READMEs and the context files.
  - `docs/TESTING.md`: the 2026-09-10 local-mode section is condensed into a
    history note.
  - `dograh/README.md` §4 records that the Cloud embed URL already carries
    `apiEndpoint=https://api.dograh.com` (seen in `.env.local` on
    2026-11-14, parameter names and hosts only).
  - Verify: `tests/dograh-transcript.test.mjs` replaces the 5 local-mode
    tests with one DC-02 test (files and npm scripts gone; no retired name in
    `app/`, `lib/`, `dograh/`, `.env.example` or the READMEs); `npm test`
    93/93; typegen + `tsc`; build; lint shows only the N-02c baseline.
    `git grep` finds `localhost:8020`, `fluentai-dograh` and
    `DOGRAH_TRANSCRIPT_MODE` only in that test and in this file's history.
- **C-27** TR-01 webhook v2 (2026-11-14, batch 3):
  - Spec first: the Webhook node is **enabled** in `workflow-spec.md` and the
    seed (`build-seed-workflow.mjs`), with a note to switch on an already
    imported workflow only after this deploy.
  - Route: `Authorization: Bearer <DOGRAH_WEBHOOK_SECRET>`; SHA-256 digests
    compared timing-safe; the old `x-dograh-webhook-secret` header gets 401.
  - `lib/dograh/transcript-webhook.ts` (`applyDograhWebhook`, pure): flat
    payload (`""` = not sent), lookup only by `session_id`, run-ID
    cross-check (`run_mismatch` → 200 skipped, no write), idempotent once
    `ready`/`empty`, no `transcript_url` → `empty`, a missing run ID is
    stored. Two transactions (read + decide; re-read + decide + write) with
    the download between them. Skips log only a code.
  - `lib/dograh/server.ts` adapter: `runTransaction` on
    `practiceSessions/{session_id}`, nested `dograh.*` updates.
    `getDograhRun` and `DOGRAH_WORKFLOW_ID` are removed.
  - README, `dograh/README.md` §3, `api-contracts.md` (current "Dograh-facing"
    section; the TR-02/TR-03 parts stay under Target), `architecture.md`.
  - Verify: new `tests/dograh-webhook.test.mjs` (11 tests: parsing and
    rejection, ready/empty/error with call fields kept, no-speech empty,
    skips without download or write, an old session with the same run ID
    untouched, run ID stored after a failed `connected`, redelivery no-op and
    error retry, concurrent delivery, unavailable, Firebase adapter);
    `tests/api.test.mjs` (Bearer cases → 401 before the body, outcome
    mapping); `tests/dograh-workflow.test.mjs` (node enabled);
    `session-pipeline` uses the v2 payload. `npm test` 99/99; typegen +
    `tsc`; build; lint shows only the N-02c baseline.
  - Fixes N-01a, N-01c, N-01d, N-01e.
  - **Manual steps (user, after the merge and deploy):** keep
    `DOGRAH_WEBHOOK_SECRET` on Vercel (one word); in Dograh Cloud, create the
    `bearer_token` credential with the same value, select it in the webhook
    node of both workflows, and switch the node on (after TR-02's allowlist
    is set, see C-28). Check: `curl` with a wrong Bearer → 401; a real call
    on the deployment → the session gets `dograh.transcriptUrl` and a
    `transcriptStatus`, linked by `session_id`.
- **C-28** TR-02 download reason codes, validated redirects and retries
  (2026-11-14, batch 3):
  - Checked first in Dograh's open-source `main` (`api/tasks/webhook_delivery.py`,
    read 2026-11-14, no commit pinned): `X-Dograh-Delivery-Attempt` is
    1-based, the last attempt is 5, timeout 30 s, redirects not followed.
    Recorded in the platform contract.
  - `fetchDograhTranscript` returns `{status: "ok", text}` or
    `{status: "error", reason, rejectedHost?}` instead of throwing. Up to 3
    redirects followed by hand; each target is resolved and checked
    (HTTPS, port 443, no credentials, allowlisted host) before it is
    requested; one 15 s deadline for all hops and the body.
  - `transcriptErrors` / `TranscriptError` and `dograh.transcriptError` in
    `session.ts` (type and parser), so call events keep it.
  - `applyDograhWebhook(payload, store, {attempt})`: transient
    (`timeout`, `network`, `http_5xx`) before the last attempt → `retry`
    (route 503, nothing written); the last attempt (≥ 5, or a missing or
    malformed header) or a permanent reason → `error` + `transcriptError`;
    a later success deletes the reason (`FieldValue.delete()`).
    `parseDeliveryAttempt` reads the header.
  - Allowlist default `app.dograh.com,api.dograh.com`
    (`transcriptAllowedHosts`), because the Cloud embed URL carries
    `apiEndpoint=https://api.dograh.com`. A rejected host is logged as
    `[dograh.webhook.download] {code, retry, host}` (hostname only), so the
    storage host can be read from the Vercel logs.
  - Docs: `api-contracts.md` (current webhook section, platform delivery
    note, first "Observed on Dograh Cloud" entry), `architecture.md`,
    README, `dograh/README.md` §4–5 (find the storage host in the logs),
    `workflow-spec.md` embed note, `.env.example`, `docs/TESTING.md`.
  - Verify: `tests/dograh-transcript.test.mjs` (download: redirects
    allowed, relative, off-list / missing / 4th hop rejected before the
    request, reason codes, size, UTF-8); `tests/dograh-webhook.test.mjs` +3
    (attempt header; retry on attempts 1–4 with no write, stored on 5 or
    without a header; permanent reasons with the host) and the adapter
    (default and env allowlist, `DeleteTransform`, log line, 503 path);
    `tests/api.test.mjs` (503, header passed through). `npm test` 104/104;
    strip-types 5/5; typegen + `tsc`; build; lint shows only the N-02c
    baseline.
  - Fixes N-01b and N-01f.
  - **Manual steps (user, after the deploy):** set
    `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS=app.dograh.com,api.dograh.com` on Vercel
    (or leave it unset); after the first real call, read the storage host
    from the Vercel logs, add it, redeploy, and redeliver that run with
    `curl` (`dograh/README.md` §5.4). Check: a real Cloud transcript reaches
    `ready`.
- **C-29** TR-03 background review with a lease (2026-11-14, batch 3):
  - `review-state.ts`: a `processing` claim is a 3-minute lease
    (`REVIEW_LEASE_MS`, top-level `reviewClaimedAt` ISO string). A claim
    without a valid time (pre-TR-03) counts as expired. `pending` is claimed
    like a missing status. `writeCompleted` / `writeFailed` take the claim
    time and write only while the session still holds that claim (a
    transaction in `server.ts`, which also removes `reviewClaimedAt`); a
    taken-over result is dropped and the request answers
    `already_processing`.
  - `generateBackgroundReview(sessionId)`: the same claim without the
    ownership check. `runBackgroundSessionReview` (`lib/practice/server.ts`)
    logs a non-`ok` outcome as a code.
  - The webhook's write sets the top-level `reviewStatus: "pending"` with a
    `ready` transcript (unless `completed`) and returns `reviewSessionId`;
    the route answers, then calls `after(() => runBackgroundSessionReview(id))`.
  - `maxDuration = 60` on the webhook and `generate-review` routes.
  - The review page needs no change: `pending` and `processing` already show
    "generating", and `already_processing` makes it poll.
  - Verify: `tests/review.test.mjs` +4 (pending claimed; lease boundary
    2:59 / 3:00 / missing time; taken-over results dropped for success and
    failure; background review without a user, no repeat);
    `tests/dograh-webhook.test.mjs` +1 (pending once, never after
    `completed`; adapter writes top-level `reviewStatus`);
    `tests/api.test.mjs` (`maxDuration` on both routes; the review is
    scheduled with `after()` and runs only after the response);
    `session-pipeline` runs call → webhook with a storage redirect →
    background review → the page gets the saved review. `npm test` 109/109;
    strip-types 5/5; typegen + `tsc`; build; lint shows only the N-02c
    baseline.
  - Batch check on `next start -p 3100` (commit `11df4d5`): `npm run
    test:smoke` 13/13; `curl` to the webhook with no header, a wrong Bearer
    or the old `x-dograh-webhook-secret` header → 401.
  - Fixes N-03a.
  - Known gap (Open Question 11): if the browser never reports the end of
    the call, the session stays `active` and no review is made.
- **C-30** RV-01 review v2 schema, prompt and validator (2026-11-14,
  batch 4):
  - `lib/practice/review-v2.ts` (pure): types, `parseSessionReviewV2` (shape
    and limits; with the session's expectations, the full validator: each
    goal judged once case-insensitively, status rules, grammar focus null
    exactly when unset, every quote from one learner turn on whole words),
    `quoteKey`, `isLearnerQuote`, `nextCefrLevel`.
  - `session.ts`: `review` is `StoredReview` (v1 or v2, told apart by
    `schemaVersion`), `isReviewV2`. Stored reviews are checked for shape.
  - `review-state.ts`: `reviewContextOf` (level, topic, scenario, mode and
    goals; a v1 session has empty goals). A `ready` transcript without
    learner turns → `transcript_empty`, without a claim.
  - `lib/ai/review.ts`: `buildReviewPrompt` (labelled turns, a
    `<transcript>` data block whose angle brackets cannot be closed by a
    turn, whole-turn truncation at 20,000 chars, vocabulary hints, the CEFR
    scale with the C2 rule, bilingual output) and `REVIEW_RESPONSE_SCHEMA`.
    The output is validated before it is stored.
  - The Gemini API answered 400 `INVALID_ARGUMENT` to `minItems` /
    `maxItems` in the response schema (found by bisecting on 2026-11-14), so
    the schema leaves them out and the validator enforces the counts.
  - The current review page shows only v1 reviews until RV-02.
  - Verify: new `tests/review-v2.test.mjs` (9: valid review, quote
    matching, fabricated evidence in every field, missing / extra /
    duplicate goals, status rules, grammar focus, shape and limits, stored
    v1 + v2 reads, CEFR anchors); `tests/review.test.mjs` (context, adapter
    stores only validated v2 and maps errors, prompt injection, whole-turn
    truncation, tutor-only transcript); fixtures `reviewV2` /
    `transcriptV2`. `npm test` 121/121; strip-types 5/5; `tsc`; build; lint
    shows only the N-02c baseline.
  - **One real Gemini call** (2026-11-14, synthetic fixture, no user data):
    `ok` in 4.4 s, passed the full validator.
  - Fixes N-03b, N-03c, N-03d.
- **C-31** RV-02 review page v2, state banners and retry (2026-11-14,
  batch 4):
  - `lib/practice/review-view.ts` (pure): `reviewPageStateOf` (waiting for
    the transcript, transcript error, no learner speech, generating, failed,
    done), `reviewStateKey`, `generateStepFor`, `skillLevelLabel`, a 5 s poll
    and a 10-minute wait limit (covers Dograh's ~7.5-minute retries and the
    3-minute lease).
  - `review-panel.tsx` rewritten: one state banner (`role=status` /
    `alert`), refresh polling while the transcript is missing, a
    `generate-review` request that polls again while the claim is busy,
    **Check again** after the wait limit, **Try again** after a failure.
    The page passes `key={reviewStateKey(session)}`, so the panel remounts
    when the stored state changes; no state is synced in an effect.
  - `review-v2-view.tsx` (goals with status badges, grammar focus, weak
    points, scenario, four 1–5 skills with level labels and quotes, grammar
    errors, next weak points; `BilingualText` shows English then
    Vietnamese with `lang="vi"`) and `review-v1-view.tsx` (the earlier
    layout for v1 reviews). The pronunciation card is gone (Open Question
    3, answered 2026-11-14).
  - `ui-context.md` → Review describes the states and the layout.
  - Verify: new `tests/review-page.test.mjs` (8: state of every fixture;
    each state's banner, role and button rendered with `react-dom/server`;
    the v2 and v1 views; level labels; the remount key; answer mapping;
    two tabs on the real claim logic). `loadTs` now loads `.tsx`. `npm
    test` 129/129; strip-types 5/5; typegen + `tsc`; build; **`npm run
    lint` has 0 problems** (the N-02c baseline is gone).
  - Fixes N-02a, N-02b, N-02c.
  - **Manual check (user, after the deploy):** open `/review` right after a
    call: waiting → generating → the v2 review, in two tabs at once.
- **C-32** RV-03 weak-point carry-over (2026-11-14, batch 4):
  - `lib/practice/weak-points.ts` (pure): `weakPointSourcesFrom` (the 3
    latest v2 reviews), `mergeCarryOver` (newest first; `improved` drops the
    point from that review and older ones; still_present → next weak points
    → not_observed; trimmed; items that break the setup rules skipped;
    case-insensitive dedupe; max 5), `weakPointSourceIds`.
  - `lib/practice/weak-points-server.ts`: `getWeakPointCarryOver(userId)`,
    one query (`userId`, `reviewStatus == completed`, `createdAt desc`,
    limit 10, `select("review")`); any failure, such as the missing index,
    returns `[]` and logs only the code.
  - `/` passes the carried texts as `initialWeakPoints` (the form already
    labels them "from your last reviews").
  - `createPracticeSession` reads the carry-over again before the
    transaction; `createPracticeSessionForUser` stores
    `weakPointsSourceSessionIds` for the carried points the learner kept.
    A value in the body is ignored.
  - README → Deploy → Firebase: the index step.
  - Verify: new `tests/weak-points.test.mjs` (7: order and dedupe, improved
    drops older points, limits and invalid items, v2-only sources, source
    IDs, session N → N+1 pre-fill that passes the setup rules and is traced
    to N with a forged body value ignored, the adapter query and its
    failure). `npm test` 136/136; strip-types 5/5; typegen + `tsc`; build;
    lint 0 problems.
  - **Manual steps (user):** create the composite index in the Firebase
    console (`practiceSessions`: `userId` ↑, `reviewStatus` ↑,
    `createdAt` ↓); after the deploy, finish a reviewed session, then open
    `/`: its weak points are pre-filled and editable, and the new session's
    document has `weakPointsSourceSessionIds`.
- **C-33** DATA-01 legacy session cleanup (2026-11-14, batch 4):
  - Rule (Open Question 1, answered 2026-11-14): delete only v1 sessions (no
    `schemaVersion`, no `review`) that are (a) `ready` with no `dograh`, or
    (b) `completed` with no transcript turns. Everything else is kept.
  - `scripts/legacy-sessions-rule.mjs` (the rule) and
    `scripts/cleanup-legacy-sessions.mjs` (`npm run data:cleanup-legacy`):
    a dry run by default; `--apply --expect=N` deletes in batches, only if
    exactly N sessions still match. It prints IDs, dates and groups only.
  - **Run on 2026-11-14** against project `fluentai-24a25` (shared by
    development and production):
    - dry run: 54 sessions; group (a) 17 (2026-08-25 → 2026-09-10), group
      (b) 32 (2026-09-07 → 2026-09-12); 5 v2 sessions kept, no other v1;
    - the user confirmed deletion without a backup;
    - `--apply --expect=49`: **49 deleted**; a new dry run shows 5
      sessions, all v2, and 0 matches.
  - Verify: `tests/legacy-cleanup.test.mjs` (the rule on 14 cases: both
    groups, sessions with a transcript or a review, other statuses, v2,
    null).

## In Progress

- **I-04** Batch 3 checks on the deployment (TR-01…TR-03), after the user
  merges `feat/tr-webhook-v2`. In order:
  1. Vercel: `DOGRAH_WEBHOOK_SECRET` set (one word);
     `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` unset or
     `app.dograh.com,api.dograh.com`; delete `DOGRAH_WORKFLOW_ID` and any
     old local-mode variable; redeploy if anything changed.
  2. Dograh Cloud: the `bearer_token` credential with the same secret,
     selected in the webhook node of both workflows; switch the node on;
     publish.
  3. `curl` the webhook with a wrong Bearer → 401.
  4. A real call on the deployment. In the Vercel logs, look for
     `[dograh.webhook.download]`: a `host` there is the storage host. Add it
     to `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`, redeploy, and redeliver that run
     (`dograh/README.md` §5.4).
  5. The next real call: the webhook answers in < 15 s, the session goes
     `transcriptStatus: ready` → `reviewStatus: pending → processing →
     completed` without the review page open.
  6. Report the storage host, so "Observed on Dograh Cloud" is completed.

- **I-01** Implemented, awaiting a real-service check (staging case E01):
  registration + profile document, sign-out, password-reset email,
  profile-photo upload. Run it on the deployment after DEP-01.
- **I-02** DC-01, Dograh Cloud.
  - **Repo part done in batch 1 (2026-11-13):**
    - `dograh/workflow-spec.md`:
      - header and embed variables for Cloud;
      - webhook endpoint
        `https://real-time-voice-agent-language-prac-one.vercel.app/api/dograh/transcript-webhook`;
      - per-workflow settings for Cloud (allowed domains = production
        domain + `localhost:3000`, server-only variables, a maximum call
        duration of 20 minutes if offered, an `apiEndpoint` note for local
        calls);
      - the **1-minute trial guidance**: a global "Session length" rule, and
        the practice → wrap-up edge moving on after 2–3 answers in a trial.
    - Seed regenerated (`WEBHOOK_URL` in `build-seed-workflow.mjs`).
    - `dograh/scripts/lib.mjs` defaults to `https://app.dograh.com`.
    - `.env.example` lists `DOGRAH_WIDGET_SRC_*` and the Cloud API base.
    - `dograh/README.md` rewritten in Vietnamese as the Cloud guide (steps
      1–5 plus troubleshooting).
    - The root README's Dograh section points to Cloud.
    - Verify: `tests/dograh-workflow.test.mjs` 3/3 (placeholders, webhook
      disabled with the new URL, seed = spec).
  - **Remaining, by the user** (`dograh/README.md` §1–5): providers, API key,
    import ×2, voices, the `bearer_token` credential (= the Vercel
    `DOGRAH_WEBHOOK_SECRET`), keep the webhook node disabled, publish, embed
    tokens, `DOGRAH_WIDGET_SRC_*` on Vercel (redeploy) and in `.env.local`,
    then a real call per accent on the deployment and on `localhost:3000`.
  - The user reports four observations, which go into "Observed on Dograh
    Cloud":
    - the `/embed/init` host;
    - whether `apiEndpoint` is needed locally;
    - the transcript storage host (→ `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`);
    - whether a spending limit or maximum duration exists.

    Then `dograh:export` ×2.
- **I-03** DEP-01 manual checks by the user, on
  `https://real-time-voice-agent-language-prac-one.vercel.app`:
  - sign in, then create a v2 practice session (`/voice-call` reporting that
    voice calling is not configured is expected until `DOGRAH_WIDGET_SRC_*`
    are set in DC-01);
  - the Vercel Logs for `/` and `/sign-in` show no `ERR_REQUIRE_ESM`;
  - a Preview deployment URL asks for a Vercel login;
  - Settings → General shows Node.js 24.x (the build log does not print it);
  - the domain is in Firebase Auth → Authorized domains.

## Next Up

Rules for every unit:
- Update the related context file first.
- After coding: `npm test`, `npm run build`, `npm run lint` (no new errors).
- Then update this file.

"Fixes" refers to the known defects listed below the table.

| ID | Unit | Depends on | Verify |
|---|---|---|---|
| **DC-01** | Dograh Cloud. Spec first: `workflow-spec.md` webhook endpoint, embed steps, and the 1-minute trial guidance (moved from ACC-01); `dograh/README.md` rewritten for Cloud; then `lib.mjs` default base URL `https://app.dograh.com` and `.env.example`. The user does I-02. Re-check the platform contract on Cloud and fill in "Observed on Dograh Cloud" in `api-contracts.md`, including the storage host and any account spending limit (set it if it exists) (fixes N-08) | DEP-01 (needs the domain), DG-05 | `tests/dograh-workflow.test.mjs` passes; a real call per accent on the deployment and on `localhost:3000` reaches `completed`; `/init` carries the 18 keys; the storage host is recorded and set in `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` |
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
  - a. Unknown run → 200 `skipped`; the delivery is lost. **Fixed TR-01**
    (lookup by `session_id`; a missing run ID is stored).
  - b. A failed download is answered with 200, so Dograh does not retry.
    **Fixed TR-02** (503 until the last attempt).
  - c. Find-then-update is not transactional. **Fixed TR-01.**
  - d. The lookup uses the browser-reported run ID with `limit(1)`, so it can
    hit an old session after a reinstall. **Fixed TR-01.**
  - e. `""` URLs → 400, which Dograh dead-letters. **Fixed TR-01.**
  - f. Redirects are rejected outside local mode. **In scope since
    2026-11-13:** Dograh Cloud's download links redirect to storage, so every
    Cloud transcript download fails today. **Fixed TR-02** (validated
    redirects; the storage host still has to be allowlisted on Vercel).
- **N-02** Review page: **a, b, c fixed RV-02** (10-minute wait limit with
  Check again; polling while the claim is busy; no synchronous setState in
  effects, lint clean).
  - a. Polls forever while the transcript is unset.
  - b. Can stay stuck on "Generating your review with AI…" after
    `already_processing` *(inferred)*.
  - c. ESLint `react-hooks/set-state-in-effect` at `review-panel.tsx:35`.
- **N-03** Review generation:
  - a. No lease on `processing`. **Fixed TR-03** (3-minute lease, results
    written only under the claim).
  - **b, c, d fixed RV-01** (bilingual output, whole-turn truncation, data
    block plus a prompt-injection test).
  - b. The prompt is fixed to "English language tutor" and English output
    (practice is now English only; the comment language is still open).
  - c. The transcript is cut at 12,000 chars, possibly mid-turn.
  - d. Prompt injection is untested.
- **N-04** Staging cases E01–E13 not run; browser smoke not run. Node 24:
  Vercel builds from `engines` `24.x`, and the smoke test passes there (C-20),
  but the build log does not print the version (check in I-03). Locally the
  checks run on 22.15.0.
- **N-09** `npm audit` on the Vercel build reports 43 vulnerabilities (2 low,
  23 moderate, 16 high, 2 critical). They are not triaged yet, and no unit
  covers them.
- **N-05** Placeholder data on `/`: "Recent practice", per-language progress,
  a `SessionCard` link without `sessionId`, "View all", "Good evening",
  unused `PerformanceCard`.
- **N-06** ESLint `@next/next/no-assign-module-variable` in
  `.language-check.mjs:14` (removed by EN-01).
- **N-07** The `production` branch (`b4c06f5`) removes the transcript webhook
  and review code. A deployment of it answers webhooks with 404 (runs 40–44).
  **Fixed 2026-11-13 (DEP-01):** `main` is deployed from a new Vercel
  project, and the branch is deleted.
- **N-08** Self-hosted Dograh values in the repo:
  - `dograh/scripts/lib.mjs` defaults to `http://localhost:8020`.
  - `dograh/workflow-spec.md` uses `http://host.docker.internal:3000` for the
    webhook and `localhost:3020/8020` in the embed steps.
  - `dograh/README.md` describes the Docker stack.
  - The README's Dograh section points to the stack.

  **Fixed 2026-11-13 (DC-01 repo part, batch 1).** The stack files themselves
  go in DC-02.

## Open Questions

1. **Resolved 2026-11-14** (DATA-01): delete both groups, v1 sessions only
   (no `schemaVersion`): (a) `ready` sessions that never started a call and
   (b) `completed` sessions without a transcript. A dry run lists them first;
   deletion happens only after the user confirms that list.
2. Confirm the proposed profile defaults in `api-contracts.md` → Field rules:
   `american`, `normal`, `gentle_recast`, `only_when_stuck`, and no default
   `level` (picked on the first session). SET-02 uses them until confirmed.
3. Review v2 has no pronunciation criterion. **Resolved 2026-11-14:** the
   "Pronunciation —" card is removed from the review page (RV-02). Still open:
   are pronunciation scoring, more tutors or resuming an interrupted call in
   scope at all?
4. Is session history / a progress dashboard in scope beyond weak-point
   carry-over? If not, should the placeholder "Recent practice" section (N-05)
   be removed?
5. Is email verification required before practice?
6. Is the 10/15/20-minute limit enough as a client-side timer, or should the
   workflow also wrap up by itself (it cannot see the clock)?
7. Should the stored `recordingUrl` and `summary` be shown to the learner?
8. Where should the Terms of Service and Privacy Policy links (currently `#`)
   point?
9. **Resolved 2026-11-14:** rules and indexes stay in the Firebase console
   only (no `firestore.indexes.json`). The RV-03 index is a manual step.
10. **Resolved 2026-11-14:** for C2 sessions, skill score 5 means
    "consistently at the top of C2 (near-native)".
11. (TR-03, 2026-11-14) A review needs `status: completed`, which only the
    browser reports. If the learner closes the tab during the call, the
    session stays `active`, so even a `ready` transcript never gets a
    review. Should a `ready` transcript from the webhook also complete the
    call (for example, `active` → `completed` with `endReason: dropped`),
    or is this acceptable for the thesis? No code assumes either answer
    yet.

**Resolved on 2026-11-13** (answers by the user; details in Architecture
Decisions):
- `production` branch (N-07) → delete it, in DEP-01.
- Vercel → a new project, on its default `*.vercel.app` domain.
- Firebase → one project for development and production.
- Self-hosted Dograh stack → delete it completely, in DC-02.
- Cost → registration stays open; calls are limited per learner per day
  (LIM-01).
- Vercel plan → Hobby; `maxDuration = 60`.
- Daily call limit (LIM-01) → 5 calls per approved learner per day
  (`PRACTICE_DAILY_CALL_LIMIT` default 5).
- New UI text (trial banner, `/admin`) → English, like the current UI.
- Delivery → batches of at most 4 units, one branch and one PR per batch.
  Each unit keeps its own context update, checks and commit. The user allows
  committing and pushing the batch branch, but not pushing to `main`, merging,
  or changing external configuration.
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
  read on 2026-11-09; these 49 v1 sessions were deleted by DATA-01 on
  2026-11-14).** 32 sessions are `completed`, 0 transcripts are
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
