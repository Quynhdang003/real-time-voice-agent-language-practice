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

## Dograh voice practice

Set `NEXT_PUBLIC_DOGRAH_WIDGET_SRC` to the Voice/Headless Dograh embed script URL.
Keep Auto start disabled in Dograh so the browser starts the call only after the
learner presses **Start Call**. Production pages must use HTTPS, and the deployed
site must be present in the embed's allowed-domain configuration.

The application stores only the call lifecycle needed to operate a practice
session: the workflow run ID, timestamps, duration, end state, and optional agent
ID. When a call finishes, the learner remains on the call page and can return to
the home page.

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
