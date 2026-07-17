import {
  EGGDOC_EGGAI_PLATFORM_URL,
  EGGDOC_OIDC_CLIENT_ID,
  EGGDOC_OIDC_CLIENT_SECRET,
  EGGDOC_OIDC_ISSUER,
  EGGDOC_OIDC_RESOURCE,
  EGGDOC_OIDC_SCOPES,
  EGGDOC_SESSION_SECRET,
  EGGDOC_SITE_URL,
} from "astro:env/server";

import { isAllowedPublicSiteUrl } from "@/lib/auth/public-url";

export type AuthConfig = {
  clientId: string;
  clientSecret?: string;
  eggAiPlatformUrl: URL;
  issuer: URL;
  resource: string;
  scopes: string;
  sessionSecret: string;
  siteUrl: URL;
};

export function getSiteUrl(requestUrl: URL): URL | null {
  try {
    const siteUrl = new URL(EGGDOC_SITE_URL ?? requestUrl.origin);
    if (!isAllowedPublicSiteUrl(siteUrl)) return null;
    if (siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) return null;
    return siteUrl;
  } catch {
    return null;
  }
}

export function getAuthConfig(requestUrl: URL): AuthConfig | null {
  const siteUrl = getSiteUrl(requestUrl);
  if (
    !siteUrl ||
    !EGGDOC_OIDC_ISSUER ||
    !EGGDOC_OIDC_CLIENT_ID ||
    !EGGDOC_OIDC_RESOURCE ||
    !EGGDOC_OIDC_SCOPES ||
    !EGGDOC_SESSION_SECRET ||
    !EGGDOC_EGGAI_PLATFORM_URL
  ) {
    return null;
  }

  try {
    return {
      clientId: EGGDOC_OIDC_CLIENT_ID,
      clientSecret: EGGDOC_OIDC_CLIENT_SECRET,
      eggAiPlatformUrl: new URL(EGGDOC_EGGAI_PLATFORM_URL),
      issuer: new URL(EGGDOC_OIDC_ISSUER),
      resource: EGGDOC_OIDC_RESOURCE,
      scopes: EGGDOC_OIDC_SCOPES,
      sessionSecret: EGGDOC_SESSION_SECRET,
      siteUrl,
    };
  } catch {
    return null;
  }
}
