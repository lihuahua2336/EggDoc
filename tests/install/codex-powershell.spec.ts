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

import {
  buildPowerShellDefaultInstallCommand,
  buildPowerShellInstallCommand,
} from "../../src/lib/codex/configuration";

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
        EGGAI_API_KEY: undefined,
        LANGUAGE: undefined,
        MODEL: undefined,
        NPM_CONFIG_REGISTRY: undefined,
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

function runWithStoreFixture(
  wrapperArguments = "",
  options: {
    extraEnv?: NodeJS.ProcessEnv;
    initialConfig?: string;
    lockConfigDuringRun?: boolean;
    packageInstalled?: boolean;
    removeBackupAfterFirstRun?: boolean;
    runs?: number;
    wingetAvailable?: boolean;
  } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-codex-powershell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const wingetLog = path.join(root, "winget.log");
  const packageMarker = path.join(root, "codex-package-installed");
  const environmentStateLog = path.join(root, "environment-state.log");
  const codexHome = path.join(home, ".codex");
  const configPath = path.join(codexHome, "config.toml");
  const backupPath = `${configPath}.eggai.bak`;
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  if (options.packageInstalled !== false) {
    writeFileSync(packageMarker, "installed");
  }

  if (options.initialConfig !== undefined) {
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(configPath, options.initialConfig);
  }

  if (options.wingetAvailable !== false) {
    writeFileSync(
      path.join(bin, "winget.cmd"),
      `@echo off\r
echo %*>>"%FAKE_WINGET_LOG%"\r
if defined FAKE_WINGET_EXIT exit /b %FAKE_WINGET_EXIT%\r
if not defined FAKE_SKIP_PACKAGE_MARKER echo installed>"%FAKE_CODEX_PACKAGE_MARKER%"\r
exit /b 0\r
`,
    );
  }

  const command = [
    "function global:Get-AppxPackage {",
    "  [CmdletBinding()] param([string]$Name)",
    "  if (Test-Path -LiteralPath $env:FAKE_CODEX_PACKAGE_MARKER) {",
    "    return [pscustomobject]@{ Name = 'OpenAI.Codex'; PackageFamilyName = 'OpenAI.Codex_2p2nqsd0c76g0'; Version = [version]'26.715.4045.0' }",
    "  }",
    "}",
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, [string]$Method, $Headers, [string]$Body, [string]$ContentType, [int]$TimeoutSec)",
    "  if ($Uri -like '*/models') {",
    "    $status = if ($env:FAKE_MODELS_STATUS) { [int]$env:FAKE_MODELS_STATUS } else { 200 }",
    "    return [pscustomobject]@{ StatusCode = $status; Content = '{\"data\":[{\"id\":\"gpt-5.6-sol\"}]}' }",
    "  }",
    "  if ($Uri -like '*/responses') {",
    "    $status = if ($env:FAKE_RESPONSES_STATUS) { [int]$env:FAKE_RESPONSES_STATUS } else { 200 }",
    "    return [pscustomobject]@{ StatusCode = $status; Content = '{\"id\":\"resp_fixture\"}' }",
    "  }",
    "  throw \"Unexpected request: $Uri\"",
    "}",
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
          EGGDOC_CODEX_WRAPPER: scriptPath,
          EGGDOC_ENV_STATE_LOG: environmentStateLog,
          EGGAI_CODEX_ENV_SCOPE: "Process",
          EGGDOC_CONFIG_PATH: configPath,
          EGGDOC_LOCK_CONFIG: options.lockConfigDuringRun ? "1" : undefined,
          FAKE_CODEX_PACKAGE_MARKER: packageMarker,
          FAKE_WINGET_LOG: wingetLog,
          HOME: home,
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
  const environmentState = existsSync(environmentStateLog)
    ? readFileSync(environmentStateLog, "utf8")
    : undefined;
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  const wingetCommands = existsSync(wingetLog) ? readFileSync(wingetLog, "utf8") : "";
  rmSync(root, { force: true, recursive: true });
  return {
    backup,
    backups,
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

test("generated PowerShell bootstrap retries in isolation and returns control to the caller", () => {
  const command = buildPowerShellDefaultInstallCommand("https://docs.example.test/root");
  const harness = [
    "$script:attempts = 0",
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [int]$TimeoutSec, [switch]$UseBasicParsing)",
    "  $script:attempts += 1",
    "  if ($script:attempts -lt 3) { throw 'fixture transport failure' }",
    "  [IO.File]::WriteAllText($OutFile, 'exit 0')",
    "}",
    command,
    "Write-Output \"ATTEMPTS:$script:attempts\"",
    "Write-Output 'CALLER_CONTINUED'",
  ].join("\n");
  const result = runPowerShell([
    "-EncodedCommand",
    Buffer.from(harness, "utf16le").toString("base64"),
  ]);

  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain("ATTEMPTS:3");
  expect(result.stdout).toContain("CALLER_CONTINUED");
});

test("generated PowerShell bootstrap rejects an empty successful response", () => {
  const command = buildPowerShellDefaultInstallCommand("https://docs.example.test/root");
  const harness = [
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [int]$TimeoutSec, [switch]$UseBasicParsing)",
    "  [IO.File]::WriteAllText($OutFile, '')",
    "}",
    command,
  ].join("\n");
  const result = runPowerShell([
    "-EncodedCommand",
    Buffer.from(harness, "utf16le").toString("base64"),
  ]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("EggDoc installer response was empty");
});

test("Codex PowerShell dry-run returns control to the caller", () => {
  const codexHome = unusedCodexHome();
  const quotedScriptPath = scriptPath.replaceAll("'", "''");
  const result = runPowerShell(
    [
      "-Command",
      `& ([scriptblock]::Create([IO.File]::ReadAllText('${quotedScriptPath}'))) -DryRun; Write-Output 'CALLER_CONTINUED'`,
    ],
    codexHome,
  );

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("CALLER_CONTINUED");
});

test("default installation updates an existing official Codex desktop app", () => {
  const installed = runWithStoreFixture();

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.wingetCommands).toContain(
    "upgrade --id 9PLM9XGG6VKS --exact --source msstore",
  );
  expect(installed.result.stdout).toContain("Codex desktop app 26.715.4045.0");
  expect(installed.result.stdout).toContain("Done: Codex desktop app is installed");
  expect(installed.config).toBeUndefined();
});

test("default installation reports Microsoft Store update failures", () => {
  const failed = runWithStoreFixture("", {
    extraEnv: { FAKE_WINGET_EXIT: "24" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.wingetCommands).toContain(
    "upgrade --id 9PLM9XGG6VKS --exact --source msstore",
  );
  expect(failed.result.stderr).toContain("Microsoft Store could not upgrade");
  expect(failed.result.stdout).not.toContain("Done: Codex desktop app is installed");
});

test("default installation accepts winget's no-applicable-upgrade result", () => {
  const current = runWithStoreFixture("", {
    extraEnv: { FAKE_WINGET_EXIT: "-1978335189" },
  });

  expect(current.result.status, current.result.stderr).toBe(0);
  expect(current.wingetCommands).toContain(
    "upgrade --id 9PLM9XGG6VKS --exact --source msstore",
  );
  expect(current.result.stdout).toContain("Codex desktop app is already up to date");
  expect(current.result.stdout).toContain("Done: Codex desktop app is installed");
});

test("default installation uses the exact official Microsoft Store product", () => {
  const installed = runWithStoreFixture("", { packageInstalled: false });

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.wingetCommands).toContain("install --id 9PLM9XGG6VKS --exact --source msstore");
  expect(installed.result.stdout).toContain("Codex desktop app 26.715.4045.0");
  expect(installed.remainingTemporaryFiles).toEqual([]);
});

test("default installation reports Microsoft Store failures without another source", () => {
  const failed = runWithStoreFixture("", {
    extraEnv: { FAKE_WINGET_EXIT: "23" },
    packageInstalled: false,
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.wingetCommands).toContain("install --id 9PLM9XGG6VKS --exact --source msstore");
  expect(failed.result.stderr).toContain("Microsoft Store could not install");
  expect(failed.result.stdout).not.toContain("Done: Codex desktop app is installed");
});

test("default installation requires winget when the desktop app is missing", () => {
  const failed = runWithStoreFixture("", {
    packageInstalled: false,
    wingetAvailable: false,
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("winget is required");
  expect(failed.result.stderr).toContain("9PLM9XGG6VKS");
});

test("EggAi installation verifies the endpoint before checking the desktop app", () => {
  const failed = runWithStoreFixture(
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-ENDPOINT-FAILURE' -Model 'gpt-5.6-sol'",
    { extraEnv: { FAKE_MODELS_STATUS: "503" } },
  );

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("EggAi Codex endpoint verification returned HTTP 503");
  expect(failed.result.stdout).toContain("Verifying the EggAi Codex endpoint");
  expect(failed.result.stdout).not.toContain("Installing the Codex desktop app");
});

test("EggAi installation verifies the selected model before checking the desktop app", () => {
  const failed = runWithStoreFixture(
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-MODEL-FAILURE' -Model 'gpt-5.6-sol'",
    { extraEnv: { FAKE_RESPONSES_STATUS: "404" } },
  );

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("EggAi model verification returned HTTP 404");
  expect(failed.result.stdout).not.toContain("Installing the Codex desktop app");
});

test("EggAi installation configures provider-scoped authentication without changing Codex login", () => {
  const fixtureKey = "sk-EGGDOC-POWERSHELL-INSTALL-FIXTURE";
  const configured = runWithStoreFixture(
    `-EggAi -SkKey '${fixtureKey}' -BaseUrl 'https://api.example.test/v1' -Language 'en-us' -Model 'gpt-5.6-sol'`,
    { extraEnv: { EGGAI_CODEX_ENV_SCOPE: "Process" } },
  );

  expect(configured.result.status, configured.result.stderr).toBe(0);
  expect(configured.result.stdout).toContain("Done: Codex desktop app is installed and configured to use EggAi");
  expect(configured.result.stdout).toContain("Codex desktop app 26.715.4045.0");
  expect(configured.result.stdout).toContain("Restart the Codex desktop app");
  expect(configured.result.stdout).not.toContain(fixtureKey);
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
  const configured = runWithStoreFixture(
    `-EggAi -SkKey '${fixtureKey}' -Model 'gpt-5.6-sol'`,
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
    `${configured.result.stdout}\n${configured.result.stderr}`,
  ).not.toBe(0);
  expect(configured.result.stderr).toContain("forced EGGAI_API_KEY verification failure");
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(configured.config).toBe(initialConfig);
  expect(configured.backup).toBe(initialConfig);
  expect(configured.environmentState).toBe("exists:sk-EGGDOC-PREVIOUS-KEY");
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation removes the new API key when no previous value existed", () => {
  const configured = runWithStoreFixture(
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-NEW-KEY' -Model 'gpt-5.6-sol'",
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
  const configured = runWithStoreFixture(
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-REPLACE-FIXTURE' -Model 'gpt-5.6-sol'",
    {
      initialConfig,
      lockConfigDuringRun: true,
    },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.config).toBe(initialConfig);
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
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
  const configured = runWithStoreFixture(
    `-EggAi -SkKey '${fixtureKey}' -Language 'zh-cn' -Model 'gpt-5.6-sol'`,
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
  expect(configured.config).toContain('model = "gpt-5.6-sol"');
  expect(configured.config).not.toContain('model = "keep-me"');
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
  expect(result.stdout).toContain("Microsoft Store product ID: 9PLM9XGG6VKS");
  expect(result.stdout).toContain("Expected package family: OpenAI.Codex_2p2nqsd0c76g0");
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
  expect(result.stdout).toContain("Would ensure Codex desktop app is installed: yes");
  expect(result.stdout).toContain("Would write config.toml: yes");
  expect(result.stdout).toContain("Would save EGGAI_API_KEY for provider-scoped authentication: yes");
  expect(result.stdout).toContain("Would change existing Codex login: no");
  expect(result.stdout).toContain('model = "gpt-5.6-sol"');
  expect(result.stdout).toContain('env_key = "EGGAI_API_KEY"');
  expect(result.stdout).toContain(`Backup file: ${codexHome}\\config.toml.eggai.bak`);
});

test("EggAi mode requires an explicit Codex model", () => {
  const codexHome = unusedCodexHome();
  const result = runPowerShell(
    [
      "-File",
      scriptPath,
      "-DryRun",
      "-EggAi",
      "-SkKey",
      "sk-EGGDOC-POWERSHELL-MISSING-MODEL",
    ],
    codexHome,
  );

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("model is required with EggAi mode");
  expect(result.stdout).not.toContain("Would ensure Codex desktop app is installed");
  expect(existsSync(codexHome)).toBe(false);
});

test("EggAi dry-run keeps stable defaults and reports Windows recovery paths without writes", () => {
  const codexHome = unusedCodexHome();
  const result = runPowerShell(
    ["-File", scriptPath, "-DryRun", "-EggAi", "-Model", "gpt-5.6-sol"],
    codexHome,
    { PATH: "" },
  );

  expect(existsSync(codexHome)).toBe(false);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Base URL: https://api.eggai.icu/v1");
  expect(result.stdout).toContain("Language: zh-cn");
  expect(result.stdout).toContain("API key: missing");
  expect(result.stdout).toContain("Microsoft Store product 9PLM9XGG6VKS (OpenAI)");
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
