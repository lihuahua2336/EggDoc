import { expect, test } from "@playwright/test";

test("the application exposes a portable dynamic server route", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
  expect(response.headers()["cache-control"]).toBe("no-store");
});
