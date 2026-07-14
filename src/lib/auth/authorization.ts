import type { AstroCookies } from "astro";

import type { AuthConfig } from "@/lib/auth/config";
import { discoverOidc, oidc } from "@/lib/auth/oidc";
import {
  SESSION_COOKIE_NAME,
  clearSession,
  readSession,
  writeSession,
  type EggDocAuthorization,
} from "@/lib/auth/session";

type AuthorizationResult =
  | { authorization: EggDocAuthorization; reauthorizationRequired: false }
  | { authorization: null; reauthorizationRequired: boolean };

export async function getCurrentAuthorization(
  cookies: AstroCookies,
  requestUrl: URL,
  config: AuthConfig,
): Promise<AuthorizationResult> {
  const hadCookie = Boolean(cookies.get(SESSION_COOKIE_NAME));
  const session = await readSession(cookies, config.sessionSecret);
  if (!session) {
    if (hadCookie) clearSession(cookies, requestUrl);
    return { authorization: null, reauthorizationRequired: false };
  }
  if (!session.authorization) {
    return { authorization: null, reauthorizationRequired: false };
  }

  const now = Math.floor(Date.now() / 1000);
  if (session.authorization.accessTokenExpiresAt > now + 60) {
    return { authorization: session.authorization, reauthorizationRequired: false };
  }

  try {
    const refreshed = await oidc.refreshTokenGrant(
      await discoverOidc(config),
      session.authorization.refreshToken,
      { resource: config.resource },
    );
    if (!refreshed.access_token) throw new Error("OIDC refresh did not return an access token");
    session.authorization = {
      ...session.authorization,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: now + (refreshed.expiresIn() ?? 300),
      refreshToken: refreshed.refresh_token ?? session.authorization.refreshToken,
    };
    await writeSession(cookies, requestUrl, session, config.sessionSecret);
    return { authorization: session.authorization, reauthorizationRequired: false };
  } catch {
    clearSession(cookies, requestUrl);
    return { authorization: null, reauthorizationRequired: true };
  }
}
