import type { EggAiApiCredential, EggAiModelSummary } from "@/lib/eggai/account-response";

export type EggAiApiAccountResult =
  | EcosystemDenied
  | { kind: "active" }
  | { kind: "inactive" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

type EcosystemEnvelope = {
  code?: number;
  data?: unknown;
  success?: boolean;
};

type EcosystemDenied = { kind: "access-denied"; reason: string };

type EcosystemRequestResult =
  | EcosystemDenied
  | { kind: "authorization-expired" }
  | { kind: "not-found" }
  | { kind: "success"; payload: EcosystemEnvelope }
  | { kind: "temporary-error" };

export type EggAiApiConfigurationResult =
  | EcosystemDenied
  | {
      credentials: EggAiApiCredential[];
      kind: "active";
      modelSummary: EggAiModelSummary;
    }
  | { kind: "inactive" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

type EcosystemListResult =
  | EcosystemDenied
  | { data: unknown[]; kind: "success" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

export async function getEggAiApiAccount(
  ecosystemUrl: URL,
  accessToken: string,
): Promise<EggAiApiAccountResult> {
  const result = await requestEcosystem(ecosystemUrl, accessToken, "/api/v1/ecosystem/me");
  if (result.kind === "not-found") return { kind: "inactive" };
  if (result.kind !== "success") return result;
  if (
    !result.payload.data ||
    typeof result.payload.data !== "object" ||
    Array.isArray(result.payload.data)
  ) {
    return { kind: "temporary-error" };
  }
  return { kind: "active" };
}

export async function getEggAiApiConfiguration(
  ecosystemUrl: URL,
  accessToken: string,
  fallbackBaseUrl: string,
): Promise<EggAiApiConfigurationResult> {
  const [models, tokens] = await Promise.all([
    getEcosystemList(ecosystemUrl, accessToken, "/api/v1/ecosystem/models"),
    getEcosystemList(ecosystemUrl, accessToken, "/api/v1/ecosystem/keys?page=1&page_size=100"),
  ]);

  if (models.kind !== "success" || tokens.kind !== "success") {
    if (models.kind === "access-denied") return models;
    if (tokens.kind === "access-denied") return tokens;
    if (models.kind === "authorization-expired" || tokens.kind === "authorization-expired") {
      return { kind: "authorization-expired" };
    }
    return { kind: "temporary-error" };
  }
  if (tokens.data.length === 0) return { kind: "inactive" };

  const modelNames = models.data.map(parseModelName);
  const credentials = tokens.data
    .filter((token) => !isUnusableKey(token))
    .map((token) => parseCredential(token, fallbackBaseUrl));
  if (modelNames.some((name) => name === null) || credentials.some((token) => token === null)) {
    return { kind: "temporary-error" };
  }

  const usableCredentials = credentials.filter(
    (credential): credential is EggAiApiCredential => credential !== null,
  );
  if (usableCredentials.length === 0) return { kind: "inactive" };

  const names = [...new Set(modelNames.filter((name): name is string => name !== null))];
  return {
    credentials: usableCredentials,
    kind: "active",
    modelSummary: { availableCount: names.length, names },
  };
}

async function getEcosystemList(
  ecosystemUrl: URL,
  accessToken: string,
  pathname: string,
): Promise<EcosystemListResult> {
  const items: unknown[] = [];
  let nextPath: string | null = pathname;
  while (nextPath) {
    const expectedPage = Number(new URL(nextPath, ecosystemUrl).searchParams.get("page") ?? 1);
    const result = await requestEcosystem(ecosystemUrl, accessToken, nextPath);
    if (result.kind === "authorization-expired" || result.kind === "access-denied") return result;
    if (result.kind !== "success") return { kind: "temporary-error" };
    const data = result.payload.data;
    if (Array.isArray(data)) return { data: [...items, ...data], kind: "success" };
    if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items)) {
      return { kind: "temporary-error" };
    }
    if (!("page" in data) || !("pages" in data) ||
        typeof data.page !== "number" || !Number.isInteger(data.page) || data.page < 1 ||
        typeof data.pages !== "number" || !Number.isInteger(data.pages) || data.pages < data.page ||
        data.page !== expectedPage) {
      return { kind: "temporary-error" };
    }
    items.push(...data.items);
    nextPath = null;
    if (data.page < data.pages) {
      const next = new URL(pathname, ecosystemUrl);
      next.searchParams.set("page", String(data.page + 1));
      nextPath = next.pathname + next.search;
    }
  }
  return { data: items, kind: "success" };
}

async function requestEcosystem(
  ecosystemUrl: URL,
  accessToken: string,
  pathname: string,
): Promise<EcosystemRequestResult> {
  let response: Response;
  try {
    response = await fetch(new URL(pathname, ecosystemUrl), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { kind: "temporary-error" };
  }

  if (response.status === 404) return { kind: "not-found" };
  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => null);
    const allowedReasons = ["invalid_logto_token", "insufficient_scope", "ecosystem_client_not_allowed",
      "ecosystem_identity_not_linked", "ecosystem_user_unavailable", "ecosystem_disabled"];
    const reason = allowedReasons.includes(body?.reason) ? body.reason as string : "upstream_access_denied";
    console.warn("EggAi ecosystem authorization rejected", JSON.stringify({
      path: new URL(pathname, ecosystemUrl).pathname, status: response.status, reason,
    }));
    if (response.status === 401) return { kind: "authorization-expired" };
    return { kind: "access-denied", reason };
  }
  if (!response.ok) return { kind: "temporary-error" };

  const payload = (await response.json().catch(() => null)) as EcosystemEnvelope | null;
  if (!payload || !(payload.code === 0 || (payload.code === undefined && payload.success === true))) {
    return { kind: "temporary-error" };
  }
  return { kind: "success", payload };
}

function parseModelName(value: unknown) {
  if (typeof value === "string" && value.length > 0) return value;
  if (!value || typeof value !== "object") return null;
  if ("model" in value && typeof value.model === "string" && value.model.length > 0) {
    return value.model;
  }
  return "id" in value && typeof value.id === "string" && value.id.length > 0
    ? value.id
    : null;
}

function parseCredential(value: unknown, fallbackBaseUrl: string): EggAiApiCredential | null {
  if (!value || typeof value !== "object") return null;
  const id = "id" in value ? value.id : "token_id" in value ? value.token_id : undefined;
  const key = "key" in value ? value.key : "api_key" in value ? value.api_key : undefined;
  const name = "name" in value ? value.name : "token_name" in value ? value.token_name : undefined;
  const group = "group" in value ? value.group : "group_id" in value ? value.group_id ?? "未分组" : undefined;
  if (
    !((typeof id === "string" && id.length > 0) || (typeof id === "number" && Number.isFinite(id))) ||
    typeof key !== "string" ||
    key.length === 0 ||
    typeof name !== "string" ||
    name.length === 0 ||
    !(typeof group === "string" || (typeof group === "number" && Number.isFinite(group))) ||
    String(group).length === 0
  ) {
    return null;
  }

  const upstreamBaseUrl = "base_url" in value ? value.base_url : undefined;
  if (upstreamBaseUrl !== undefined && typeof upstreamBaseUrl !== "string") return null;
  const baseUrl = parseHttpUrl(upstreamBaseUrl ?? fallbackBaseUrl);
  if (!baseUrl) return null;

  return { baseUrl, group: String(group), id: String(id), key, name };
}

function isUnusableKey(value: unknown) {
  return Boolean(value && typeof value === "object" &&
    (("is_expired" in value && value.is_expired === true) ||
     ("is_quota_exhausted" in value && value.is_quota_exhausted === true)));
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}
