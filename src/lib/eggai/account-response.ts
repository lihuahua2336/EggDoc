export type EggAiApiCredential = {
  baseUrl: string;
  group: string;
  id: string;
  key: string;
  name: string;
};

export type EggAiModelSummary = {
  availableCount: number;
  names: string[];
};

export type EggAiApiAccountResponse =
  | {
      activationUrl: string;
      credentials: EggAiApiCredential[];
      modelSummary: EggAiModelSummary;
      state: "active";
    }
  | { activationUrl: string; state: "inactive" }
  | {
      state:
        | "anonymous"
        | "reauthorization-required"
        | "temporary-error"
        | "unavailable";
    };

export function parseEggAiApiAccountResponse(value: unknown): EggAiApiAccountResponse | null {
  if (!value || typeof value !== "object" || !("state" in value)) return null;
  const state = value.state;
  if (state === "active") {
    if (!("activationUrl" in value) || typeof value.activationUrl !== "string") return null;
    if (!("credentials" in value) || !Array.isArray(value.credentials)) return null;
    if (!("modelSummary" in value) || !isModelSummary(value.modelSummary)) return null;
    const credentials = value.credentials.filter(isCredential);
    if (credentials.length !== value.credentials.length || credentials.length === 0) return null;
    return {
      activationUrl: value.activationUrl,
      credentials,
      modelSummary: value.modelSummary,
      state,
    };
  }
  if (state === "inactive") {
    if (!("activationUrl" in value) || typeof value.activationUrl !== "string") return null;
    return { activationUrl: value.activationUrl, state };
  }
  if (
    state === "anonymous" ||
    state === "reauthorization-required" ||
    state === "temporary-error" ||
    state === "unavailable"
  ) {
    return { state };
  }
  return null;
}

function isCredential(value: unknown): value is EggAiApiCredential {
  if (!value || typeof value !== "object") return false;
  return (
    "baseUrl" in value &&
    typeof value.baseUrl === "string" &&
    "group" in value &&
    typeof value.group === "string" &&
    "id" in value &&
    typeof value.id === "string" &&
    "key" in value &&
    typeof value.key === "string" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

function isModelSummary(value: unknown): value is EggAiModelSummary {
  if (!value || typeof value !== "object") return false;
  return (
    "availableCount" in value &&
    typeof value.availableCount === "number" &&
    "names" in value &&
    Array.isArray(value.names) &&
    value.names.every((name) => typeof name === "string")
  );
}
