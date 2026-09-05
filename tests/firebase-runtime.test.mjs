import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";

test("Firebase Auth loads without require(ESM) support", async () => {
  assert.equal(process.features.require_module, false);
  const { getAuth } = await import("firebase-admin/auth");
  assert.equal(typeof getAuth, "function");
});

test("Firebase's JWKS dependency retrieves a usable signing key", async (t) => {
  const appRequire = createRequire(import.meta.url);
  const adminRequire = createRequire(appRequire.resolve("firebase-admin/auth"));
  const jwksClient = adminRequire("jwks-rsa");
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const kid = "runtime-regression-test";
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, use: "sig", alg: "RS256" };
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ keys: [jwk] }));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const options = {
    jwksUri: `http://127.0.0.1:${server.address().port}/jwks`,
    cache: false,
    rateLimit: false,
  };
  const client = jwksClient(options);
  const key = await client.getSigningKey(kid);
  assert.equal(key.kid, kid);
  const payload = Buffer.from("Firebase runtime regression");
  const signature = sign("RSA-SHA256", payload, privateKey);
  assert.equal(verify("RSA-SHA256", payload, key.getPublicKey(), signature), true);

  // jwks-rsa also loads jose through its Passport integration at startup.
  const secretProvider = jwksClient.passportJwtSecret(options);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ sub: "test-user" })).toString("base64url");
  const signingInput = `${header}.${claims}`;
  const jwtSignature = sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  const token = `${signingInput}.${jwtSignature}`;
  const secret = await new Promise((resolve, reject) => {
    secretProvider({}, token, (error, value) => error ? reject(error) : resolve(value));
  });
  assert.equal(secret, key.getPublicKey());
  const invalidSecret = await new Promise((resolve, reject) => {
    secretProvider({}, "invalid-token", (error, value) => error ? reject(error) : resolve(value));
  });
  assert.equal(invalidSecret, null);
});
