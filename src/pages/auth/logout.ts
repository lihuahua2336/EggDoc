import type { APIRoute } from "astro";

import { getSiteUrl } from "@/lib/auth/config";
import { clearSession } from "@/lib/auth/session";

export const prerender = false;

export const POST: APIRoute = ({ cookies, request, url }) => {
  const siteUrl = getSiteUrl(url);
  if (!siteUrl) {
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const origin = request.headers.get("Origin");
  if (origin && origin !== siteUrl.origin) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  clearSession(cookies, siteUrl);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
};
