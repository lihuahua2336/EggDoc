import { defineConfig, devices } from "@playwright/test";

const testPort = Number(process.env.EGGDOC_TEST_PORT ?? 4322);
if (!Number.isInteger(testPort) || testPort < 1 || testPort > 65535) {
  throw new Error("EGGDOC_TEST_PORT must be a valid TCP port");
}
const testOrigin = `http://127.0.0.1:${testPort}`;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: testOrigin,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node tests/fixtures/mock-eggai-services.mjs",
      url: "http://127.0.0.1:4323/health",
      reuseExistingServer: false,
    },
    {
      command: "node tests/fixtures/start-preview.mjs",
      url: `${testOrigin}/eggai/codex-installer/`,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.CI ? undefined : "chrome",
      },
    },
  ],
});
