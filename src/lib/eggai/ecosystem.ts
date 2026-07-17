import type { EggAiApiCredential, EggAiModelSummary } from "@/lib/eggai/account-response";

export type EggAiApiAccountResult =
  | { kind: "active" }
  | { kind: "inactive" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

type EcosystemEnvelope = {
  data?: unknown;
  success?: boolean;
};

type EcosystemRequestResult =
  | { kind: "authorization-expired" }
  | { kind: "not-found" }
  | { kind: "success"; payload: EcosystemEnvelope }
  | { kind: "temporary-error" };

export type EggAiApiConfigurationResult =
  | {
      credentials: EggAiApiCredential[];
      kind: "active";
      modelSummary: EggAiModelSummary;
    }
  | { kind: "inactive" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

type EcosystemListResult =
  | { data: unknown[]; kind: "success" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

export async function getEggAiApiAccount(
  ecosystemUrl: URL,
  accessToken: string,
): Promise<EggAiApiAccountResult> {
  const result = await requestEcosystem(ecosystemUrl, accessToken, "/api/ecosystem/me");
  if (result.kind === "not-found") return { kind: "inactive" };
  if (result.kind !== "success") return { kind: result.kind };
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
    getEcosystemList(ecosystemUrl, accessToken, "/api/ecosystem/models"),
    getEcosystemList(ecosystemUrl, accessToken, "/api/ecosystem/tokens"),
  ]);

  if (models.kind !== "success" || tokens.kind !== "success") {
    if (models.kind === "authorization-expired" || tokens.kind === "authorization-expired") {
      return { kind: "authorization-expired" };
    }
    return { kind: "temporary-error" };
  }
  if (tokens.data.length === 0) return { kind: "inactive" };

  const modelNames = models.data.map(parseModelName);
  const credentials = tokens.data.map((token) => parseCredential(token, fallbackBaseUrl));
  if (modelNames.some((name) => name === null) || credentials.some((token) => token === null)) {
    return { kind: "temporary-error" };
  }

  const usableCredentials = credentials.filter(
    (credential): credential is EggAiApiCredential => credential !== null,
  );
  if (usableCredentials.length === 0) return { kind: "temporary-error" };

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
  const result = await requestEcosystem(ecosystemUrl, accessToken, pathname);
  if (result.kind === "authorization-expired") return result;
  if (result.kind !== "success" || !Array.isArray(result.payload.data)) {
    return { kind: "temporary-error" };
  }
  return { data: result.payload.data, kind: "success" };
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
    return { kind: "authorization-expired" };
  }
  if (!response.ok) return { kind: "temporary-error" };

  const payload = (await response.json().catch(() => null)) as EcosystemEnvelope | null;
  if (!payload || payload.success !== true) {
    return { kind: "temporary-error" };
  }
  return { kind: "success", payload };
}

function parseModelName(value: unknown) {
  if (typeof value === "string" && value.length > 0) return value;
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  return typeof value.id === "string" && value.id.length > 0 ? value.id : null;
}

function parseCredential(value: unknown, fallbackBaseUrl: string): EggAiApiCredential | null {
  if (!value || typeof value !== "object") return null;
  if (
    !("token_id" in value) ||
    !("api_key" in value) ||
    !("token_name" in value) ||
    !("group" in value)
  ) {
    return null;
  }

  const { api_key: key, group, token_id: id, token_name: name } = value;
  if (
    !((typeof id === "string" && id.length > 0) || (typeof id === "number" && Number.isFinite(id))) ||
    typeof key !== "string" ||
    key.length === 0 ||
    typeof name !== "string" ||
    name.length === 0 ||
    typeof group !== "string" ||
    group.length === 0
  ) {
    return null;
  }

  const upstreamBaseUrl = "base_url" in value ? value.base_url : undefined;
  if (upstreamBaseUrl !== undefined && typeof upstreamBaseUrl !== "string") return null;
  const baseUrl = parseHttpUrl(upstreamBaseUrl ?? fallbackBaseUrl);
  if (!baseUrl) return null;

  return { baseUrl, group, id: String(id), key, name };
}

function parseHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}
