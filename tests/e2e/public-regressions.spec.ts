import { expect, test } from "@playwright/test";

test("an anonymous Reader can switch from the light theme to the dark theme", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");

  await page.getByRole("button", { name: "切换主题，当前为浅色" }).click();

  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("button", { name: "切换主题，当前为深色" })).toBeVisible();
});
