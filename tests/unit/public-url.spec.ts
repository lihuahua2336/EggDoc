import { expect, test } from "@playwright/test";

import {
  isAllowedPublicSiteUrl,
  toPublicRequestUrl,
} from "../../src/lib/auth/public-url";

test("the public site origin requires HTTPS except on explicit loopback hosts", () => {
  expect(isAllowedPublicSiteUrl(new URL("https://docs.example.com"))).toBe(true);
  expect(isAllowedPublicSiteUrl(new URL("http://localhost:4321"))).toBe(true);
  expect(isAllowedPublicSiteUrl(new URL("http://127.0.0.1:4321"))).toBe(true);
  expect(isAllowedPublicSiteUrl(new URL("http://[::1]:4321"))).toBe(true);
  expect(isAllowedPublicSiteUrl(new URL("http://docs.example.com"))).toBe(false);
  expect(isAllowedPublicSiteUrl(new URL("ftp://docs.example.com"))).toBe(false);
});

test("the public site origin replaces a container request origin without changing callback data", () => {
  const requestUrl = new URL(
    "http://127.0.0.1:4321/auth/callback?code=authorization-code&state=expected-state",
  );

  expect(toPublicRequestUrl(requestUrl, new URL("https://docs.example.com"))).toEqual(
    new URL(
      "https://docs.example.com/auth/callback?code=authorization-code&state=expected-state",
    ),
  );
});
