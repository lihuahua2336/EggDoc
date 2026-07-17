import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

const shell =
  process.platform === "win32" && existsSync("C:\\Program Files\\Git\\usr\\bin\\sh.exe")
    ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe"
    : "sh";
const scriptPath = "public/install/codex.sh";
const testPath =
  process.platform === "win32"
    ? `C:\\Program Files\\Git\\usr\\bin;C:\\Program Files\\Git\\bin;${process.env.PATH ?? ""}`
    : process.env.PATH;

function runShell(args: string[]) {
  return spawnSync(shell, [scriptPath, ...args], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
    env: {
      ...process.env,
      CODEX_HOME: "/tmp/eggdoc-codex-shell-test",
      PATH: testPath,
    },
  });
}

test("the hosted Shell installer has valid POSIX shell syntax", () => {
  const result = spawnSync(shell, ["-n", scriptPath], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test("default dry-run installs Codex without changing provider configuration", () => {
  const result = runShell(["--dry-run"]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Mode: default");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would write config.toml: no");
  expect(result.stdout).toContain("Would run codex login --with-api-key: no");
  expect(result.stdout).not.toContain("model_provider");
});

test("EggAi dry-run accepts generated parameters, redacts the key, and previews provider config", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-DRY-RUN-ONLY";
  const result = runShell([
    "--dry-run", "--eggai",
    "--sk-key",
    fixtureKey,
    "--baseurl",
    'https://api.example.test/v1?label="shell"',
    "--language",
    "en-us",
  ]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Mode: eggai");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).not.toContain(fixtureKey);
  expect(result.stdout).toContain('base_url = "https://api.example.test/v1?label=\\"shell\\""');
  expect(result.stdout).toContain("Respond in English by default");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would run codex login --with-api-key: yes");
  expect(result.stdout).toContain("Backup file: /tmp/eggdoc-codex-shell-test/config.toml.eggai.bak");
});

test("EggAi dry-run keeps zh-cn and the public EggAi Base URL as stable defaults", () => {
  const result = runShell(["--dry-run", "--eggai"]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Base URL: https://api.eggai.icu/v1");
  expect(result.stdout).toContain("Language: zh-cn");
  expect(result.stdout).toContain("API key: missing");
  expect(result.stdout).toContain("请默认使用简体中文回答");
});

test("EggAi dry-run rejects invalid language and Base URL before any install path", () => {
  const invalidLanguage = runShell(["--dry-run", "--eggai", "--language", "fr-fr"]);
  const invalidBaseUrl = runShell(["--dry-run", "--eggai", "--baseurl", "file:///tmp/eggai"]);

  expect(invalidLanguage.status).not.toBe(0);
  expect(invalidLanguage.stderr).toContain("language must be zh-cn or en-us");
  expect(invalidLanguage.stdout).not.toContain("Installing or updating Codex");
  expect(invalidBaseUrl.status).not.toBe(0);
  expect(invalidBaseUrl.stderr).toContain("baseurl must start with http:// or https://");
  expect(invalidBaseUrl.stdout).not.toContain("Installing or updating Codex");
});
