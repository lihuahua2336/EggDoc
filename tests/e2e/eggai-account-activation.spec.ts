import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function setEcosystemMode(request: APIRequestContext, mode: string) {
  await request.post(`http://127.0.0.1:4323/control/ecosystem?mode=${mode}`);
}

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
}

async function signInFromNotes(page: Page) {
  await page.goto("/auth/login?returnTo=%2Fnotes%2F");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:4322/notes/");
}

test.afterEach(async ({ request }) => {
  await setEcosystemMode(request, "active");
});

test("an EggAi Account without an API Account can activate without leaving the tutorial", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "inactive");
  await signInFromTutorial(page);

  const account = await page.request.get("/api/eggai/account");
  expect(account.status()).toBe(200);
  expect(account.headers()["cache-control"]).toBe("private, no-store");
  await expect(account.json()).resolves.toEqual({
    activationUrl: "https://api.eggai.icu/",
    state: "inactive",
  });

  const panel = page.getByRole("region", { name: "Codex 配置" });
  await expect(panel.getByText("尚未激活 EggAi API Account")).toBeVisible();
  const activation = panel.getByRole("link", { name: "激活 EggAi API Account" });
  await expect(activation).toHaveAttribute("href", "https://api.eggai.icu/");
  await expect(activation).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();

  await setEcosystemMode(request, "active");
  await panel.getByRole("button", { name: "重新检查" }).click();
  await expect(panel.getByText("EggAi API Account 已激活")).toBeVisible();
});

test("an active EggAi API Account is adapted without exposing the ecosystem response", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "active");
  await signInFromTutorial(page);

  const account = await page.request.get("/api/eggai/account");
  expect(account.status()).toBe(200);
  await expect(account.json()).resolves.toEqual(expect.objectContaining({
    activationUrl: "https://api.eggai.icu/",
    state: "active",
  }));
  await expect(page.getByText("EggAi API Account 已激活")).toBeVisible();
  await expect(page.getByText("fixture-new-api-account")).toHaveCount(0);
});

test("expired ecosystem authorization becomes a local reauthorization state", async ({
  context,
  page,
  request,
}) => {
  await signInFromNotes(page);
  await setEcosystemMode(request, "authorization-expired");

  const account = await page.request.get("/api/eggai/account");
  expect(account.status()).toBe(401);
  await expect(account.json()).resolves.toEqual({ state: "reauthorization-required" });
  expect((await context.cookies()).find((cookie) => cookie.name === "eggdoc_session")).toBeUndefined();

  await signInFromTutorial(page);
  const panel = page.getByRole("region", { name: "Codex 匿名配置" });
  await expect(panel.getByText("EggAi 授权已过期")).toBeVisible();
  await expect(panel.getByRole("link", { name: "重新授权 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config&reauthorize=1",
  );
  await panel.getByText("配置详情", { exact: true }).click();
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
  await expect(page.getByText("fixture upstream authorization detail")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();
});

test("a temporary ecosystem outage stays inside the panel and can be retried", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "retry");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: "Codex 配置" });
  await expect(panel.getByText("暂时无法检查 EggAi API Account")).toBeVisible();
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
  await expect(page.getByText("fixture upstream deployment detail")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "用脚本把 Codex 接入 EggAi" })).toBeVisible();

  await panel.getByRole("button", { name: "重试" }).click();
  await expect(panel.getByText("EggAi API Account 已激活")).toBeVisible();
});

test("returning from activation triggers one bounded automatic recheck", async ({ page, request }) => {
  await setEcosystemMode(request, "inactive");
  await signInFromTutorial(page);

  const activation = page.getByRole("link", { name: "激活 EggAi API Account" });
  await activation.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await activation.click();
  await setEcosystemMode(request, "active");

  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("EggAi API Account 已激活")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));

  const stats = await request
    .get("http://127.0.0.1:4323/control/ecosystem")
    .then((response) => response.json());
  expect(stats.accountRequestCount).toBe(1);
});

test("an unavailable ecosystem response is contained and stripped of upstream details", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "unavailable");
  await signInFromTutorial(page);

  const account = await page.request.get("/api/eggai/account");
  expect(account.status()).toBe(502);
  await expect(account.json()).resolves.toEqual({ state: "temporary-error" });
  const panel = page.getByRole("region", { name: "Codex 配置" });
  await expect(panel.getByText("暂时无法检查 EggAi API Account")).toBeVisible();
  await expect(panel.getByRole("button", { name: "重试" })).toBeVisible();
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
  await expect(page.getByText("fixture upstream deployment detail")).toHaveCount(0);
});

test("a server configuration failure has a distinct generic unavailable state", async ({ page }) => {
  await page.route("**/api/eggai/account", (route) =>
    route.fulfill({
      body: JSON.stringify({ state: "unavailable" }),
      contentType: "application/json",
      status: 503,
    }),
  );
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: "Codex 配置" });
  await expect(panel.getByText("EggAi 配置服务暂不可用")).toBeVisible();
  await expect(panel.getByRole("button", { name: "重试" })).toBeVisible();
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
});
