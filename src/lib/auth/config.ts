import {
  EGGDOC_EGGAI_PLATFORM_URL,
  EGGDOC_OIDC_CLIENT_ID,
  EGGDOC_OIDC_CLIENT_SECRET,
  EGGDOC_OIDC_ISSUER,
  EGGDOC_OIDC_RESOURCE,
  EGGDOC_OIDC_SCOPES,
  EGGDOC_SESSION_SECRET,
} from "astro:env/server";

export type AuthConfig = {
  clientId: string;
  clientSecret?: string;
  eggAiPlatformUrl: URL;
  issuer: URL;
  resource: string;
  scopes: string;
  sessionSecret: string;
};

export function getAuthConfig(): AuthConfig | null {
  if (
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
    };
  } catch {
    return null;
  }
}
