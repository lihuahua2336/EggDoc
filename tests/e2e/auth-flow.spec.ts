import { expect, test } from "@playwright/test";

test("an anonymous Reader starts a PKCE EggAi login with a safe source page", async ({ request }) => {
  const response = await request.get(
    "/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const location = new URL(response.headers().location);
  expect(location.origin).toBe("http://127.0.0.1:4323");
  expect(location.pathname).toBe("/oidc/auth");
  expect(location.searchParams.get("client_id")).toBe("eggdoc-test-client");
  expect(location.searchParams.get("response_type")).toBe("code");
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  expect(location.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(location.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  expect(location.searchParams.get("nonce")).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  expect(location.searchParams.get("resource")).toBe("https://api.eggai.icu/api");
  expect(location.searchParams.get("scope")).toContain("openid");
  expect(location.searchParams.get("scope")).toContain("offline_access");
  expect(location.searchParams.get("scope")).toContain("ecosystem:me");
  expect(location.searchParams.get("scope")).toContain("ecosystem:models:read");
  expect(location.searchParams.get("scope")).toContain("ecosystem:tokens:read");
  expect(location.searchParams.get("prompt")).toBe("consent");

  const cookie = response.headers()["set-cookie"];
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Max-Age=604800");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).not.toContain("codex-installer");
  expect(cookie).not.toContain(location.searchParams.get("state"));
});

test("an unsafe source page is replaced with the public home page", async ({ request }) => {
  const response = await request.get(
    "/auth/login?returnTo=https%3A%2F%2Fevil.example%2Fsteal",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(302);
  const location = new URL(response.headers().location);
  expect(location.origin).toBe("http://127.0.0.1:4323");
});

test("EggAi login returns a Reader to the source tutorial anchor", async ({ page }) => {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await expect(page.getByRole("heading", { name: "EggAi 测试登录" })).toBeVisible();

  await page.getByRole("button", { name: "继续登录" }).click();

  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
  expect(new URL(page.url()).hash).toBe("#codex-config");
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();
  await expect(page.getByText("测试读者", { exact: true })).toBeVisible();
});

test("EggAi cancellation returns to public content with a local error", async ({ page }) => {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.getByRole("button", { name: "取消登录" }).click();

  const returnedUrl = new URL(page.url());
  expect(returnedUrl.pathname).toBe("/eggai/codex-installer/");
  expect(returnedUrl.searchParams.get("auth_error")).toBe("cancelled");
  expect(returnedUrl.hash).toBe("#codex-config");
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("登录已取消");
  await expect(page.getByText("fixture cancellation details")).toHaveCount(0);
});

test("an EggAi failure returns to public content without upstream details", async ({ page }) => {
  await page.goto("/auth/login?returnTo=%2Fnotes%2F");
  await page.getByRole("button", { name: "模拟登录失败" }).click();

  await expect(page).toHaveURL(/\/notes\/\?auth_error=failed$/);
  await expect(page.getByRole("status")).toContainText("登录未完成");
  await expect(page.getByText("fixture sensitive failure details")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "工具与概念" })).toBeVisible();
});

test("header and tutorial login actions preserve their public source pages", async ({ page }) => {
  await page.goto("/notes/");
  await expect(page.getByRole("link", { name: "登录 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Fnotes%2F",
  );
  await page.getByRole("link", { name: "登录 EggAi" }).click();
  await expect(page.getByRole("heading", { name: "EggAi 测试登录" })).toBeVisible();

  await page.goto("/eggai/codex-installer/");
  const panel = page.getByRole("region", { name: "Codex 匿名配置" });
  await expect(panel.getByRole("link", { name: "登录 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config",
  );
  await panel.getByRole("link", { name: "登录 EggAi" }).click();
  await expect(page.getByRole("heading", { name: "EggAi 测试登录" })).toBeVisible();
});

test("the encrypted EggDoc Session refreshes authorization and exposes only current identity", async ({
  context,
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4323/control/reset");
  await page.goto("/auth/login?returnTo=%2Fnotes%2F");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4322/notes/");

  const sessionCookie = (await context.cookies()).find((cookie) => cookie.name === "eggdoc_session");
  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.httpOnly).toBe(true);
  expect(sessionCookie?.sameSite).toBe("Lax");
  expect(sessionCookie?.value).not.toContain("测试读者");
  expect(sessionCookie?.value).not.toContain("fixture-access-token");
  expect(sessionCookie?.expires).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 7 * 86400 + 1);

  const currentUser = await page.request.get("/api/auth/user");
  expect(currentUser.status()).toBe(200);
  expect(currentUser.headers()["cache-control"]).toBe("private, no-store");
  await expect(currentUser.json()).resolves.toEqual({
    authenticated: true,
    eggAiPlatformUrl: "https://api.eggai.icu/",
    identity: {
      email: "reader@example.test",
      name: "测试读者",
      picture: "https://images.example.test/reader.png",
      subject: "eggai-reader-123",
    },
  });
  await expect(
    request.get("http://127.0.0.1:4323/control/stats").then((response) => response.json()),
  ).resolves.toEqual({ globalLogoutCount: 0, refreshGrantCount: 1 });
});

test("a missing or tampered EggDoc Session remains anonymous", async ({ context, page }) => {
  const anonymous = await page.request.get("/api/auth/user");
  await expect(anonymous.json()).resolves.toEqual({ authenticated: false });

  await context.addCookies([
    {
      domain: "127.0.0.1",
      httpOnly: true,
      name: "eggdoc_session",
      path: "/",
      sameSite: "Lax",
      secure: false,
      value: "v1.tampered-session",
    },
  ]);
  const tampered = await page.request.get("/api/auth/user");
  expect(tampered.status()).toBe(200);
  await expect(tampered.json()).resolves.toEqual({ authenticated: false });
  expect((await context.cookies()).find((cookie) => cookie.name === "eggdoc_session")).toBeUndefined();
});

test("a Reader can reauthorize and exit only EggDoc", async ({ context, page, request }) => {
  await request.post("http://127.0.0.1:4323/control/reset");
  await page.goto("/auth/login?returnTo=%2Fnotes%2F");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page.getByText("测试读者", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "重新授权 EggAi" }).click();
  expect(new URL(page.url()).searchParams.get("prompt")).toBe("consent");
  await page.getByRole("button", { name: "取消登录" }).click();
  await expect(page).toHaveURL(/\/notes\/\?auth_error=cancelled$/);
  await expect(page.getByText("测试读者", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "退出 EggDoc" }).click();
  await expect(page.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
  expect((await context.cookies()).find((cookie) => cookie.name === "eggdoc_session")).toBeUndefined();
  const stats = await request
    .get("http://127.0.0.1:4323/control/stats")
    .then((response) => response.json());
  expect(stats.globalLogoutCount).toBe(0);
});
