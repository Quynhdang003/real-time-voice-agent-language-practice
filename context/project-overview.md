# FluentAI

## Overview

FluentAI is a web app for practicing **English** speaking with an AI voice
tutor. Vietnamese learners keep a learner profile (name, CEFR level, accent,
pace, correction preferences). Before each session they set a topic, a
scenario, a session mode and today's vocabulary. Then they hold a real-time
voice conversation with a Dograh agent. After the call, FluentAI downloads the
transcript, and Gemini produces a structured review:
- whether each session goal was met (vocabulary, grammar focus, weak points,
  scenario);
- speaking skills scored 1–5 against the session's CEFR level.

The review's weak points are carried into the next session. FluentAI is a
graduation project. It is deployed publicly on **Vercel** and uses the hosted
**Dograh Cloud** (`https://app.dograh.com`) for the voice calls, as the first
version of the project did. Development runs Next.js on `localhost:3000`
against the same Dograh Cloud account. **[planned DEP-01, DC-01; decided
2026-11-13]**

Registration is open, but a new account can make only **one trial call of
1 minute**. To use the service fully, the learner sends an access request,
which the **single admin account** approves or rejects. **[planned
ACC-01…ACC-03; decided 2026-11-13]**

Status markers: **[done]** works today; **[current]** exists in code but will
be replaced; **[planned UNIT]** decided on 2026-11-09 or 2026-11-13, not
implemented (units in `progress-tracker.md`); **[retired]** built, but no longer
part of the target since 2026-11-13.

## Goals

1. A learner can start an English voice practice session whose content
   (scenario, mode, vocabulary, grammar focus, weak points) follows their
   choices, and whose tutor style follows their profile (accent, pace,
   correction style, Vietnamese use).
2. Every completed call is linked to its session by `session_id`, and its
   transcript is stored reliably and idempotently.
3. Every session with a transcript gets one validated review without the
   learner having to keep a page open. Every score and judgment is backed by
   evidence quoted from the learner's own speech.
4. Weak points found in recent reviews are pre-filled into the next session.
5. The whole flow (setup → Dograh Cloud call → webhook → review) works on the
   public HTTPS deployment on Vercel. **[planned DEP-01, DC-01]**
6. Call cost stays bounded. An account that the admin has not approved gets
   one 1-minute trial call. Approved accounts get a daily number of calls.
   **[done ACC-01…ACC-03, LIM-01 in code; checked on the deployment after merge]**

## Core User Flow

1. The learner opens the public site (`https://<production-domain>`, or
   `localhost:3000` in development) and registers (`/register`) or signs in
   (`/sign-in`). **[done locally; deployment planned DEP-01]**
   A new account has **trial** access: one call of 1 minute. On `/`, the
   learner can send an access request. The admin approves or rejects it on
   `/admin`. The learner sees the result on `/`. **[planned ACC-01…ACC-03]**
2. On `/`, the profile block is pre-filled from the saved profile. Edits apply
   to this session only, unless the learner presses **Save as default**. The
   learner fills in the session block (topic, scenario, mode, 8–12 target
   words, optional review words and grammar focus, pre-filled weak points,
   10/15/20 minutes) and presses **Start Voice Practice**.
   **[done SET-01…SET-04; weak-point pre-fill planned RV-03]**
3. `POST /api/practice-setup` validates the form and creates a
   `practiceSessions` document with `language: English` and the snapshot of
   profile and setup. The app then opens `/voice-call?sessionId=…`.
   **[done SET-03]** Before creating the session, it checks access:
   - A trial account gets one 1-minute session. After that, it gets 403
     `access_required` until the admin approves it. **[planned ACC-01]**
   - An approved account is checked against the daily call limit. At the
     limit it gets 429, and the form says when the limit resets. **[planned
     LIM-01]**
4. The Dograh Cloud widget loads (American or British workflow, chosen by
   accent) and receives the session context, including `session_id`. The
   learner presses **Start Call**, allows the microphone, and talks with the
   tutor while a countdown runs. **[done; v2 context SET-05; workflows specified
   DG-02…DG-04; to be created by the user in Dograh Cloud, DC-01]**
5. The call ends (End Call, time up, or failure). The final state is saved and
   the app opens `/review?sessionId=…`. **[done]**
6. Dograh Cloud's Webhook node posts `session_id`, `workflow_run_id` and
   `transcript_url` to the Vercel deployment
   (`https://<production-domain>/api/dograh/transcript-webhook`). FluentAI
   downloads the transcript (Dograh's link redirects to its storage), parses
   and stores it, marks the review `pending` and starts generating it in the
   background. **[done TR-01…TR-03]**
7. The review page shows the current state: waiting for the transcript,
   generating, failed (with **Try again**), or the finished review.
   **[planned RV-01, RV-02]**
8. The next session's form pre-fills weak points merged from recent reviews.
   **[planned RV-03]**

## Features

### Account

- Email/password registration with an optional JPG/PNG profile photo up to
  5 MB, sign-in, sign-out, password-reset email, server session cookie
  **[done; real-service check of register/reset/photo pending]**

### Learner profile **[done SET-01, SET-02]**

- Stored per user and pre-filled into every session. Edited inside the session
  form; **Save as default** writes it back.
- `learner_name` (what the tutor calls the learner)
- `native_language` (`Vietnamese`)
- `level` (CEFR `A1`–`C2`)
- `accent` (`american` / `british`)
- `speech_pace` (`slow` / `normal`)
- `correction_style` (`gentle_recast` / `immediate` / `end_of_session`)
- `vietnamese_allowed` (`never` / `only_when_stuck`)

### Session setup

- **[current]** A catalog of 6 languages, 6 topics, levels Beginner–B2,
  5/10/15 minutes and tutor Emma.
- **[done EN-01]** English only. The language picker is hidden, while the
  `language` field stays in the data model and old sessions remain readable.
- **[done SET-01…SET-04]** Session variables:
  - `topic`: free text
  - `scenario`: the setting and the AI's role
  - `session_mode`: `role_play` / `free_talk` / `q_and_a` / `debate`
  - `target_vocabulary`: 8–12 words or phrases (required)
  - `review_vocabulary`: 3–5 (optional)
  - `grammar_focus` (optional)
  - `weak_points`: pre-filled, editable
  - `duration_minutes`: 10 / 15 / 20; a trial session is always 1
    (ACC-01)
  - `tutor_name`: Emma, kept
- Optional fields left empty are stored as `null`. Dograh receives `"none"`
  for them.

### Voice call

- **[done]** Dograh embed widget (voice, headless) in a hidden same-origin
  iframe, with a client countdown and error handling for the microphone,
  network and timeouts.
- **[planned DC-01]** The widget, the workflows and the Webhook node live in
  the user's Dograh Cloud account (`https://app.dograh.com`).
- **[done SET-05, DG-02, DG-04]** Full v2 context passed to the workflow:
  - **Accent is handled by the TTS voice**, through two workflows/embed tokens.
  - **Pace is handled by the prompt.**

### Deployment **[planned DEP-01, DC-01]**

- **Production:** a new Vercel project on the Hobby plan. It builds the `main`
  branch (Node.js 24.x) and serves it on the project's default HTTPS domain
  `https://real-time-voice-agent-language-prac-one.vercel.app`, written
  `<production-domain>` in these files. The old `production` branch is
  deleted. **[done DEP-01, 2026-11-13]**
- **Dograh Cloud:** two workflows (American, British) with one embed token
  each. The allowed domains are the production domain and `localhost:3000`.
  The Webhook node posts to the production domain only.
- **Development:** `npm run dev` on `localhost:3000`, with the same Firebase
  project and the same Dograh Cloud workflows as production. Calls work
  locally. Their webhooks always go to the deployment, which processes them
  through the shared Firestore.
- **Firebase:** one project for development and production. The production
  domain is added to the Auth authorized domains.

### Access, trial and admin **[planned ACC-01…ACC-03]**

- **Trial (every new account):** one practice session with a **1-minute**
  call. It uses the normal setup form, without the duration choice, and gets
  the normal review. Its countdown ends the call at 1 minute.
- **Access request:** from `/`, with an optional message (≤ 300 chars). A
  learner has one request at a time. After a rejection, they can send a new
  one.
- **Single admin account:** the account whose UID equals `ADMIN_UID`
  (server-only). It always has full access, cannot be rejected, and is not
  subject to the daily call limit.
- **Admin page `/admin`:** lists pending requests (name, email, date,
  message, trial used or not), with **Approve** and **Reject**. It also lists
  approved accounts, with **Revoke**. The header shows the admin a link with
  the number of pending requests. Any other user gets 404.
- **Learner states shown on `/`:**
  - trial available
  - trial used
  - request pending (with date)
  - request rejected (with date; a new request is allowed)
  - approved (calls left today)
- Notifications are in-app only. The admin checks `/admin`, and the learner
  sees the decision on `/`. Emails are out of scope.
- Accounts that existed before ACC-01 start in the trial state, with the
  trial unused. Their old sessions stay readable.

### Call limit **[done LIM-01]**

- Registration stays open. To control cost, each **approved** learner can
  start a limited number of full calls per day (`PRACTICE_DAILY_CALL_LIMIT`,
  default 5). The day is the calendar day in `Asia/Ho_Chi_Minh`.
  Trial calls are covered by the trial rule above. The admin is exempt.
- One practice session allows one call, so each created session uses one call
  from the limit. A call that fails is not given back, because call events
  come from the browser and cannot prove that no call took place.
- The home page shows the calls left today. At 0, **Start Voice Practice** is
  disabled, and the page says when the limit resets. The server enforces the
  limit.
- The limit, and the trial rule, cover calls started through FluentAI only.
  The countdown runs in the browser, and the embed token is public. Someone
  who reads the token could start or extend calls outside FluentAI. If Dograh
  Cloud offers a spending limit or a maximum call duration, DC-01 sets them.
  **[planned DG-05]** The widget script URLs (with the token) become
  server-only. Only the owner of a session that can still start a call gets
  one, so anonymous visitors never see the token.

### Transcript and review

- **[current]** A webhook and a 0–100 Gemini review exist, but no session
  has ever reached `transcriptStatus: ready` (see `progress-tracker.md` →
  Session Notes).
- **[done TR-01…TR-03]** The webhook is authenticated with a Bearer token,
  linked by `session_id` and idempotent. Transient download failures are
  retried by Dograh, and the review runs in the background. Real Cloud
  deliveries are still to be checked on the deployment.
- **[done RV-01]** Review v2:
  - **Session goals:** each target/review word is `used_correctly`,
    `used_incorrectly` or `not_used`, with evidence and a correction. Grammar
    focus has correct/incorrect counts with examples. Weak points are marked
    `improved`, `still_present` or `not_observed`. `scenario_completed` is
    judged.
  - **Speaking skills:** `grammar_accuracy`, `lexical_range`,
    `fluency_coherence` and `interaction`, each scored 1–5 against the
    session's CEFR level (3 = at level), with evidence quotes and a comment.
  - Also: overall feedback, grammar errors with corrections, and new weak
    points.
  - Every comment, explanation and correction is shown in English **and**
    Vietnamese. Quotes of the learner stay as spoken.
- **[planned RV-03]** Weak points carry over, merged from recent reviews (max 5).

## Scope

### In Scope

- English speaking practice, with one tutor persona (Emma) and two voices
  (American, British)
- Learner profile, the v2 session setup and the v2 review, as described above
- **Dograh Cloud** (`https://app.dograh.com`) as the only Dograh platform. The
  workflow spec, the seed, the workflow exports and the import/export scripts
  stay versioned in `dograh/`.
- **Public deployment on Vercel** (new project, Hobby plan, Production Branch
  `main`, default `*.vercel.app` domain), plus local development on
  `localhost:3000`
- Open registration, one 1-minute trial call per account, access approval by
  a single admin account, and a daily call limit for approved learners

### Out of Scope

- Practice languages other than English in the UI (the data model keeps
  `language` for later)
- Self-hosting Dograh. The Docker stack built in DG-01 was deleted in DC-02
  (2026-11-14).
- Tunnels to a local Next.js. Webhooks are tested on the deployment.
- Receiving calls or webhooks on Vercel Preview deployments
- A custom domain and paid Vercel plans
- Restricting registration itself (an allowlist or invitations). Registration
  stays open; approval gates use beyond the trial.
- More than one admin, admin role management, and email notifications for
  access requests or decisions
- Retrofitting transcripts for legacy sessions (the old Dograh volume is gone)

### Not implemented — scope undecided (see Open Questions)

- Session history and progress dashboard beyond weak-point carry-over
- Pronunciation scoring, more tutors, resuming an interrupted call
- Roles other than the learner and the single admin
- Required email verification

## Success Criteria

1. A signed-in learner creates a v2 session. Firestore stores
   `schemaVersion: 2`, `language.id: "english"`, the profile snapshot and the
   setup, with `null` for empty optional fields.
2. The Dograh `/init` request carries `session_id` and every v2 context key.
   Empty optional values arrive as `"none"`, and lists are joined with `"; "`.
3. A real call reaches `completed` with `dograh.workflowRunId` stored.
4. Within 30 s of the call ending, the webhook on the Vercel deployment is
   answered with 2xx and the session has `transcriptStatus: "ready"` with
   parsed turns.
5. Without opening the review page, `reviewStatus` becomes `completed`, and
   the stored review passes the v2 validator: every judgment has evidence found
   in learner turns.
6. Redelivering the webhook changes nothing. A wrong Bearer token gets 401. An
   old session with the same run ID is never touched.
7. A failed review can be retried from the review page.
8. The next session's form shows the carried-over weak points, and they can be
   edited.
9. User B cannot read or change user A's profile or sessions.
10. `npm test`, `npm run build` and `npm run lint` pass.
11. Vercel production serves the latest `main`.
    `TEST_BASE_URL=https://<production-domain> npm run test:smoke` passes, and
    the Function logs show no `ERR_REQUIRE_ESM`.
12. On the production domain, one real call per accent goes through criteria
    3–5 (E2E-01 runs on the deployment).
13. A learner who has used the daily limit gets 429 `call_limit_reached` from
    `POST /api/practice-setup`, and the form shows the reset time. No session
    is created. The next day (`Asia/Ho_Chi_Minh`), the learner can start calls
    again.
14. A new account creates one trial session (`kind: "trial"`,
    `durationMinutes: 1`), and its call ends at 1 minute. A second setup gets
    403 `access_required`, with no session created.
15. The learner sends an access request. Only the `ADMIN_UID` account sees
    it on `/admin`, and every other user gets 404 there. After **Approve**,
    the learner can create full sessions (10/15/20 minutes) within the daily
    limit. After **Reject** or **Revoke**, they get 403 again and can send a
    new request.
