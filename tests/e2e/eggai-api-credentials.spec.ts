import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SELECTED_CREDENTIAL_STORAGE_KEY = "eggdoc:selected-api-credential-id";
const SINGLE_KEY = "sk-EGGDOC-SINGLE-FIXTURE-ONLY";
const SECONDARY_KEY = "sk-EGGDOC-SECONDARY-FIXTURE-ONLY";

async function setEcosystemMode(request: APIRequestContext, mode: string) {
  await request.post(`http://127.0.0.1:4323/control/ecosystem?mode=${mode}`);
}

async function signInFromTutorial(page: Page) {
  await page.goto("/auth/login?returnTo=%2Feggai%2Fcodex-installer%2F%23codex-config");
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/codex-installer\/#codex-config$/);
  await page.getByText("配置详情", { exact: true }).click();
}

test.afterEach(async ({ request }) => {
  await setEcosystemMode(request, "active");
});

test("an active EggAi API Account receives adapted credentials in a private response", async ({
  page,
}) => {
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
      availableCount: 3,
      names: ["gpt-5.2", "claude-sonnet-4-5", "gemini-3-pro"],
    },
    state: "active",
  });
});

test("a single EggAi API Credential is shown in plaintext with its read-only details", async ({
  page,
}) => {
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByText(SINGLE_KEY, { exact: true })).toBeVisible();
  await expect(panel.getByText("Codex primary", { exact: true })).toBeVisible();
  await expect(panel.getByText("default", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("EggAi Base URL")).toHaveValue(
    "https://api.fixture.eggai.test/v1",
  );
  await expect(panel.getByText("3 个可用模型", { exact: true })).toBeVisible();
  await expect(panel.getByText("gpt-5.2、claude-sonnet-4-5、gemini-3-pro", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("EggAi Base URL")).toHaveAttribute("readonly", "");
  await expect(panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true })).toHaveCount(0);
});

test("a remembered credential identifier is restored and another credential can be selected", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "multiple-credentials");
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SELECTED_CREDENTIAL_STORAGE_KEY, value: "202" },
  );
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: /^Codex / });
  const selector = panel.getByLabel("EggAi API Credential");
  await expect(selector).toHaveValue("202");
  await expect(panel.getByText(SECONDARY_KEY, { exact: true })).toBeVisible();
  await expect(panel.getByText("coding", { exact: true })).toBeVisible();
  await expect(panel.getByLabel("EggAi Base URL")).toHaveValue(
    "https://edge.fixture.eggai.test/v1",
  );

  await selector.selectOption("101");
  await expect(panel.getByText(SINGLE_KEY, { exact: true })).toBeVisible();
  await expect(panel.getByLabel("EggAi Base URL")).toHaveValue(
    "https://api.fixture.eggai.test/v1",
  );
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), SELECTED_CREDENTIAL_STORAGE_KEY))
    .toBe("101");

  const persistentValues = await page.evaluate(() => [
    ...Object.values(localStorage),
    ...Object.values(sessionStorage),
  ]);
  expect(persistentValues.join("\n")).not.toContain("sk-EGGDOC");
  expect(persistentValues.join("\n")).not.toContain("fixture.eggai.test");
});

test("a stale remembered credential identifier falls back to the first usable credential", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "multiple-credentials");
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: SELECTED_CREDENTIAL_STORAGE_KEY, value: "removed-token" },
  );
  await signInFromTutorial(page);

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByLabel("EggAi API Credential")).toHaveValue("101");
  await expect(panel.getByText(SINGLE_KEY, { exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), SELECTED_CREDENTIAL_STORAGE_KEY))
    .toBe("101");
});

test("Session expiry removes personalized credentials and restores anonymous configuration", async ({
  page,
  request,
}) => {
  await signInFromTutorial(page);
  await expect(page.getByText(SINGLE_KEY, { exact: true })).toBeVisible();

  await setEcosystemMode(request, "authorization-expired");
  await page.getByRole("region", { name: /^Codex / }).getByRole("button", { name: "重新检查" }).click();

  const panel = page.getByRole("region", { name: /^Codex / });
  await expect(panel.getByText(SINGLE_KEY, { exact: true })).toHaveCount(0);
  await expect(panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true })).toBeVisible();
  await expect(panel.getByText("EggAi 授权已过期", { exact: true })).toBeVisible();
});

test("Session clearing invalidates an in-flight credential response", async ({ page }) => {
  await signInFromTutorial(page);
  await expect(page.getByText(SINGLE_KEY, { exact: true })).toBeVisible();

  let releaseResponse!: () => void;
  const responseReleased = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let markRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    markRequestStarted = resolve;
  });
  await page.route("**/api/eggai/account", async (route) => {
    markRequestStarted();
    await responseReleased;
    await route.fulfill({
      body: JSON.stringify({
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
        modelSummary: { availableCount: 1, names: ["gpt-5.2"] },
        state: "active",
      }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.getByRole("region", { name: "Codex 配置" }).getByRole("button", { name: "重新检查" }).click();
  await requestStarted;
  await page.evaluate(() => window.dispatchEvent(new Event("eggdoc:session-cleared")));
  const delayedResponse = page.waitForResponse((response) =>
    response.url().endsWith("/api/eggai/account"),
  );
  releaseResponse();
  await delayedResponse;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

  const panel = page.getByRole("region", { name: "Codex 匿名配置" });
  await expect(panel.getByText(SINGLE_KEY, { exact: true })).toHaveCount(0);
  await expect(panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true })).toBeVisible();
});

for (const malformedUpstream of [
  { mode: "malformed-tokens", partialKey: "sk-EGGDOC-MALFORMED-FIXTURE-ONLY" },
  { mode: "malformed-models", partialKey: SINGLE_KEY },
  { mode: "malformed-token-envelope", partialKey: SINGLE_KEY },
  { mode: "malformed-model-envelope", partialKey: SINGLE_KEY },
]) {
  test(`malformed upstream ${malformedUpstream.mode} data is rejected without exposing partial secrets`, async ({
    page,
    request,
  }) => {
    await setEcosystemMode(request, malformedUpstream.mode);
    await signInFromTutorial(page);

    const response = await page.request.get("/api/eggai/account");
    expect(response.status()).toBe(502);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ state: "temporary-error" });

    const panel = page.getByRole("region", { name: /^Codex / });
    await expect(panel.getByText("暂时无法检查 EggAi API Account")).toBeVisible();
    await expect(panel.getByText(malformedUpstream.partialKey, { exact: true })).toHaveCount(0);
    await expect(panel.getByText("sk-EGGDOC-EXAMPLE-REPLACE-ME", { exact: true })).toBeVisible();
  });
}
