This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Dograh (voice tutor)

FluentAI uses **Dograh Cloud** (`https://app.dograh.com`) for the voice calls, in development and production.
The two tutor workflows (American and British) are defined in
[`dograh/workflow-spec.md`](dograh/workflow-spec.md). The setup steps, in Vietnamese, are in
[`dograh/README.md`](dograh/README.md).

The widget script URLs are the server-only variables `DOGRAH_WIDGET_SRC_AMERICAN` / `DOGRAH_WIDGET_SRC_BRITISH`.
The `/voice-call` page passes the URL only to the owner of a session that can still start a call. Never use a
`NEXT_PUBLIC_` name for them, because it would publish the embed token in the JS bundle.

The self-hosted Docker stack used earlier was removed in DC-02.

## Dograh transcript webhook

After each call, the Webhook node of both Dograh Cloud workflows posts to
`https://<production-domain>/api/dograh/transcript-webhook` (calls started on `localhost:3000` are
delivered there too). The node and its `payload_template` are specified in
[`dograh/workflow-spec.md`](dograh/workflow-spec.md); the API contract is in
[`context/api-contracts.md`](context/api-contracts.md).

- **Auth:** `Authorization: Bearer <DOGRAH_WEBHOOK_SECRET>`, sent by the node's `bearer_token` credential.
  A missing secret on the server answers 401 to everything. Use one word (e.g. 32 random bytes as hex).
- **Payload:** flat strings; `""` means "not sent". `session_id` (from the widget context) finds the
  session; `workflow_run_id` is only a cross-check. A delivery for a missing session or for another run is
  answered 200 `skipped` and changes nothing.
- **Transcript:** downloaded from `transcript_url` over HTTPS. The link and every redirect hop (at most 3,
  each checked before it is requested) must be on a host in `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS`
  (comma-separated exact hostnames; default `app.dograh.com,api.dograh.com`). One 15 s deadline, 256 KiB,
  strict UTF-8, signed query kept, no API key sent. The result is stored as `dograh.transcript` with
  `dograh.transcriptStatus` `ready`, `empty` (no speech, or no `transcript_url`) or `error` plus a reason in
  `dograh.transcriptError`.
- **Retries:** a timeout, network error or 5xx from storage answers **503** without writing anything, so
  Dograh retries (attempts 1–4). On the last attempt (`X-Dograh-Delivery-Attempt: 5`, or no header), or for a
  permanent failure, `error` and its reason are stored.
- **Idempotent:** once a session is `ready` or `empty`, a redelivery changes nothing and downloads nothing.
- **Review:** a `ready` transcript also sets `reviewStatus: "pending"`; after answering, the route starts the
  Gemini review with `after()` (`maxDuration = 60` on Vercel Hobby). The review page stays as a fallback. A
  `processing` claim is a 3-minute lease (`reviewClaimedAt`), so a review cut off by the time limit can be
  claimed again.
- **Finding the storage host:** a link or redirect to a host that is not allowlisted is stored as
  `untrusted_url` / `redirect_rejected` and logged as `[dograh.webhook.download] {code, host}` (the hostname
  only, never the URL). Add that host to `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` on Vercel, redeploy, then redeliver.

To retry a session stuck in `error`, redeliver with `curl` and the Bearer header, with a body holding its
`session_id`, `workflow_run_id` and the saved `dograh.transcriptUrl` as `transcript_url` (from Firestore). If
it fails again, the download link may have expired; use the current one from Dograh's run page. Check that `dograh.transcriptStatus` becomes `ready` with parsed turns; HTTP 200 alone does not prove
the download worked.

Run `npm run test:dograh-transcript` for the download, parser and webhook tests.

## Testing

Run `npm test` for all automated tests, then `npm run lint`,
`npx tsc --noEmit`, and `npm run build`. Use Node.js 24.x for release validation.
See [the test plan and execution report](docs/TESTING.md) for coverage,
known failures, and the staging checks that require real services.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

Production is a Vercel project on the Hobby plan that builds the `main` branch and
serves it on the project's default `<project>.vercel.app` domain. Development keeps
running on `localhost:3000` with `.env.local`; both use the same Firebase project.
Background and limits: [`context/architecture.md`](context/architecture.md) →
"Deployment (Vercel)".

### 1. Create the project (once)

1. In the Vercel dashboard: **Add New → Project**, import this GitHub repository.
   Framework preset **Next.js**, root directory = repository root.
2. **Build and Output Settings:** keep the build command (`next build`); set the
   install command to `npm ci`, so the lockfile and the `jwks-rsa` override are used
   exactly. Do not disable install scripts: `postinstall` applies the patch below.
3. **Settings → General → Node.js Version:** `24.x` (also `engines` in `package.json`).
4. **Settings → Git → Production Branch:** `main`. Other branches get Preview
   deployments.
5. **Settings → Deployment Protection:** keep Vercel Authentication on for Preview
   deployments (the default). Dograh never posts to Preview URLs.

### 2. Environment variables

Set these for **Production** and **Preview** (Settings → Environment Variables).
A change applies only to new deployments: redeploy after editing.

| Variable | Value |
| --- | --- |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Same as `.env.local`. The private key may keep its `\n` escapes; `firebase/admin.ts` turns them into newlines |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Same as `.env.local` |
| `ADMIN_UID` | The Firebase Auth UID of the single admin account (Firebase console → Authentication → Users). The admin has full access and approves access requests. Without it, nobody can be approved |
| `PRACTICE_DAILY_CALL_LIMIT` | Full calls per approved learner per day, Vietnam time. Optional; `5` when unset or invalid. The admin is exempt |
| `DOGRAH_WEBHOOK_SECRET` | A new random value (e.g. 32 random bytes as hex). DC-01 puts the same value in the Dograh Cloud `bearer_token` credential |
| `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` | `app.dograh.com,api.dograh.com,<storage host>`. The storage host is the one in the Vercel logs (`[dograh.webhook.download] {code: "redirect_rejected", host}`) after the first real call |
| `DOGRAH_WIDGET_SRC_AMERICAN`, `DOGRAH_WIDGET_SRC_BRITISH` | The Dograh Cloud embed script URL of each workflow ([`dograh/README.md`](dograh/README.md)). Server-only; never `NEXT_PUBLIC_` |

Do **not** set `DOGRAH_API_KEY`, `DOGRAH_API_BASE_URL` or any `NEXT_PUBLIC_DOGRAH_*` variable on Vercel.
Delete any other `DOGRAH_*` variable left over from earlier versions (`DOGRAH_WORKFLOW_ID`, the old local
transcript mode): nothing reads them. Until the
widget URLs are set, `/voice-call` reports that voice calling is not configured.

### 3. Firebase

Firebase console → **Authentication → Settings → Authorized domains** → add
`<project>.vercel.app`.

### 4. Verify

```bash
TEST_BASE_URL=https://<project>.vercel.app npm run test:smoke
```

In PowerShell: `$env:TEST_BASE_URL="https://<project>.vercel.app"; npm run test:smoke`.
Then open `/` and `/sign-in` and check the project's Logs for `ERR_REQUIRE_ESM`, sign in
and create a practice session, and confirm that a Preview URL asks for a Vercel login.

### Firebase Admin patch

`patches/jwks-rsa+4.1.0.patch` loads `jose` via dynamic import in both JWKS key
retrieval and the Passport integration, so Firebase Admin can start when the
serverless runtime disables synchronous `require(ESM)`. The `jwks-rsa` override pins
the version the patch targets. Revisit both when an upstream release fixes these
imports. See [upstream issue](https://github.com/auth0/node-jwks-rsa/issues/507).
Run `npm run test:firebase-runtime` to check Firebase Auth imports and signing-key
retrieval with `require(ESM)` disabled, then `npm run build`.
