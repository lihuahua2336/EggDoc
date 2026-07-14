import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const port = Number(process.env.MOCK_LOGTO_PORT ?? 4323);
const issuer = `http://127.0.0.1:${port}`;
const authorizationCodes = new Map();
const { privateKey, publicKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
const keyId = "eggdoc-test-key";
const stats = { globalLogoutCount: 0, refreshGrantCount: 0 };

function redirect(response, location) {
  response.writeHead(302, { location });
  response.end();
}

function readForm(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(new URLSearchParams(body)));
    request.on("error", reject);
  });
}

async function createIdToken({ clientId, nonce }) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    email: "reader@example.test",
    name: "测试读者",
    nonce,
    picture: "https://images.example.test/reader.png",
  })
    .setProtectedHeader({ alg: "RS256", kid: keyId })
    .setIssuer(issuer)
    .setAudience(clientId)
    .setSubject("eggai-reader-123")
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", issuer);

  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ok");
    return;
  }

  if (url.pathname === "/control/stats") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(stats));
    return;
  }

  if (url.pathname === "/control/reset" && request.method === "POST") {
    stats.globalLogoutCount = 0;
    stats.refreshGrantCount = 0;
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/oidc/logout") {
    stats.globalLogoutCount += 1;
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/.well-known/openid-configuration") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        issuer,
        authorization_endpoint: `${issuer}/oidc/auth`,
        token_endpoint: `${issuer}/oidc/token`,
        jwks_uri: `${issuer}/oidc/jwks`,
        userinfo_endpoint: `${issuer}/oidc/me`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        scopes_supported: ["openid", "profile", "offline_access", "read:ecosystem"],
        code_challenge_methods_supported: ["S256"],
      }),
    );
    return;
  }

  if (url.pathname === "/oidc/jwks") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ keys: [{ ...publicJwk, alg: "RS256", kid: keyId, use: "sig" }] }));
    return;
  }

  if (url.pathname === "/oidc/auth") {
    const encodedRequest = Buffer.from(JSON.stringify(Object.fromEntries(url.searchParams))).toString(
      "base64url",
    );
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="zh-CN"><head><title>EggAi 测试登录</title></head>
      <body><main><h1>EggAi 测试登录</h1>
      <form method="post" action="/oidc/decision">
        <input type="hidden" name="request" value="${encodedRequest}">
        <button name="decision" value="approve">继续登录</button>
        <button name="decision" value="cancel">取消登录</button>
        <button name="decision" value="fail">模拟登录失败</button>
      </form></main></body></html>`);
    return;
  }

  if (url.pathname === "/oidc/decision" && request.method === "POST") {
    void (async () => {
      const form = await readForm(request);
      const authorizationRequest = JSON.parse(
        Buffer.from(form.get("request") ?? "", "base64url").toString("utf8"),
      );
      const callback = new URL(authorizationRequest.redirect_uri);
      callback.searchParams.set("state", authorizationRequest.state);

      if (form.get("decision") === "cancel") {
        callback.searchParams.set("error", "access_denied");
        callback.searchParams.set("error_description", "fixture cancellation details");
      } else if (form.get("decision") === "fail") {
        callback.searchParams.set("error", "server_error");
        callback.searchParams.set("error_description", "fixture sensitive failure details");
      } else {
        const code = randomUUID();
        authorizationCodes.set(code, authorizationRequest);
        callback.searchParams.set("code", code);
      }
      redirect(response, callback.href);
    })();
    return;
  }

  if (url.pathname === "/oidc/token" && request.method === "POST") {
    void (async () => {
      const form = await readForm(request);
      if (
        form.get("client_id") !== "eggdoc-test-client" ||
        form.get("client_secret") !== "eggdoc-test-secret"
      ) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_client" }));
        return;
      }

      if (form.get("grant_type") === "refresh_token") {
        stats.refreshGrantCount += 1;
        response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        response.end(
          JSON.stringify({
            access_token: "fixture-access-token-refreshed",
            expires_in: 3600,
            refresh_token: "fixture-refresh-token-rotated",
            token_type: "Bearer",
          }),
        );
        return;
      }

      const code = form.get("code");
      const authorizationRequest = authorizationCodes.get(code);
      const verifier = form.get("code_verifier") ?? "";
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      if (
        !authorizationRequest ||
        authorizationRequest.code_challenge !== challenge ||
        authorizationRequest.redirect_uri !== form.get("redirect_uri")
      ) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "invalid_grant" }));
        return;
      }

      authorizationCodes.delete(code);
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      response.end(
        JSON.stringify({
          access_token: "fixture-access-token-initial",
          expires_in: 0,
          id_token: await createIdToken({
            clientId: authorizationRequest.client_id,
            nonce: authorizationRequest.nonce,
          }),
          refresh_token: "fixture-refresh-token-initial",
          scope: authorizationRequest.scope,
          token_type: "Bearer",
        }),
      );
    })();
    return;
  }

  response.writeHead(404, { "content-type": "text/plain" });
  response.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`mock Logto listening on ${issuer}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
