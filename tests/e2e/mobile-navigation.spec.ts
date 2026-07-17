import { expect, test, type Locator, type Page } from "@playwright/test";

async function expectNoOverlap(locators: Locator[]) {
  const boxes = await Promise.all(locators.map((locator) => locator.boundingBox()));
  const labels = await Promise.all(
    locators.map((locator) =>
      locator.evaluate(
        (element) => element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName,
      ),
    ),
  );

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      if (!left || !right) continue;

      const overlaps =
        left.x < right.x + right.width &&
        left.x + left.width > right.x &&
        left.y < right.y + right.height &&
        left.y + left.height > right.y;
      expect(overlaps, `${labels[leftIndex]} overlaps ${labels[rightIndex]}`).toBe(false);
    }
  }
}

async function signIn(page: Page, returnTo = "/notes/") {
  await page.goto(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(new RegExp(`${returnTo.replaceAll("/", "\\/")}$`));
}

test("an anonymous mobile Reader can open and dismiss the primary navigation by keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/notes/");
  await page.waitForLoadState("networkidle");

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await expect(menuButton).toBeVisible();

  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  const drawer = page.getByRole("dialog", { name: "移动导航" });
  await expect(drawer).toBeVisible();
  const homeLink = drawer.getByRole("link", { name: "首页", exact: true });
  await expect(homeLink).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.getByRole("button", { name: "关闭导航菜单" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(homeLink).toBeFocused();
  await expect(drawer.getByRole("link", { name: "EggAi 指南", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "AI 编程", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "工具与概念", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "登录 EggAi" })).toHaveAttribute(
    "href",
    "/auth/login?returnTo=%2Fnotes%2F",
  );

  await page.keyboard.press("Escape");

  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();
});

test("choosing a mobile primary link closes the drawer and reveals the destination", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  const drawer = page.getByRole("dialog", { name: "移动导航" });
  await drawer.getByRole("link", { name: "工具与概念", exact: true }).click();

  await expect(page).toHaveURL(/\/notes\/$/);
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("heading", { name: "工具与概念" })).toBeVisible();
});

test("an authenticated mobile Reader sees EggAi identity actions and can exit EggDoc", async ({
  page,
}) => {
  await page.setViewportSize({ height: 720, width: 320 });
  await signIn(page);

  const menuButton = page.getByRole("button", { name: "打开导航菜单" });
  await menuButton.click();
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  const drawer = page.getByRole("dialog", { name: "移动导航" });
  const identity = drawer.getByLabel("EggAi 当前身份");
  await expect(identity.getByText("测试读者", { exact: true })).toBeVisible();
  await expect(identity.getByText("reader@example.test", { exact: true })).toBeVisible();
  await expect(identity.getByRole("link", { name: "打开 EggAi API 平台" })).toHaveAttribute(
    "target",
    "_blank",
  );
  const authenticatedTextFits = await drawer.locator("a, button, p").evaluateAll((elements) =>
    elements.every((element) => element.scrollWidth <= element.clientWidth),
  );
  expect(authenticatedTextFits).toBe(true);

  await identity.getByRole("button", { name: "退出 EggDoc" }).click();

  await expect(drawer).toBeHidden();
  await expect(menuButton).toBeFocused();
  await menuButton.click();
  await expect(drawer.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
});

for (const width of [320, 390]) {
  test(`the mobile header and drawer fit without overlap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 720, width });
    await page.goto("/notes/");

    const brand = page.getByRole("banner").getByRole("link", { name: "EggDoc" });
    const menuButton = page.getByRole("button", { name: "打开导航菜单" });
    const search = page.getByRole("link", { name: "搜索" });
    const theme = page.getByRole("button", { name: /切换主题/ });
    await expectNoOverlap([brand, menuButton, search, theme]);

    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const drawer = page.getByRole("dialog", { name: "移动导航" });
    await expect(drawer).toBeVisible();

    const fitsViewport = await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(fitsViewport).toBe(true);

    const drawerTextFits = await drawer.locator("a, button, p").evaluateAll((elements) =>
      elements.every((element) => element.scrollWidth <= element.clientWidth),
    );
    expect(drawerTextFits).toBe(true);
  });
}

test("desktop keeps its primary navigation, search, theme, and identity controls", async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 1280 });
  await page.goto("/notes/");

  await expect(page.getByRole("button", { name: "打开导航菜单" })).toBeHidden();
  const navigation = page.getByRole("navigation", { name: "主导航" });
  await expect(navigation.getByRole("link", { name: "首页", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "EggAi 指南", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "AI 编程", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "工具与概念", exact: true })).toBeVisible();

  const brand = page.getByRole("banner").getByRole("link", { name: "EggDoc" });
  const search = page.getByRole("link", { name: "搜索" });
  const theme = page.getByRole("button", { name: /切换主题/ });
  const login = page.getByRole("link", { name: "登录 EggAi" });
  await expect(login).toBeVisible();
  await expectNoOverlap([brand, navigation, search, theme, login]);
});

test("authenticated identity actions fit a common narrower desktop width", async ({ page }) => {
  await page.setViewportSize({ height: 768, width: 1024 });
  await signIn(page);

  await expect(page.getByRole("button", { name: "打开导航菜单" })).toBeHidden();
  const banner = page.getByRole("banner");
  const brand = banner.getByRole("link", { name: "EggDoc" });
  const navigation = page.getByRole("navigation", { name: "主导航" });
  const search = page.getByRole("link", { name: "搜索" });
  const theme = page.getByRole("button", { name: /切换主题/ });
  const identity = page.getByLabel("EggAi 当前身份");
  await expect(identity.getByText("测试读者", { exact: true })).toBeVisible();
  await expectNoOverlap([brand, navigation, search, theme, identity]);

  const identityTextFits = await identity.locator("a, button, span").evaluateAll((elements) =>
    elements.every((element) => element.scrollWidth <= element.clientWidth),
  );
  expect(identityTextFits).toBe(true);
});
