import type { APIRoute } from "astro";

import { PUBLIC_EGGAI_BASE_URL } from "@/config/public";
import { getCurrentAuthorization } from "@/lib/auth/authorization";
import { getAuthConfig } from "@/lib/auth/config";
import { clearSession } from "@/lib/auth/session";
import type { EggAiApiAccountResponse } from "@/lib/eggai/account-response";
import { getEcosystemUrl } from "@/lib/eggai/config";
import { getEggAiApiAccount, getEggAiApiConfiguration } from "@/lib/eggai/ecosystem";

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

  if (account.kind === "active") {
    const configuration = await getEggAiApiConfiguration(
      ecosystemUrl,
      current.authorization.accessToken,
      PUBLIC_EGGAI_BASE_URL,
    );
    if (configuration.kind === "authorization-expired") {
      clearSession(cookies, url);
      return json({ state: "reauthorization-required" }, 401);
    }
    if (configuration.kind === "temporary-error") {
      return json({ state: "temporary-error" }, 502);
    }
    return json({
      activationUrl: config.eggAiPlatformUrl.href,
      credentials: configuration.credentials,
      modelSummary: configuration.modelSummary,
      state: "active",
    });
  }

  return json({
    activationUrl: config.eggAiPlatformUrl.href,
    state: account.kind,
  });
};
