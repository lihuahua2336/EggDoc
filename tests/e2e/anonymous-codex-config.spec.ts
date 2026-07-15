import { expect, test } from "@playwright/test";

test("an anonymous Reader can use safe public Codex configuration", async ({ context, page }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: "Codex 匿名配置" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true })).toBeVisible();
  await expect(panel.getByText("这不是可用密钥", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("EggAi Base URL")).toHaveValue("https://api.eggai.icu/v1");
  await expect(panel.getByLabel("Codex 默认语言")).toHaveValue("zh-cn");

  await panel.getByRole("button", { name: "复制完整 Shell 命令" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/codex.sh' | sh -s -- --sk-key 'sk-EGGDOC-EXAMPLE-REPLACE-ME' --baseurl 'https://api.eggai.icu/v1' --language 'zh-cn'",
  );
  await expect(panel.getByRole("button", { name: "完整 Shell 命令已复制" })).toBeVisible();

  await panel.getByRole("button", { name: "复制 PowerShell 示例" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    '$env:SK_KEY = "sk-EGGDOC-EXAMPLE-REPLACE-ME"; $env:BASE_URL = "https://api.eggai.icu/v1"; $env:LANGUAGE = "zh-cn"; irm https://eggdoc.pages.dev/install/codex.ps1 | iex',
  );
  await expect(panel.getByRole("button", { name: "PowerShell 示例已复制" })).toBeVisible();

  await panel.getByRole("button", { name: "复制 Base URL" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "https://api.eggai.icu/v1",
  );
  await expect(panel.getByRole("button", { name: "Base URL 已复制" })).toBeVisible();
});
