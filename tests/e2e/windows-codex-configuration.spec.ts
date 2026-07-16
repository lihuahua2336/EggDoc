import { expect, test, type Page } from "@playwright/test";

const FIXTURE_KEY = "sk-EGGDOC-SINGLE-FIXTURE-ONLY";
const FIXTURE_BASE_URL = "https://api.fixture.eggai.test/v1";

async function emulatePlatform(page: Page, platform: "Linux" | "Windows") {
  await page.addInitScript((detectedPlatform) => {
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      get: () => (detectedPlatform === "Windows" ? "Win32" : "Linux x86_64"),
    });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: detectedPlatform }),
    });
  }, platform);
}

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.locator("form").getByRole("button").first().click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("a Windows browser starts with the complete anonymous PowerShell command", async ({
  page,
}) => {
  await emulatePlatform(page, "Windows");
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: /^Codex / });
  const platforms = panel.getByRole("group", { name: "操作系统" });
  await expect(platforms.getByRole("button", { name: "Windows" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "/install/codex.ps1",
  );

  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "$env:SK_KEY = 'sk-EGGDOC-EXAMPLE-REPLACE-ME'; " +
      "$env:BASE_URL = 'https://api.eggai.icu/v1'; " +
      "$env:LANGUAGE = 'zh-cn'; " +
      "irm 'https://eggdoc.pages.dev/install/codex.ps1' | iex",
  );
  await expect(panel.getByRole("button", { name: "一键配置命令已复制" })).toBeVisible();
});

test("a Linux browser starts with Shell without persisting automatic detection", async ({
  page,
}) => {
  await emulatePlatform(page, "Linux");
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByRole("button", { name: "macOS / Linux" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(panel.getByTestId("codex-quick-command")).toContainText("/install/codex.sh");
  await expect(
    page.evaluate(() => localStorage.getItem("eggdoc:codex-platform")),
  ).resolves.toBeNull();
});

test("a Reader can override Windows detection and remember only the platform preference", async ({
  page,
}) => {
  await emulatePlatform(page, "Windows");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: /^Codex / });
  await panel.getByText("配置详情", { exact: true }).click();
  await panel.getByLabel("Codex 默认语言").selectOption("en-us");
  await panel.getByRole("button", { name: "复制一键配置命令" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    `$env:SK_KEY = '${FIXTURE_KEY}'; ` +
      `$env:BASE_URL = '${FIXTURE_BASE_URL}'; ` +
      "$env:LANGUAGE = 'en-us'; " +
      "irm 'https://eggdoc.pages.dev/install/codex.ps1' | iex",
  );

  await panel.getByRole("button", { name: "macOS / Linux" }).click();
  await expect(panel.getByRole("button", { name: "复制一键配置命令" })).toBeVisible();
  await expect(panel.getByTestId("codex-quick-command")).toContainText("/install/codex.sh");
  expect(await page.evaluate(() => localStorage.getItem("eggdoc:codex-platform"))).toBe(
    "unix",
  );
  const persistentValues = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(persistentValues).not.toContain(FIXTURE_KEY);
  expect(persistentValues).not.toContain("irm ");
  expect(persistentValues).not.toContain("curl -fsSL");

  await page.reload();
  const restoredPlatforms = page
    .getByRole("region", { name: /^Codex / })
    .getByRole("group", { name: "操作系统" });
  await expect(
    restoredPlatforms.getByRole("button", { name: "macOS / Linux" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("codex-quick-command")).toContainText("/install/codex.sh");
});
