import { expect, test } from "@playwright/test";

const articleWidths = [320, 1280] as const;

for (const width of articleWidths) {
  test(`a Reader can copy a rendered Markdown code block at ${width}px`, async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/learn/codex-install/");

    const firstCodeBlock = page.locator(".prose pre").first();
    const copyButton = firstCodeBlock.locator("button.code-copy-button");
    await expect(copyButton).toHaveAccessibleName("复制代码");
    await copyButton.click();

    await expect(copyButton).toHaveAccessibleName("代码已复制");
    await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toContain("codex");
  });

  test(`a Reader is told when copying a code block fails at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Simulated clipboard failure");
          },
        },
      });
    });
    await page.goto("/learn/codex-install/");

    const copyButton = page.locator(".prose pre").first().locator("button.code-copy-button");
    await expect(copyButton).toHaveAccessibleName("复制代码");
    await copyButton.click();

    await expect(copyButton).toHaveAccessibleName("复制失败");
    await expect(page.locator("[data-code-copy-status]")).toHaveText(
      "复制代码失败，请手动选择代码。",
    );
  });
}

for (const width of articleWidths) {
  test(`lesson video metadata creates only a safe external address at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 800, width });
    await page.goto("/learn/article-interactions-fixture/");

    const video = page.getByRole("region", { name: "课程视频" });
    const videoLink = video.getByRole("link", { name: "打开课程视频" });
    await expect(videoLink).toHaveAttribute("href", "https://video.example.test/eggdoc-mvp");
    await expect(videoLink).toHaveAttribute("target", "_blank");
    await expect(videoLink).toHaveAttribute("rel", /\bnoopener\b/);
    await expect(videoLink).toHaveAttribute("rel", /\bnoreferrer\b/);
    await expect(page.locator("iframe, video[autoplay], audio[autoplay]")).toHaveCount(0);

    await page.goto("/learn/codex-install/");
    await expect(page.getByRole("region", { name: "课程视频" })).toHaveCount(0);
    await expect(page.locator("iframe, video[autoplay], audio[autoplay]")).toHaveCount(0);
  });
}

for (const width of articleWidths) {
  test(`article interactions fit ${width}px text layouts`, async ({ page }) => {
    await page.setViewportSize({ height: 800, width });
    await page.goto("/eggai/claude-code-install/");

    const firstCodeBlock = page.locator('.prose pre[data-copy-enhanced="true"]').first();
    const copyButton = firstCodeBlock.locator("button.code-copy-button");
    await expect(copyButton).toBeVisible();
    const geometry = await firstCodeBlock.evaluate((codeBlock) => {
      const code = codeBlock.querySelector("code");
      const button = codeBlock.querySelector("button");
      if (!code || !button) throw new Error("Enhanced code block is incomplete");
      const range = document.createRange();
      range.selectNodeContents(code);
      const text = range.getBoundingClientRect();
      const control = button.getBoundingClientRect();
      return {
        controlBottom: control.bottom,
        textTop: text.top,
      };
    });
    expect(geometry.controlBottom).toBeLessThanOrEqual(geometry.textTop);

    const interactionControlsFit = await page
      .locator(".code-copy-button")
      .evaluateAll((elements) =>
        elements.every((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth;
        }),
      );
    expect(interactionControlsFit).toBe(true);

    await page.goto("/learn/article-interactions-fixture/");
    const videoLink = page.getByRole("link", { name: "打开课程视频" });
    await expect(videoLink).toBeVisible();
    expect(await videoLink.evaluate((link) => link.scrollWidth <= link.clientWidth)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}
