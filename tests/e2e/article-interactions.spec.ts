import { expect, test } from "@playwright/test";

const articleWidths = [320, 1280] as const;

for (const width of articleWidths) {
  test(`a Reader can copy a Claude Code install command at ${width}px`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/eggai/claude-code-install/");
    await page
      .locator('astro-island[component-export="EggAiClaudeCodeConfig"]:not([ssr])')
      .waitFor();

    const panel = page.getByRole("region", { name: "Claude Code 安装" });
    const copyButton = panel.getByRole("button", { name: "复制安装命令" });
    await copyButton.click();

    await expect(panel.getByRole("button", { name: "安装命令已复制" })).toBeVisible();
    await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
      "eggdoc.pages.dev/install/claude-code.",
    );
  });

  test(`a Reader is told when copying an install command fails at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await page.goto("/eggai/claude-code-install/");
    await page
      .locator('astro-island[component-export="EggAiClaudeCodeConfig"]:not([ssr])')
      .waitFor();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => Promise.reject(new Error("Simulated failure")) },
      });
    });

    const panel = page.getByRole("region", { name: "Claude Code 安装" });
    const copyButton = panel.getByRole("button", { name: "复制安装命令" });
    await copyButton.click();
    await expect(panel.getByRole("status")).toHaveText("复制失败，请手动选择命令。");
  });

  test(`the tool tutorials fit ${width}px text layouts`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    for (const route of [
      "/eggai/codex-installer/",
      "/eggai/codex-eggai-configuration/",
      "/eggai/claude-code-install/",
      "/eggai/claude-code-eggai-configuration/",
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        ),
      ).toBe(true);
    }
  });
}

for (const continuation of [
  {
    configurationRoute: "/eggai/codex-eggai-configuration/",
    installRoute: "/eggai/codex-installer/",
    product: "Codex",
  },
  {
    configurationRoute: "/eggai/claude-code-eggai-configuration/",
    installRoute: "/eggai/claude-code-install/",
    product: "Claude Code",
  },
] as const) {
  test(`a Reader can continue from ${continuation.product} installation to its EggAi configuration explanation`, async ({
    page,
  }) => {
    await page.goto(continuation.installRoute);
    await page
      .getByRole("link", { name: `查看 ${continuation.product} EggAi 配置说明` })
      .click();

    await expect(page).toHaveURL(new RegExp(`${continuation.configurationRoute}$`));
    await expect(
      page.getByRole("heading", {
        name: `${continuation.product} EggAi 配置说明`,
        level: 1,
      }),
    ).toBeVisible();
  });
}
