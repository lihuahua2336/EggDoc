import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { buildPowerShellInstallCommand } from "../../src/lib/codex/configuration";

const powershell = path.join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const scriptPath = path.join(repoRoot, "public/install/codex.ps1");

function runPowerShell(
  args: string[],
  codexHome?: string,
  extraEnv: NodeJS.ProcessEnv = {},
) {
  return spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        BASE_URL: undefined,
        EGGAI_API_KEY: undefined,
        LANGUAGE: undefined,
        SK_KEY: undefined,
        ...(codexHome ? { CODEX_HOME: codexHome } : {}),
        ...extraEnv,
      },
    },
  );
}

function parsePowerShell(source: string) {
  const encodedSource = Buffer.from(source, "utf8").toString("base64");
  const parserCommand = [
    `$source = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedSource}'))`,
    "$tokens = $null",
    "$errors = $null",
    "[Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors) | Out-Null",
    "if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }",
  ].join("; ");

  return runPowerShell([
    "-EncodedCommand",
    Buffer.from(parserCommand, "utf16le").toString("base64"),
  ]);
}

function unusedCodexHome() {
  return path.join(tmpdir(), `eggdoc-codex-powershell-${randomUUID()}`);
}

test("the hosted PowerShell installer and generated command have valid PowerShell syntax", () => {
  const scriptSyntax = runPowerShell([
    "-Command",
    "$tokens = $null; $errors = $null; " +
      "[Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'public/install/codex.ps1'), [ref]$tokens, [ref]$errors) | Out-Null; " +
      "if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }",
  ]);
  const commandSyntax = parsePowerShell(
    buildPowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
      installerOrigin: "https://docs.example.test/root's",
      language: "en-us",
    }),
  );

  expect(scriptSyntax.stderr).toBe("");
  expect(scriptSyntax.status).toBe(0);
  expect(commandSyntax.stderr).toBe("");
  expect(commandSyntax.status).toBe(0);
});

test("dry-run accepts generated values, redacts the key, and never creates CODEX_HOME", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-DRY-RUN-ONLY";
  const codexHome = unusedCodexHome();
  const result = runPowerShell(
    ["-File", scriptPath, "-DryRun"],
    codexHome,
    {
      BASE_URL: 'https://api.example.test/v1?label="powershell"',
      LANGUAGE: "en-us",
      SK_KEY: fixtureKey,
    },
  );

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Mode: dry-run");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).not.toContain(fixtureKey);
  expect(result.stdout).toContain('base_url = "https://api.example.test/v1?label=\\"powershell\\""');
  expect(result.stdout).toContain("Respond in English by default");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would write config.toml: yes");
  expect(result.stdout).toContain("Would run codex login --with-api-key: yes");
  expect(result.stdout).toContain(`Backup file: ${codexHome}\\config.toml.eggai.bak`);
});

test("dry-run keeps stable defaults and reports Windows recovery paths without writes", () => {
  const codexHome = unusedCodexHome();
  const result = runPowerShell(["-File", scriptPath, "-DryRun"], codexHome, {
    PATH: "",
  });

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Base URL: https://api.eggai.icu/v1");
  expect(result.stdout).toContain("Language: zh-cn");
  expect(result.stdout).toContain("API key: missing");
  expect(result.stdout).toContain("winget");
  expect(result.stdout).toContain("winget exists: no");
  expect(result.stdout).toContain("would download https://aka.ms/getwinget");
  expect(result.stdout).toContain("official PowerShell installer");
  expect(result.stdout).toContain("Backup file:");
  expect(result.stdout).toContain("Would run codex login --with-api-key: yes");
});

test("dry-run rejects invalid language and Base URL before any install path", () => {
  const invalidLanguageHome = unusedCodexHome();
  const invalidBaseUrlHome = unusedCodexHome();
  const invalidLanguage = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-Language", "fr-fr"],
    invalidLanguageHome,
  );
  const invalidBaseUrl = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-BaseUrl", "file:///eggai"],
    invalidBaseUrlHome,
  );

  expect(invalidLanguage.status).not.toBe(0);
  expect(invalidLanguage.stderr).toContain("zh-cn,en-us");
  expect(invalidLanguage.stdout).not.toContain("Checking Windows winget environment");
  expect(existsSync(invalidLanguageHome)).toBe(false);
  expect(invalidBaseUrl.status).not.toBe(0);
  expect(invalidBaseUrl.stderr).toContain("baseurl must start with http:// or https://");
  expect(invalidBaseUrl.stdout).not.toContain("Checking Windows winget environment");
  expect(existsSync(invalidBaseUrlHome)).toBe(false);
});
