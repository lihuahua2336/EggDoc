import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4322",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm.cmd run preview -- --host 127.0.0.1 --port 4322",
    url: "http://127.0.0.1:4322/eggai/codex-installer/",
    reuseExistingServer: false,
  },
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
