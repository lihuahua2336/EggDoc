import { expect, test } from "@playwright/test";

test("an anonymous Reader gets a provider-neutral install command by default", async ({
  context,
  page,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { configurable: true, get: () => "Linux" });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "Linux" }),
    });
  });
  await page.goto("/eggai/codex-installer/");

  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByRole("tab", { name: "默认安装" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(panel.getByRole("button", { name: "安装命令已复制" })).toBeVisible();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/codex.sh' | sh",
  );

  await panel.getByRole("tab", { name: "EggAi 配置" }).click();
  await expect(panel.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "登录 EggAi 后复制" })).toBeDisabled();
});
