import { expect, test, type Page } from "@playwright/test";

const FIXTURE_KEY = "sk-EGGDOC-SINGLE-FIXTURE-ONLY";
const FIXTURE_BASE_URL = "https://api.fixture.eggai.test/v1";

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.locator("form").getByRole("button").first().click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
}

async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      get: () => "Linux x86_64",
    });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "Linux" }),
    });
  });
});

test("a Reader sees one primary Shell copy action before configuration details", async ({ page }) => {
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByRole("heading", { name: "一键配置" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "复制一键配置命令" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "复制 API Key" })).toBeHidden();
  await expect(panel.getByRole("button", { name: "复制 Base URL" })).toBeHidden();
  await expect(panel.getByRole("button", { name: "复制 config.toml" })).toBeHidden();

  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  await expect(readClipboard(page)).resolves.toContain("/install/codex.sh");
});

test("an authenticated Reader can copy each Shell configuration value explicitly", async ({
  page,
}) => {
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByText(/剪贴板/)).toBeVisible();
  await expect(panel.getByText(/shell history/i)).toBeVisible();
  await expect(
    panel.locator("pre").filter({ hasText: "sk-REDACTED-EXPLICIT-COPY-ONLY" }),
  ).toBeVisible();
  await panel.getByText("配置详情", { exact: true }).click();

  await panel.getByRole("button", { name: "复制 API Key" }).click();
  await expect(readClipboard(page)).resolves.toBe(FIXTURE_KEY);

  await panel.getByRole("button", { name: "复制 Base URL" }).click();
  await expect(readClipboard(page)).resolves.toBe(FIXTURE_BASE_URL);

  await panel.getByRole("button", { name: "复制 config.toml" }).click();
  const config = await readClipboard(page);
  expect(config).toContain('model_provider = "eggai"');
  expect(config).toContain(`base_url = "${FIXTURE_BASE_URL}"`);
  expect(config).toContain("请默认使用简体中文回答");
  expect(config).not.toContain(FIXTURE_KEY);

  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  await expect(readClipboard(page)).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/codex.sh' | sh -s -- " +
      `--sk-key '${FIXTURE_KEY}' --baseurl '${FIXTURE_BASE_URL}' --language 'zh-cn'`,
  );
  await expect(panel.getByRole("button", { name: "一键配置命令已复制" })).toBeVisible();

  await panel.getByLabel("Codex 默认语言").selectOption("en-us");
  await expect(panel.getByRole("button", { name: "复制一键配置命令" })).toBeVisible();
  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  await expect(readClipboard(page)).resolves.toContain("--language 'en-us'");
});

test("an anonymous Reader can choose and remember English without storing generated secrets", async ({
  page,
}) => {
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: /^Codex / });
  await panel.getByText("配置详情", { exact: true }).click();
  await expect(
    panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true }),
  ).toBeVisible();
  await expect(panel.getByLabel("Codex 默认语言")).toHaveValue("zh-cn");

  await panel.getByRole("button", { name: "复制 API Key" }).click();
  await expect(readClipboard(page)).resolves.toBe("sk-EGGDOC-EXAMPLE-REPLACE-ME");

  await panel.getByLabel("Codex 默认语言").selectOption("en-us");
  await panel.getByRole("button", { name: "复制 config.toml" }).click();
  expect(await readClipboard(page)).toContain("Respond in English by default");

  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  const command = await readClipboard(page);
  expect(command).toContain("--language 'en-us'");
  expect(command).toContain("--sk-key 'sk-EGGDOC-EXAMPLE-REPLACE-ME'");

  expect(
    await page.evaluate(() => localStorage.getItem("eggdoc:codex-language")),
  ).toBe("en-us");
  const persistentValues = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(persistentValues).not.toContain("sk-EGGDOC");
  expect(persistentValues).not.toContain("curl -fsSL");

  await page.reload();
  await expect(page.getByLabel("Codex 默认语言")).toHaveValue("en-us");
});

test("Shell configuration stays inside the panel on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/eggai/codex-installer/");

  const layout = await page.locator("#codex-config details > div").evaluate((grid) => {
    const gridRect = grid.getBoundingClientRect();
    return Array.from(grid.children).map((child) => {
      const rect = child.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        withinGrid:
          rect.left >= gridRect.left - 1 &&
          rect.right <= gridRect.right + 1 &&
          rect.width <= gridRect.width + 1,
      };
    });
  });

  expect(layout.every((item) => item.withinGrid), JSON.stringify(layout, null, 2)).toBe(true);
});
