import type { APIRoute } from "astro";

import { getCurrentAuthorization } from "@/lib/auth/authorization";
import { getAuthConfig } from "@/lib/auth/config";

export const prerender = false;

const responseOptions = {
  headers: {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
  },
};

export const GET: APIRoute = async ({ cookies, url }) => {
  const config = getAuthConfig();
  if (!config) {
    return Response.json({ authenticated: false, unavailable: true }, { ...responseOptions, status: 503 });
  }

  const result = await getCurrentAuthorization(cookies, url, config);
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
