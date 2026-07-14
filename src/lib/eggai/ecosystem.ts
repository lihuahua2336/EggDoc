export type EggAiApiAccountResult =
  | { kind: "active" }
  | { kind: "inactive" }
  | { kind: "authorization-expired" }
  | { kind: "temporary-error" };

type EcosystemEnvelope = {
  data?: unknown;
  success?: boolean;
};

export async function getEggAiApiAccount(
  ecosystemUrl: URL,
  accessToken: string,
): Promise<EggAiApiAccountResult> {
  let response: Response;
  try {
    response = await fetch(new URL("/api/ecosystem/me", ecosystemUrl), {
      cache: "no-store",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return { kind: "temporary-error" };
  }

  if (response.status === 404) return { kind: "inactive" };
  if (response.status === 401 || response.status === 403) {
    return { kind: "authorization-expired" };
  }
  if (!response.ok) return { kind: "temporary-error" };

  const payload = (await response.json().catch(() => null)) as EcosystemEnvelope | null;
  if (!payload || payload.success === false) {
    return { kind: "temporary-error" };
  }
  return { kind: "active" };
}
