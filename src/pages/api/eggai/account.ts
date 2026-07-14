import type { APIRoute } from "astro";

import { getCurrentAuthorization } from "@/lib/auth/authorization";
import { getAuthConfig } from "@/lib/auth/config";
import type { EggAiApiAccountResponse } from "@/lib/eggai/account-response";
import { getEcosystemUrl } from "@/lib/eggai/config";
import { getEggAiApiAccount } from "@/lib/eggai/ecosystem";
import { clearSession } from "@/lib/auth/session";

export const prerender = false;

const responseOptions = {
  headers: {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json",
  },
};

function json(body: EggAiApiAccountResponse, status = 200) {
  return Response.json(body, { ...responseOptions, status });
}

export const GET: APIRoute = async ({ cookies, url }) => {
  const config = getAuthConfig();
  const ecosystemUrl = getEcosystemUrl();
  if (!config || !ecosystemUrl) return json({ state: "unavailable" }, 503);

  const current = await getCurrentAuthorization(cookies, url, config);
  if (!current.authorization) {
    return json(
      { state: current.reauthorizationRequired ? "reauthorization-required" : "anonymous" },
      401,
    );
  }

  const account = await getEggAiApiAccount(
    ecosystemUrl,
    current.authorization.accessToken,
  );
  if (account.kind === "authorization-expired") {
    clearSession(cookies, url);
    return json({ state: "reauthorization-required" }, 401);
  }
  if (account.kind === "temporary-error") {
    return json({ state: "temporary-error" }, 502);
  }

  return json({
    activationUrl: config.eggAiPlatformUrl.href,
    state: account.kind,
  });
};
