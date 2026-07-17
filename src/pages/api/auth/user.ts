import type { APIRoute } from "astro";

import { getCurrentAuthorization } from "@/lib/auth/authorization";
import { getAuthConfig } from "@/lib/auth/config";
import { toPublicRequestUrl } from "@/lib/auth/public-url";

export const prerender = false;

const responseOptions = {
  headers: {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
  },
};

export const GET: APIRoute = async ({ cookies, url }) => {
  const config = getAuthConfig(url);
  if (!config) {
    return Response.json(
      { authenticated: false, unavailable: true },
      { ...responseOptions, status: 503 },
    );
  }

  const result = await getCurrentAuthorization(
    cookies,
    toPublicRequestUrl(url, config.siteUrl),
    config,
  );
  if (!result.authorization) {
    return Response.json(
      {
        authenticated: false,
        ...(result.reauthorizationRequired ? { reauthorizationRequired: true } : {}),
      },
      responseOptions,
    );
  }

  return Response.json(
    {
      authenticated: true,
      eggAiPlatformUrl: config.eggAiPlatformUrl.href,
      identity: result.authorization.identity,
    },
    responseOptions,
  );
};
