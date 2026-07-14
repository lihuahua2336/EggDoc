const FALLBACK_RETURN_TO = "/";

export function validateReturnTo(value: string | null, origin: string): string {
  if (!value || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return FALLBACK_RETURN_TO;
  }

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || !url.pathname.startsWith("/")) {
      return FALLBACK_RETURN_TO;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return FALLBACK_RETURN_TO;
  }
}

export function addAuthError(returnTo: string, error: "cancelled" | "failed" | "unavailable") {
  const url = new URL(returnTo, "https://eggdoc.invalid");
  url.searchParams.set("auth_error", error);
  return `${url.pathname}${url.search}${url.hash}`;
}
