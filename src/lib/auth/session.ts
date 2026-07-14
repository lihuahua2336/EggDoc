import type { AstroCookies } from "astro";

export const SESSION_COOKIE_NAME = "eggdoc_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const AUTHORIZATION_PENDING_MAX_AGE_SECONDS = 10 * 60;

export type PendingAuthorization = {
  codeVerifier: string;
  createdAt: number;
  nonce: string;
  returnTo: string;
  state: string;
};

export type EggDocIdentity = {
  email?: string;
  name: string;
  picture?: string;
  subject: string;
};

export type EggDocAuthorization = {
  accessToken: string;
  accessTokenExpiresAt: number;
  identity: EggDocIdentity;
  refreshToken: string;
};

export type EggDocSession = {
  authorization?: EggDocAuthorization;
  expiresAt: number;
  issuedAt: number;
  pending?: PendingAuthorization;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const additionalData = encoder.encode("EggDoc Session v1");

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getEncryptionKey(secret: string) {
  const keyBytes = decodeBase64Url(secret);
  if (keyBytes.byteLength !== 32) {
    throw new Error("EggDoc Session configuration is unavailable");
  }

  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function sealSession(session: EggDocSession, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await getEncryptionKey(secret),
    encoder.encode(JSON.stringify(session)),
  );
  const sealed = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  sealed.set(iv);
  sealed.set(new Uint8Array(ciphertext), iv.byteLength);
  return `v1.${encodeBase64Url(sealed)}`;
}

export async function unsealSession(
  value: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<EggDocSession | null> {
  if (!value.startsWith("v1.")) return null;

  try {
    const sealed = decodeBase64Url(value.slice(3));
    if (sealed.byteLength <= 12) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.slice(0, 12), additionalData },
      await getEncryptionKey(secret),
      sealed.slice(12),
    );
    const session = JSON.parse(decoder.decode(plaintext)) as EggDocSession;
    if (
      !Number.isInteger(session.issuedAt) ||
      !Number.isInteger(session.expiresAt) ||
      session.issuedAt > now ||
      session.expiresAt <= now ||
      session.expiresAt - session.issuedAt > SESSION_MAX_AGE_SECONDS
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function createSession(now = Math.floor(Date.now() / 1000)): EggDocSession {
  return {
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS,
  };
}

export function getSessionCookieOptions(requestUrl: URL) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: requestUrl.protocol === "https:",
  };
}

export async function readSession(cookies: AstroCookies, secret: string) {
  const cookie = cookies.get(SESSION_COOKIE_NAME)?.value;
  return cookie ? unsealSession(cookie, secret) : null;
}

export async function writeSession(
  cookies: AstroCookies,
  requestUrl: URL,
  session: EggDocSession,
  secret: string,
) {
  const now = Math.floor(Date.now() / 1000);
  cookies.set(SESSION_COOKIE_NAME, await sealSession(session, secret), {
    ...getSessionCookieOptions(requestUrl),
    maxAge: Math.max(0, Math.min(session.expiresAt - now, SESSION_MAX_AGE_SECONDS)),
  });
}

export function clearSession(cookies: AstroCookies, requestUrl: URL) {
  cookies.delete(SESSION_COOKIE_NAME, getSessionCookieOptions(requestUrl));
}
