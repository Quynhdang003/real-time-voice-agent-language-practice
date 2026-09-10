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

## Dograh transcript webhook

Configure Dograh to POST its transcript event to
`/api/dograh/transcript-webhook` with the `x-dograh-webhook-secret` header matching
the server's `DOGRAH_WEBHOOK_SECRET`.

Set `DOGRAH_TRANSCRIPT_ALLOWED_HOSTS` to comma-separated exact, trusted hostnames
from your actual Dograh `transcript_url` storage URLs (no scheme, path, or
wildcards). The default is `app.dograh.com`; if Dograh uses another storage host,
add that host explicitly before testing. Only configure provider-controlled
public hosts, never localhost or internal services. Downloads require HTTPS,
reject redirects, time out after 15 seconds, and accept at most 256 KiB.
Signed query parameters are preserved; API keys are not sent to storage.

For local Dograh in Docker with Next.js running on the host, add these server-only
settings to `.env.local` and restart Next.js:

```dotenv
DOGRAH_TRANSCRIPT_MODE=local
DOGRAH_TRANSCRIPT_LOCAL_ORIGINS=http://localhost:8000,http://localhost:9000
```

These origins allow the Dograh API on port 8000 to redirect to MinIO on port 9000.
An origin must match the scheme, hostname, and port exactly, with no path, query,
or trailing slash. Local origins are ignored unless the mode is exactly `local`.
Only HTTP(S) is accepted, URL credentials are rejected, and each redirect target
must pass the URL policy before a request is sent. Downloads follow at most three
redirects from configured local origins, sharing one 15-second deadline including
the final body. The 256 KiB limit and UTF-8 validation still apply.

Remove both local settings for public deployments. Without the local opt-in, the
HTTPS-only policy and rejection of redirects remain unchanged. If Next.js runs in
a container, configure origins reachable from that container instead of assuming
that `localhost` refers to the Docker host.

For a known workflow run, the webhook stores parsed turns in `dograh.transcript`
and sets `dograh.transcriptStatus` to `ready`, `empty`, or `error`. A repeated
delivery of the same successfully downloaded URL reuses the stored transcript.
Failed downloads can be retried by redelivering the webhook (use a fresh signed
URL if expired). Download failures are stored as `error` and acknowledged with
HTTP 200; there is no automatic background retry.

Run `npm run test:dograh-transcript` for isolated download/parser/webhook tests.
Also verify a real call on staging: its run ID must already be saved on the
practice session when the webhook arrives. Unknown runs are acknowledged and
skipped; they are not queued for later ingestion.

To recover an existing local session after enabling these settings, redeliver
`POST /api/dograh/transcript-webhook` with the existing secret header and a JSON
body containing its `workflow_run_id` and full saved `dograh.transcriptUrl` as
`transcript_url`. Verify `dograh.transcriptStatus` becomes `ready` and parsed turns
are saved in Firestore, then reload the review page. HTTP 200 alone does not prove
the transcript downloaded. Do not manually set `ready` without parsed turns.

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

Use Node.js 24.x (also declared in `package.json`) and install dependencies with
`npm ci`. The `postinstall` script applies `patches/jwks-rsa+4.1.0.patch`; do not
disable install scripts. Include the patch file with the deployment source.

This patch loads `jose` via dynamic import in both JWKS key retrieval and the
Passport integration, so Firebase Admin can start when the serverless runtime
disables synchronous `require(ESM)`. The `jwks-rsa` override pins the version the
patch targets. Revisit both when an upstream release fixes these imports.
See [upstream issue](https://github.com/auth0/node-jwks-rsa/issues/507).

Run `npm run test:firebase-runtime` to check Firebase Auth imports and signing-key
retrieval with `require(ESM)` disabled, then `npm run build`. After deploying,
check `/` and `/sign-in` in the Function logs for `ERR_REQUIRE_ESM`.

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
