import { expect, test, type Page } from "@playwright/test";

const FIXTURE_KEY = "sk-EGGDOC-SINGLE-FIXTURE-ONLY";

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.locator("form").getByRole("button").first().click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => "Linux" });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "Linux" }),
    });
  });
});

test("the default Shell action does not configure a third-party provider", async ({ page }) => {
  await page.goto("/eggai/codex-installer/");
  const panel = page.getByRole("region", { name: "Codex 安装" });
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(panel.getByRole("button", { name: "安装命令已复制" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/codex.sh' | sh",
  );

});

test("an authenticated Reader can copy a one-step EggAi Shell command", async ({ page }) => {
  await signInFromTutorial(page);
  const panel = page.getByRole("region", { name: "Codex 安装" });
  await panel.getByRole("tab", { name: "EggAi 配置" }).click();
  await expect(panel.getByLabel("EggAi 配置分组")).toHaveValue("101");
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(panel.getByRole("button", { name: "安装命令已复制" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/codex.sh' | sh -s -- " +
      `--eggai --sk-key '${FIXTURE_KEY}' --baseurl 'https://api.fixture.eggai.test/v1' --language 'zh-cn'`,
  );

  await panel.getByText("分别复制配置", { exact: true }).click();
  await panel.getByRole("button", { name: "复制 API Key" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(FIXTURE_KEY);
  await panel.getByRole("button", { name: "复制 config.toml" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
    'model_provider = "eggai"',
  );
});

test("Shell installation controls stay inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/eggai/codex-installer/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
