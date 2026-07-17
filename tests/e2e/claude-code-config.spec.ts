import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const SECONDARY_KEY = "sk-EGGDOC-SECONDARY-FIXTURE-ONLY";

async function setEcosystemMode(request: APIRequestContext, mode: string) {
  await request.post(`http://127.0.0.1:4323/control/ecosystem?mode=${mode}`);
}

async function signInFromClaudeCodeTutorial(page: Page) {
  await page.goto(
    "/auth/login?returnTo=%2Feggai%2Fclaude-code-install%2F%23claude-code-config",
  );
  await page.getByRole("button", { name: "继续登录" }).click();
  await expect(page).toHaveURL(/\/eggai\/claude-code-install\/#claude-code-config$/);
  await page.getByRole("tab", { name: "EggAi 配置" }).click();
}

test.afterEach(async ({ request }) => {
  await setEcosystemMode(request, "active");
});

test("an anonymous Reader gets a no-configuration Claude Code install by default", async ({
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
  await page.goto("/eggai/claude-code-install/");

  const panel = page.getByRole("region", { name: "Claude Code 安装" });
  await expect(panel.getByRole("tab", { name: "无配置安装" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await panel.getByRole("button", { name: "复制安装命令" }).click();
  await expect(page.evaluate(() => navigator.clipboard.readText())).resolves.toBe(
    "curl -fsSL 'https://eggdoc.pages.dev/install/claude-code.sh' | sh",
  );

  await panel.getByRole("tab", { name: "EggAi 配置" }).click();
  await expect(panel.getByRole("link", { name: "登录 EggAi" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "登录 EggAi 后复制" })).toBeDisabled();
});

test("Claude Code uses the first EggAi credential and can switch configuration groups", async ({
  context,
  page,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setEcosystemMode(request, "multiple-credentials");
  await signInFromClaudeCodeTutorial(page);

  const panel = page.getByRole("region", { name: "Claude Code 安装" });
  const selector = panel.getByLabel("EggAi 配置分组");
  await expect(selector).toHaveValue("101");
  await expect(selector).toContainText("默认 · Codex primary · default");

  await panel.getByRole("button", { name: "macOS / Linux / WSL" }).click();
  await selector.selectOption("202");
  await expect(panel.getByTestId("claude-code-quick-command")).toContainText(SECONDARY_KEY);
  await expect(panel.getByTestId("claude-code-quick-command")).toContainText(
    "https://edge.fixture.eggai.test",
  );
  await expect(panel.getByTestId("claude-code-quick-command")).toContainText(
    "--model 'claude-sonnet-5'",
  );
  await expect(panel.getByTestId("claude-code-quick-command")).toContainText(
    "--opus-model 'claude-opus-4-8'",
  );
  await expect(panel.getByTestId("claude-code-quick-command")).toContainText(
    "--haiku-model 'claude-fable-5'",
  );
  await expect(panel.getByTestId("claude-code-model-summary")).toHaveText(
    "主模型 claude-sonnet-5 · Opus claude-opus-4-8 · Fable / Haiku claude-fable-5",
  );

  await panel.getByRole("button", { name: "复制安装命令" }).click();
  const copiedCommand = page.evaluate(() => navigator.clipboard.readText());
  await expect(copiedCommand).resolves.toContain(SECONDARY_KEY);
  await expect(copiedCommand).resolves.toContain("--eggai");
});

test("Claude Code does not generate an EggAi command without an available Claude model", async ({
  page,
  request,
}) => {
  await setEcosystemMode(request, "no-claude-models");
  await signInFromClaudeCodeTutorial(page);

  const panel = page.getByRole("region", { name: "Claude Code 安装" });
  await expect(panel.getByText("暂无可用 Claude 模型", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "暂无可用 Claude 模型" })).toBeDisabled();
});
