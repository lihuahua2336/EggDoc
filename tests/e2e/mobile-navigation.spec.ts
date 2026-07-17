import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoOverlap(locators: Locator[]) {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()));
  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      if (!left || !right) continue;
      expect(
        left.x < right.x + right.width &&
          left.x + left.width > right.x &&
          left.y < right.y + right.height &&
          left.y + left.height > right.y,
      ).toBe(false);
    }
  }
}

async function signIn(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2F");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/$/);
}

test("the mobile navigation contains only home and tool tutorials", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/eggai/");

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.click();
  const drawer = page.getByRole("dialog", { name: "移动导航" });
  await expect(drawer.getByRole("link", { name: "首页", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "工具教程", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "AI 编程", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "工具与概念", exact: true })).toHaveCount(0);
  await expect(drawer.getByRole("link", { name: "登录 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Feggai%2F",
  );

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("choosing tool tutorials closes the mobile drawer", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");
  await page.getByRole("button", { name: "打开导航菜单" }).click();
  const drawer = page.getByRole("dialog", { name: "移动导航" });
  await drawer.getByRole("link", { name: "工具教程", exact: true }).click();
  await expect(page).toHaveURL(/\/eggai\/$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "工具教程" })).toBeVisible();
});

test("an authenticated mobile Reader can exit EggDoc", async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 320 });
  await signIn(page);
  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.click();
  const drawer = page.getByRole("dialog", { name: "移动导航" });
  const identity = drawer.getByLabel("EggAi 当前身份");
  await expect(identity.getByText("测试读者", { exact: true })).toBeVisible();
  await identity.getByRole("button", { name: "退出 EggDoc" }).click();
  await expect(drawer).toBeHidden();
  await menuButton.click();
  await expect(drawer.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
});

for (const width of [320, 390]) {
  test(`the mobile header and drawer fit without overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 720, width });
    await page.goto("/eggai/");
    const banner = page.getByRole("banner");
    const controls = [
      banner.getByRole("link", { name: "EggDoc" }),
      page.getByRole("button", { name: "打开导航菜单" }),
      page.getByRole("link", { name: "搜索" }),
      page.getByRole("button", { name: /切换主题/ }),
    ];
    await expectNoOverlap(controls);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}

test("desktop shows the reduced primary navigation", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1280 });
  await page.goto("/eggai/");
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation.getByRole("link", { name: "首页", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "工具教程", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "打开导航菜单" })).toBeHidden();
});
