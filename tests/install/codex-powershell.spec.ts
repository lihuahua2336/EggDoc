import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
        CODEX_MODEL: undefined,
        CODEX_PACKAGE_ID: undefined,
        EGGAI_API_KEY: undefined,
        LANGUAGE: undefined,
        MODEL: undefined,
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

function runWithInstallerFixture(
  installerSource = "# Installer fixture was not needed.\n",
  wrapperArguments = "",
  options: {
    codexAvailable?: boolean;
    extraEnv?: NodeJS.ProcessEnv;
    initialConfig?: string;
    lockConfigDuringRun?: boolean;
    removeBackupAfterFirstRun?: boolean;
    runs?: number;
    wingetAvailable?: boolean;
  } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-codex-powershell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const installerFixture = path.join(root, "installer.ps1");
  const wingetLog = path.join(root, "winget.log");
  const codexLog = path.join(root, "codex.log");
  const environmentStateLog = path.join(root, "environment-state.log");
  const codexHome = path.join(home, ".codex");
  const configPath = path.join(codexHome, "config.toml");
  const backupPath = `${configPath}.eggai.bak`;
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  mkdirSync(path.join(root, "localappdata"));
  writeFileSync(installerFixture, installerSource);

  if (options.initialConfig !== undefined) {
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(configPath, options.initialConfig);
  }

  if (options.wingetAvailable !== false) {
    writeFileSync(
      path.join(bin, "winget.cmd"),
      `@echo off\r
echo %*>>"%FAKE_WINGET_LOG%"\r
if "%~1"=="list" (echo Codex & exit /b 0)\r
if defined FAKE_WINGET_EXIT exit /b %FAKE_WINGET_EXIT%\r
exit /b 0\r
`,
    );
  }
  if (options.codexAvailable !== false) {
    writeFileSync(
      path.join(bin, "codex.cmd"),
      `@echo off\r
setlocal EnableDelayedExpansion\r
echo %*>>"%FAKE_CODEX_LOG%"\r
if "%~1"=="--version" goto version\r
exit /b 43\r
:version\r
if defined FAKE_CODEX_VERSION_EXIT exit /b %FAKE_CODEX_VERSION_EXIT%\r
echo codex-cli 9.9.9 ^(EggDoc test fixture^)\r
exit /b 0\r
`,
    );
  }

  const command = [
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)",
    "  Copy-Item -LiteralPath $env:EGGDOC_CODEX_INSTALLER_FIXTURE -Destination $OutFile -Force",
    "}",
    "function global:Add-AppxPackage { throw 'App Installer changes are disabled in this fixture.' }",
    "function global:Start-Process { throw 'Store launch is disabled in this fixture.' }",
    "$configLock = $null",
    "if ($env:EGGDOC_LOCK_CONFIG) {",
    "  $configLock = [IO.File]::Open($env:EGGDOC_CONFIG_PATH, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)",
    "}",
    "try {",
    `  & $env:EGGDOC_CODEX_WRAPPER ${wrapperArguments}`,
    "} finally {",
    "  $processVariables = [Environment]::GetEnvironmentVariables([EnvironmentVariableTarget]::Process)",
    "  $environmentState = if ($processVariables.Contains('EGGAI_API_KEY')) { 'exists:' + [string]$processVariables['EGGAI_API_KEY'] } else { 'missing' }",
    "  [IO.File]::WriteAllText($env:EGGDOC_ENV_STATE_LOG, $environmentState)",
    "  if ($configLock) { $configLock.Dispose() }",
    "}",
  ].join("\n");
  const results = [];
  const configs: Array<string | undefined> = [];
  const backups: Array<string | undefined> = [];
  for (let run = 0; run < (options.runs ?? 1); run += 1) {
    results.push(
      runPowerShell(
        ["-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
        codexHome,
        {
          EGGDOC_CODEX_INSTALLER_FIXTURE: installerFixture,
          EGGDOC_CODEX_WRAPPER: scriptPath,
          EGGDOC_ENV_STATE_LOG: environmentStateLog,
          EGGAI_CODEX_ENV_SCOPE: "Process",
          EGGDOC_CONFIG_PATH: configPath,
          EGGDOC_LOCK_CONFIG: options.lockConfigDuringRun ? "1" : undefined,
          EGGDOC_NODE_BINARY: process.execPath,
          FAKE_CODEX_LOG: codexLog,
          FAKE_WINGET_LOG: wingetLog,
          HOME: home,
          LOCALAPPDATA: path.join(root, "localappdata"),
          PATH:
            options.wingetAvailable === false
              ? `${bin}${path.delimiter}${path.join(process.env.SystemRoot ?? "C:\\Windows", "System32")}`
              : `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
          TEMP: temporaryFiles,
          TMP: temporaryFiles,
          USERPROFILE: home,
          ...options.extraEnv,
        },
      ),
    );
    configs.push(existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined);
    backups.push(existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined);
    if (run === 0 && options.removeBackupAfterFirstRun) {
      rmSync(backupPath, { force: true });
    }
  }
  const result = results.at(-1)!;
  const backup = existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined;
  const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined;
  const codexCommands = existsSync(codexLog) ? readFileSync(codexLog, "utf8") : "";
  const environmentState = existsSync(environmentStateLog)
    ? readFileSync(environmentStateLog, "utf8")
    : undefined;
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  const wingetCommands = existsSync(wingetLog) ? readFileSync(wingetLog, "utf8") : "";
  rmSync(root, { force: true, recursive: true });
  return {
    backup,
    backups,
    codexCommands,
    config,
    configs,
    environmentState,
    remainingTemporaryFiles,
    result,
    results,
    wingetCommands,
  };
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
      model: "gpt-5.6-sol",
    }),
  );

  expect(scriptSyntax.stderr).toBe("");
  expect(scriptSyntax.status).toBe(0);
  expect(commandSyntax.stderr).toBe("");
  expect(commandSyntax.status).toBe(0);
});

test("default installation preserves winget sources and verifies Codex before success", () => {
  const installed = runWithInstallerFixture();

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.wingetCommands).toBe("");
  expect(installed.codexCommands).toContain("--version");
  expect(installed.result.stdout).toContain("codex-cli 9.9.9 (EggDoc test fixture)");
  expect(installed.result.stdout).toContain("Done: Codex is installed");
  expect(installed.config).toBeUndefined();
});

test("default installation falls back after winget failure and preserves installer failure", () => {
  const failed = runWithInstallerFixture(
    '& "$env:ComSpec" /c "exit 42"\n',
    "-CodexPackage 'OpenAI.Codex'",
    { extraEnv: { FAKE_WINGET_EXIT: "23" } },
  );

  expect(failed.result.status).not.toBe(0);
  expect(failed.wingetCommands).toContain("list --id OpenAI.Codex --exact");
  expect(failed.wingetCommands).toContain("install --id OpenAI.Codex --exact");
  expect(failed.result.stderr).toContain("official Codex installer exited with code 42");
  expect(failed.result.stdout).not.toContain("Done: Codex is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("default installation uses the official installer directly when winget is unavailable", () => {
  const installed = runWithInstallerFixture(
    `
$codexBin = Join-Path $env:LOCALAPPDATA "Programs\\OpenAI\\Codex\\bin"
New-Item -ItemType Directory -Force -Path $codexBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $codexBin "codex.exe") -Force
`,
    "",
    {
      codexAvailable: false,
      wingetAvailable: false,
    },
  );

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.wingetCommands).toBe("");
  expect(installed.result.stdout).toContain("official Codex CLI installer");
  expect(installed.result.stdout).toContain(process.version);
  expect(installed.result.stdout).toContain("Done: Codex is installed");
  expect(installed.remainingTemporaryFiles).toEqual([]);
});

test("official installer rejects empty and HTML responses", () => {
  const empty = runWithInstallerFixture("\n\t\n", "", { wingetAvailable: false, codexAvailable: false });
  const html = runWithInstallerFixture("<!doctype html><title>Unavailable</title>\n", "", {
    wingetAvailable: false,
    codexAvailable: false,
  });

  expect(empty.result.status).not.toBe(0);
  expect(empty.result.stderr).toContain("official Codex installer response was empty");
  expect(html.result.status).not.toBe(0);
  expect(html.result.stderr).toContain("returned HTML instead of a script");
  expect(empty.remainingTemporaryFiles).toEqual([]);
  expect(html.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation configures provider-scoped authentication without changing Codex login", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-INSTALL-FIXTURE";
  const configured = runWithInstallerFixture(
    undefined,
    `-EggAi -SkKey '${fixtureKey}' -BaseUrl 'https://api.example.test/v1' -Language 'en-us' -Model 'gpt-5.6-sol'`,
    { extraEnv: { EGGAI_CODEX_ENV_SCOPE: "Process" } },
  );

  expect(configured.result.status, configured.result.stderr).toBe(0);
  expect(configured.result.stdout).toContain("Done: Codex is installed and configured to use EggAi");
  expect(configured.result.stdout).toContain("codex-cli 9.9.9 (EggDoc test fixture)");
  expect(configured.result.stdout).not.toContain(fixtureKey);
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.config).toContain('model_provider = "eggai"');
  expect(configured.config).toContain('model = "gpt-5.6-sol"');
  expect(configured.config).toContain('base_url = "https://api.example.test/v1"');
  expect(configured.config).toContain('env_key = "EGGAI_API_KEY"');
  expect(configured.config).not.toContain("requires_openai_auth");
  expect(configured.config).not.toContain("cli_auth_credentials_store");
  expect(configured.config).toContain("Respond in English by default");
  expect(configured.config).not.toContain(fixtureKey);
  expect(configured.backup).toBeUndefined();
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation restores the previous API key and config when verification fails", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-ROLLBACK-FIXTURE";
  const initialConfig = 'model = "keep-before-failed-env-save"\r\n';
  const configured = runWithInstallerFixture(
    undefined,
    `-EggAi -SkKey '${fixtureKey}'`,
    {
      extraEnv: {
        EGGDOC_TEST_FORCE_CODEX_ENV_VERIFY_FAILURE: "1",
        EGGAI_API_KEY: "sk-EGGDOC-PREVIOUS-KEY",
      },
      initialConfig,
    },
  );

  expect(
    configured.result.status,
    `${configured.result.stdout}\n${configured.result.stderr}\nCommands:\n${configured.codexCommands}`,
  ).not.toBe(0);
  expect(configured.result.stderr).toContain("forced EGGAI_API_KEY verification failure");
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(configured.config).toBe(initialConfig);
  expect(configured.backup).toBe(initialConfig);
  expect(configured.environmentState).toBe("exists:sk-EGGDOC-PREVIOUS-KEY");
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation removes the new API key when no previous value existed", () => {
  const configured = runWithInstallerFixture(
    undefined,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-NEW-KEY'",
    {
      extraEnv: { EGGDOC_TEST_FORCE_CODEX_ENV_VERIFY_FAILURE: "1" },
    },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("forced EGGAI_API_KEY verification failure");
  expect(configured.config).toBeUndefined();
  expect(configured.backup).toBeUndefined();
  expect(configured.environmentState).toBe("missing");
});

test("EggAi installation leaves the original config intact when atomic replacement fails", () => {
  const initialConfig = 'model = "keep-before-replace-failure"\r\n';
  const configured = runWithInstallerFixture(
    undefined,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-REPLACE-FIXTURE'",
    {
      initialConfig,
      lockConfigDuringRun: true,
    },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.config).toBe(initialConfig);
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation preserves existing configuration and is idempotent", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-IDEMPOTENT-FIXTURE";
  const initialConfig =
    'model = "keep-me"\r\n\r\n[mcp_servers.keep]\r\ncommand = "keep-command"\r\n\r\n' +
    '[model_providers."eggai"] # replace this provider\r\n' +
    'base_url = "https://old.example.test/v1"\r\n\r\n' +
    '[model_providers.eggai.auth]\r\ntype = "bearer"\r\n\r\n' +
    '[model_providers.eggai.http_headers]\r\nx-old = "remove"\r\n\r\n' +
    '[model_providers.eggai.env_http_headers]\r\nx-env = "OLD_KEY"\r\n';
  const configured = runWithInstallerFixture(
    undefined,
    `-EggAi -SkKey '${fixtureKey}' -Language 'zh-cn'`,
    {
      initialConfig,
      removeBackupAfterFirstRun: true,
      runs: 2,
    },
  );

  expect(configured.results.map((result) => result.status)).toEqual([0, 0]);
  expect(configured.configs[0]).toBe(configured.configs[1]);
  expect(configured.backups).toEqual([initialConfig, undefined]);
  expect(configured.backup).toBeUndefined();
  expect(configured.config).toContain('model = "keep-me"');
  expect(configured.config).toContain('[mcp_servers.keep]');
  expect(configured.config).not.toContain('[model_providers."eggai"]');
  expect(configured.config).not.toContain("https://old.example.test/v1");
  expect(configured.config).not.toContain("model_providers.eggai.auth");
  expect(configured.config).not.toContain("model_providers.eggai.http_headers");
  expect(configured.config).not.toContain("model_providers.eggai.env_http_headers");
  expect(configured.config?.match(/^# >>> eggai-codex$/gm)).toHaveLength(1);
  expect(configured.config?.match(/^\[model_providers\.eggai\]$/gm)).toHaveLength(1);
});

test("default dry-run installs Codex without changing provider configuration", () => {
  const codexHome = unusedCodexHome();
  const result = runPowerShell(["-File", scriptPath, "-DryRun"], codexHome);

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Mode: default");
  expect(result.stdout).toContain("Would write config.toml: no");
  expect(result.stdout).toContain("Would change existing Codex login: no");
});

test("EggAi dry-run accepts generated values, redacts the key, and never creates CODEX_HOME", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-DRY-RUN-ONLY";
  const codexHome = unusedCodexHome();
  const result = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi"],
    codexHome,
    {
      BASE_URL: "https://api.example.test/v1",
      LANGUAGE: "en-us",
      SK_KEY: fixtureKey,
      MODEL: "gpt-5.6-sol",
    },
  );

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Mode: eggai");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).not.toContain(fixtureKey);
  expect(result.stdout).toContain('base_url = "https://api.example.test/v1"');
  expect(result.stdout).toContain("Respond in English by default");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would write config.toml: yes");
  expect(result.stdout).toContain("Would save EGGAI_API_KEY for provider-scoped authentication: yes");
  expect(result.stdout).toContain("Would change existing Codex login: no");
  expect(result.stdout).toContain('model = "gpt-5.6-sol"');
  expect(result.stdout).toContain('env_key = "EGGAI_API_KEY"');
  expect(result.stdout).toContain(`Backup file: ${codexHome}\\config.toml.eggai.bak`);
});

test("EggAi dry-run keeps stable defaults and reports Windows recovery paths without writes", () => {
  const codexHome = unusedCodexHome();
  const result = runPowerShell(["-File", scriptPath, "-DryRun", "-EggAi"], codexHome, {
    PATH: "",
  });

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Base URL: https://api.eggai.icu/v1");
  expect(result.stdout).toContain("Language: zh-cn");
  expect(result.stdout).toContain("API key: missing");
  expect(result.stdout).toContain("would use the official PowerShell installer directly");
  expect(result.stdout).toContain("Backup file:");
  expect(result.stdout).toContain("Would change existing Codex login: no");
});

test("EggAi dry-run rejects invalid language and Base URL before any install path", () => {
  const invalidLanguageHome = unusedCodexHome();
  const invalidBaseUrlHome = unusedCodexHome();
  const missingHostHome = unusedCodexHome();
  const userInfoHome = unusedCodexHome();
  const queryHome = unusedCodexHome();
  const fragmentHome = unusedCodexHome();
  const injectedBaseUrlHome = unusedCodexHome();
  const invalidLanguage = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-Language", "fr-fr"],
    invalidLanguageHome,
  );
  const invalidBaseUrl = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-BaseUrl", "file:///eggai"],
    invalidBaseUrlHome,
  );
  const missingHost = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-BaseUrl", "https:///v1"],
    missingHostHome,
  );
  const userInfo = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-BaseUrl", "https://reader:secret@api.example.test/v1"],
    userInfoHome,
  );
  const query = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-BaseUrl", "https://api.example.test/v1?models=1"],
    queryHome,
  );
  const fragment = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-BaseUrl", "https://api.example.test/v1#models"],
    fragmentHome,
  );
  const injectedBaseUrl = runPowerShell(
    [
      "-File",
      scriptPath,
      "-DryRun",
      "-EggAi",
      "-BaseUrl",
      'https://api.example.test/v1\nmodel_provider = "injected"',
    ],
    injectedBaseUrlHome,
  );

  expect(invalidLanguage.status).not.toBe(0);
  expect(invalidLanguage.stderr).toContain("zh-cn,en-us");
  expect(invalidLanguage.stdout).not.toContain("Checking Windows winget environment");
  expect(existsSync(invalidLanguageHome)).toBe(false);
  expect(invalidBaseUrl.status).not.toBe(0);
  expect(invalidBaseUrl.stderr).toContain("baseurl must start with http:// or https://");
  expect(invalidBaseUrl.stdout).not.toContain("Checking Windows winget environment");
  expect(existsSync(invalidBaseUrlHome)).toBe(false);
  expect(missingHost.status).not.toBe(0);
  expect(missingHost.stderr).toContain("baseurl must include a host");
  expect(existsSync(missingHostHome)).toBe(false);
  expect(userInfo.status).not.toBe(0);
  expect(userInfo.stderr).toContain("baseurl must not contain user information");
  expect(existsSync(userInfoHome)).toBe(false);
  expect(query.status).not.toBe(0);
  expect(query.stderr).toContain("baseurl must not contain a query string");
  expect(existsSync(queryHome)).toBe(false);
  expect(fragment.status).not.toBe(0);
  expect(fragment.stderr).toContain("baseurl must not contain a fragment");
  expect(existsSync(fragmentHome)).toBe(false);
  expect(injectedBaseUrl.status).not.toBe(0);
  expect(injectedBaseUrl.stderr).toContain(
    "baseurl must not contain whitespace or control characters",
  );
  expect(existsSync(injectedBaseUrlHome)).toBe(false);
});
