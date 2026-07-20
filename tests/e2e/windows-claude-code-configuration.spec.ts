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

test("a Windows browser shows a one-line Claude Code PowerShell command", async ({ page }) => {
  await emulateWindows(page);
  await page.goto("/eggai/claude-code-install/");
  const panel = page.getByRole("region", { name: "Claude Code 安装" });

  await expect(panel.getByRole("button", { name: "Windows" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  const copiedCommand = page.evaluate(() => navigator.clipboard.readText());
  await expect(copiedCommand).resolves.toContain(
    "Invoke-RestMethod -UseBasicParsing -Uri 'https://doc.eggai.icu/install/claude-code.ps1'",
  );
  await expect(copiedCommand).resolves.toContain("[scriptblock]::Create");

  const command = panel.getByTestId("claude-code-quick-command");
  await expect(panel.getByText("PowerShell", { exact: true })).toBeVisible();
  await expect(command).toHaveCSS("overflow-x", "auto");
  await expect(command.locator("code")).toHaveCSS("white-space", "nowrap");
});
