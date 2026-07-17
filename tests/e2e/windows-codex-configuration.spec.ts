import { expect, test, type Page } from "@playwright/test";

async function emulateWindows(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => "Win32" });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "Windows" }),
    });
  });
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
});

test("a Windows browser starts with the provider-neutral PowerShell command", async ({ page }) => {
  await emulateWindows(page);
  await page.goto("/eggai/codex-installer/");
  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByRole("button", { name: "Windows" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "irm 'https://eggdoc.pages.dev/install/codex.ps1' | iex",
  );
});

test("an anonymous Reader must sign in before copying the EggAi PowerShell command", async ({ page }) => {
  await emulateWindows(page);
  await page.goto("/eggai/codex-installer/");
  const panel = page.getByRole("region", { name: "Codex 安装" });
  await panel.getByRole("tab", { name: "EggAi 配置" }).click();
  await expect(panel.getByRole("button", { name: "登录 EggAi 后复制" })).toBeDisabled();
});
