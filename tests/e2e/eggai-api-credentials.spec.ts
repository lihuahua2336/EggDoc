import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SINGLE_KEY = "sk-EGGDOC-SINGLE-FIXTURE-ONLY";
const SECONDARY_KEY = "sk-EGGDOC-SECONDARY-FIXTURE-ONLY";

async function setEcosystemMode(request: APIRequestContext, mode: string) {
  await request.post(`http://127.0.0.1:4323/control/ecosystem?mode=${mode}`);
}

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
  await page.getByRole("tab", { name: "EggAi 配置" }).click();
}

test.afterEach(async ({ request }) => {
  await setEcosystemMode(request, "active");
});

test("an active EggAi API Account receives credentials in a private response", async ({ page }) => {
  await signInFromTutorial(page);
  const response = await page.request.get("/api/eggai/account");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  await expect(response.json()).resolves.toEqual({
    activationUrl: "https://api.eggai.icu/",
    credentials: [
      {
        baseUrl: "https://api.fixture.eggai.test/v1",
        group: "default",
        id: "101",
        key: SINGLE_KEY,
        name: "Codex primary",
      },
    ],
    modelSummary: {
      availableCount: 8,
      names: [
        "gpt-5.2",
        "claude-sonnet-5",
        "claude-fable-5",
        "claude-haiku-4-5",
        "claude-opus-4-8",
        "claude-opus-4-6",
        "claude-sonnet-4-6",
        "gemini-3-pro",
      ],
    },
    state: "active",
  });
});

test("the first credential is default and another configuration group can be selected", async ({
  context,
  page,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setEcosystemMode(request, "multiple-credentials");
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: "Codex 安装" });
  const selector = panel.getByLabel("EggAi 配置分组");
  await expect(selector).toHaveValue("101");
  await expect(selector).toContainText("默认 · Codex primary · default");
  await selector.selectOption("202");
  await expect(selector).toHaveValue("202");
  await expect(panel.getByTestId("codex-quick-command")).toContainText(SECONDARY_KEY);

  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(panel.getByRole("button", { name: "安装命令已复制" })).toBeVisible();
  const copiedCommand = page.evaluate(() => navigator.clipboard.readText());
  await expect(copiedCommand).resolves.toContain(SECONDARY_KEY);
  await expect(copiedCommand).resolves.toContain("https://edge.fixture.eggai.test/v1");

  const persistentValues = await page.evaluate(() => Object.values(localStorage).join("\n"));
  expect(persistentValues).not.toContain("sk-EGGDOC");
  expect(persistentValues).not.toContain("fixture.eggai.test");
});

test("Session clearing removes personalized installation data", async ({ page }) => {
  await signInFromTutorial(page);
  const panel = page.getByRole("region", { name: "Codex 安装" });
  await expect(panel.getByLabel("EggAi 配置分组")).toHaveValue("101");

  await page.evaluate(() => window.dispatchEvent(new Event("eggdoc:session-cleared")));
  await expect(panel.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
  await expect(panel.getByTestId("codex-quick-command")).toContainText(
    "sk-EGGDOC-EXAMPLE-REPLACE-ME",
  );
  await expect(panel.getByLabel("EggAi 配置分组")).toHaveCount(0);
});

for (const malformedUpstream of [
  { mode: "malformed-tokens", partialKey: "sk-EGGDOC-MALFORMED-FIXTURE-ONLY" },
  { mode: "malformed-models", partialKey: SINGLE_KEY },
]) {
  test(`malformed upstream ${malformedUpstream.mode} data is rejected without exposing secrets`, async ({
    page,
    request,
  }) => {
    await setEcosystemMode(request, malformedUpstream.mode);
    await signInFromTutorial(page);

    const response = await page.request.get("/api/eggai/account");
    expect(response.status()).toBe(502);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const panel = page.getByRole("region", { name: "Codex 安装" });
    await expect(panel.getByText("暂时无法读取 EggAi 配置")).toBeVisible();
    await expect(panel.getByText(malformedUpstream.partialKey, { exact: true })).toHaveCount(0);
    await expect(panel.getByTestId("codex-quick-command")).toContainText(
      "sk-EGGDOC-EXAMPLE-REPLACE-ME",
    );
  });
}
