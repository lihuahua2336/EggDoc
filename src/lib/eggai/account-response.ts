export type EggAiApiAccountResponse =
  | { activationUrl: string; state: "active" | "inactive" }
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
  if (state === "active" || state === "inactive") {
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
