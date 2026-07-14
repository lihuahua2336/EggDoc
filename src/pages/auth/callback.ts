import type { APIRoute } from "astro";

import { getAuthConfig } from "@/lib/auth/config";
import { discoverOidc, oidc } from "@/lib/auth/oidc";
import { addAuthError } from "@/lib/auth/redirect";
import { redirectNoStore } from "@/lib/auth/response";
import {
  AUTHORIZATION_PENDING_MAX_AGE_SECONDS,
  clearSession,
  readSession,
  writeSession,
  type EggDocIdentity,
} from "@/lib/auth/session";

export const prerender = false;

function getIdentity(claims: ReturnType<oidc.TokenEndpointResponseHelpers["claims"]>) {
  if (!claims || typeof claims.sub !== "string") return null;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const name =
    typeof claims.name === "string"
      ? claims.name
      : typeof claims.preferred_username === "string"
        ? claims.preferred_username
        : email ?? claims.sub;
  const identity: EggDocIdentity = { name, subject: claims.sub };
  if (email) identity.email = email;
  if (typeof claims.picture === "string") identity.picture = claims.picture;
  return identity;
}

export const GET: APIRoute = async ({ cookies, request, url }) => {
  const config = getAuthConfig();
  if (!config) return redirectNoStore(addAuthError("/", "unavailable"));

  const session = await readSession(cookies, config.sessionSecret);
  const pending = session?.pending;
  const now = Math.floor(Date.now() / 1000);
  if (!session || !pending || now - pending.createdAt > AUTHORIZATION_PENDING_MAX_AGE_SECONDS) {
    clearSession(cookies, url);
    return redirectNoStore(addAuthError("/", "failed"));
  }

  const returnTo = pending.returnTo;
  const returnedState = url.searchParams.get("state");
  const authorizationError = url.searchParams.get("error");
  if (authorizationError || returnedState !== pending.state) {
    session.pending = undefined;
    await writeSession(cookies, url, session, config.sessionSecret);
    return redirectNoStore(
      addAuthError(
        returnTo,
        authorizationError === "access_denied" && returnedState === pending.state
          ? "cancelled"
          : "failed",
      ),
    );
  }

  try {
    const oidcConfig = await discoverOidc(config);
    const tokens = await oidc.authorizationCodeGrant(
      oidcConfig,
      new URL(request.url),
      {
        expectedNonce: pending.nonce,
        expectedState: pending.state,
        pkceCodeVerifier: pending.codeVerifier,
      },
      { resource: config.resource },
    );
    const identity = getIdentity(tokens.claims());
    const refreshToken = tokens.refresh_token ?? session.authorization?.refreshToken;
    if (!identity || !tokens.access_token || !refreshToken) {
      throw new Error("OIDC response did not establish an EggDoc Session");
    }

    session.authorization = {
      accessToken: tokens.access_token,
      accessTokenExpiresAt: now + (tokens.expiresIn() ?? 300),
      identity,
      refreshToken,
    };
    session.pending = undefined;
    await writeSession(cookies, url, session, config.sessionSecret);
    return redirectNoStore(returnTo);
  } catch {
    session.pending = undefined;
    await writeSession(cookies, url, session, config.sessionSecret);
    return redirectNoStore(addAuthError(returnTo, "failed"));
  }
};
