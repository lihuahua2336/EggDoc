import { expect, test } from "@playwright/test";

import {
  SESSION_MAX_AGE_SECONDS,
  createSession,
  getSessionCookieOptions,
  sealSession,
  unsealSession,
} from "../../src/lib/auth/session";

const TEST_SESSION_SECRET = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY";

test("an EggDoc Session round trip expires at the seven-day server boundary", async () => {
  const issuedAt = 1_800_000_000;
  const session = createSession(issuedAt);
  const encrypted = await sealSession(session, TEST_SESSION_SECRET);

  expect(encrypted).not.toContain(String(issuedAt));
  await expect(
    unsealSession(encrypted, TEST_SESSION_SECRET, issuedAt + SESSION_MAX_AGE_SECONDS - 1),
  ).resolves.toEqual(session);
  await expect(
    unsealSession(encrypted, TEST_SESSION_SECRET, issuedAt + SESSION_MAX_AGE_SECONDS),
  ).resolves.toBeNull();
});

test("production EggDoc Session cookie options require HTTPS transport", () => {
  expect(getSessionCookieOptions(new URL("https://eggdoc.example/"))).toEqual({
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  expect(getSessionCookieOptions(new URL("http://127.0.0.1:4322/"))).toMatchObject({
    secure: false,
  });
});
