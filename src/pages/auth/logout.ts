import type { APIRoute } from "astro";

import { clearSession } from "@/lib/auth/session";

export const prerender = false;

export const POST: APIRoute = ({ cookies, request, url }) => {
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  clearSession(cookies, url);
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
};
