import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

async function setEcosystemMode(request: APIRequestContext, mode: string) {
  await request.post(`http://127.0.0.1:4323/control/ecosystem?mode=${mode}`);
}

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
  await page.getByRole("tab", { name: "EggAi 配置" }).click();
}

test.afterEach(async ({ request }) => {
  await setEcosystemMode(request, "active");
});

test("an EggAi Account without an API Account can activate from the install panel", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "inactive");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByText("先激活 EggAi API Account，再返回一键配置。")).toBeVisible();
  const activation = panel.getByRole("link", { name: "激活 EggAi" });
  await expect(activation).toHaveAttribute("href", "https://api.eggai.icu/");
  await expect(activation).toHaveAttribute("target", "_blank");
});

test("an active EggAi API Account exposes a ready default configuration group", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "active");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByLabel("EggAi 配置分组")).toHaveValue("101");
  await expect(panel.getByText("模型 gpt-5.2", { exact: true })).toBeVisible();
  await expect(page.getByText("fixture-new-api-account")).toHaveCount(0);
});

test("expired ecosystem authorization becomes a reauthorization action", async ({
  page,
  request,
}) => {
  await signInFromTutorial(page);
  await setEcosystemMode(request, "authorization-expired");
  await page.reload();
  await page.getByRole("tab", { name: "EggAi 配置" }).click();

  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByRole("link", { name: "重新授权 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config&reauthorize=1",
  );
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
});

test("a temporary ecosystem outage stays inside the panel and can be retried", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "retry");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByText("暂时无法读取 EggAi 配置")).toBeVisible();
  await expect(page.getByText("fixture upstream deployment detail")).toHaveCount(0);
  await panel.getByRole("button", { name: "重试" }).click();
  await expect(panel.getByLabel("EggAi 配置分组")).toHaveValue("101");
});

test("returning from activation triggers one bounded automatic recheck", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "inactive");
  await signInFromTutorial(page);

  const activation = page.getByRole("link", { name: "激活 EggAi" });
  await activation.evaluate((element) => {
    element.addEventListener("click", (event) => event.preventDefault(), { once: true });
  });
  await activation.click();
  await setEcosystemMode(request, "active");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("EggAi 配置分组")).toHaveValue("101");

  const stats = await request
    .get("http://127.0.0.1:4323/control/ecosystem")
    .then((response) => response.json());
  expect(stats.accountRequestCount).toBe(1);
});
