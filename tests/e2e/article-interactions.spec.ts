import { expect, test } from "@playwright/test";

const articleWidths = [320, 1280] as const;

for (const width of articleWidths) {
  test(`a Reader can copy an install command code block at ${width}px`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/eggai/claude-code-install/");

    const firstCodeBlock = page.locator(".prose pre").first();
    const copyButton = firstCodeBlock.locator("button.code-copy-button");
    await expect(copyButton).toHaveAccessibleName("复制代码");
    await copyButton.click();

    await expect(copyButton).toHaveAccessibleName("代码已复制");
    await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain(
      "eggdoc.pages.dev/install/claude-code.sh",
    );
  });

  test(`a Reader is told when copying an install command fails at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => Promise.reject(new Error("Simulated failure")) },
      });
    });
    await page.goto("/eggai/claude-code-install/");

    const copyButton = page.locator(".prose pre").first().locator("button.code-copy-button");
    await copyButton.click();
    await expect(copyButton).toHaveAccessibleName("复制失败");
    await expect(page.locator("[data-code-copy-status]")).toHaveText(
      "复制代码失败，请手动选择代码。",
    );
  });

  test(`the tool tutorials fit ${width}px text layouts`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    for (const route of [
      "/eggai/codex-installer/",
      "/eggai/codex-eggai-configuration/",
      "/eggai/claude-code-install/",
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

test("a Reader can continue from Codex installation to its EggAi configuration explanation", async ({
  page,
}) => {
  await page.goto("/eggai/codex-installer/");
  await page.getByRole("link", { name: "查看 Codex EggAi 配置说明" }).click();

  await expect(page).toHaveURL(/\/eggai\/codex-eggai-configuration\/$/);
  await expect(
    page.getByRole("heading", { name: "Codex EggAi 配置说明", level: 1 }),
  ).toBeVisible();
});
