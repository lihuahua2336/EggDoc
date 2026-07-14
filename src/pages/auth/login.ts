import type { APIRoute } from "astro";

import { getAuthConfig } from "@/lib/auth/config";
import { discoverOidc, oidc } from "@/lib/auth/oidc";
import { addAuthError, validateReturnTo } from "@/lib/auth/redirect";
import { redirectNoStore } from "@/lib/auth/response";
import { createSession, readSession, writeSession } from "@/lib/auth/session";

export const prerender = false;

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const returnTo = validateReturnTo(url.searchParams.get("returnTo"), url.origin);
  const config = getAuthConfig();
  if (!config) return redirectNoStore(addAuthError(returnTo, "unavailable"));

  try {
    const oidcConfig = await discoverOidc(config);
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const now = Math.floor(Date.now() / 1000);
    const session = (await readSession(cookies, config.sessionSecret)) ?? createSession(now);
    session.pending = { codeVerifier, createdAt: now, nonce, returnTo, state };
    await writeSession(cookies, url, session, config.sessionSecret);

    const authorizationUrl = oidc.buildAuthorizationUrl(oidcConfig, {
      client_id: config.clientId,
      code_challenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: "S256",
      nonce,
      redirect_uri: new URL("/auth/callback", request.url).href,
      resource: config.resource,
      response_type: "code",
      scope: config.scopes,
      state,
      ...(url.searchParams.get("reauthorize") === "1" ? { prompt: "consent" } : {}),
    });
    return redirectNoStore(authorizationUrl.href);
  } catch {
    return redirectNoStore(addAuthError(returnTo, "unavailable"));
  }
};
