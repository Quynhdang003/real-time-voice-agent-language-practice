import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { generateKeyPairSync } from "node:crypto";
const require = createRequire(import.meta.url);

test("Firebase Auth imports with synchronous require(ESM) disabled", () => {
  const { getAuth } = require("firebase-admin/auth");
  assert.equal(typeof getAuth, "function");
});
test("patched JWKS retrieval converts a real RSA JWK without network", async () => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", use: "sig", alg: "RS256" };
  const jwks = require("jwks-rsa");
  const client = jwks({ jwksUri: "https://unused.example.test", fetcher: async () => ({ keys: [jwk] }) });
  const key = await client.getSigningKey("test-key");
  assert.equal(key.kid, "test-key");
  assert.match(key.getPublicKey(), /BEGIN PUBLIC KEY/);
});
