import * as oidc from "openid-client";

import type { AuthConfig } from "@/lib/auth/config";

function getLoopbackTestHook() {
  const hook: unknown = Reflect.get(oidc, "allowInsecureRequests");
  if (typeof hook !== "function") {
    throw new Error("The OIDC library cannot enable the loopback test issuer");
  }
  return hook as (configuration: oidc.Configuration) => void;
}

export async function discoverOidc(config: AuthConfig) {
  const isLoopbackIssuer =
    config.issuer.protocol === "http:" &&
    (config.issuer.hostname === "127.0.0.1" || config.issuer.hostname === "localhost");
  return oidc.discovery(
    config.issuer,
    config.clientId,
    config.clientSecret,
    config.clientSecret ? oidc.ClientSecretPost(config.clientSecret) : oidc.None(),
    isLoopbackIssuer ? { execute: [getLoopbackTestHook()] } : undefined,
  );
}

export { oidc };
