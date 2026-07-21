import { spawnSync } from "node:child_process";
import {
  copyFileSync,
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

const powershell = path.join(
  process.env.SystemRoot ?? "C:\\Windows",
  "System32/WindowsPowerShell/v1.0/powershell.exe",
);
const repoRoot = path.resolve(import.meta.dirname, "../..");
const scriptPath = path.join(repoRoot, "public/install/claude-code.ps1");

function runPowerShell(args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(
    powershell,
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...args],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NPM_CONFIG_REGISTRY: undefined,
        ...extraEnv,
      },
    },
  );
}

function readAcl(pathname: string) {
  const quotedPath = pathname.replaceAll("'", "''");
  return runPowerShell(["-Command", `(Get-Acl -LiteralPath '${quotedPath}').Sddl`]).stdout.trim();
}

function runWithInstallerFixture(
  installerSource: string,
  preinstallClaude = false,
  wrapperArguments = "",
  initialSettings?: string,
  extraEnv: NodeJS.ProcessEnv = {},
  options: { runs?: number; lockSettings?: boolean; removeBackupAfterFirstRun?: boolean } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-claude-powershell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.ps1");
  const registryStateLog = path.join(root, "npm-registry-state.log");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);

  const nodeMarker = path.join(root, "node-installed.marker");
  const npmLog = path.join(root, "npm.log");
  const wingetLog = path.join(root, "winget.log");
  writeFileSync(
    path.join(bin, "node.cmd"),
    [
      "@echo off",
      "set NODE_AVAILABLE=%FAKE_NODE_AVAILABLE%",
      "set NODE_MAJOR=%FAKE_NODE_MAJOR%",
      `if exist "${nodeMarker}" if not "%FAKE_NODE_REMAINS_UNAVAILABLE%"=="1" set NODE_AVAILABLE=1`,
      `if exist "${nodeMarker}" set NODE_MAJOR=22`,
      "if not \"%NODE_AVAILABLE%\"==\"1\" exit /b 65",
      "if \"%~1\"==\"-p\" echo %NODE_MAJOR%& exit /b 0",
      "if \"%~1\"==\"--version\" echo v%NODE_MAJOR%.0.0& exit /b 0",
      "exit /b 64",
      "",
    ].join("\r\n"),
  );
  writeFileSync(
    path.join(bin, "npm.cmd"),
    [
      "@echo off",
      `echo %*>>"${npmLog}"`,
      `if "%~1"=="prefix" echo ${path.join(home, ".local", "bin")}& exit /b 0`,
      "if defined FAKE_NPM_EXIT exit /b %FAKE_NPM_EXIT%",
      `"${powershell}" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${fixture}"`,
      "exit /b %ERRORLEVEL%",
      "",
    ].join("\r\n"),
  );
  writeFileSync(
    path.join(bin, "winget.cmd"),
    [
      "@echo off",
      `echo %*>>"${wingetLog}"`,
      "if defined FAKE_WINGET_EXIT exit /b %FAKE_WINGET_EXIT%",
      `type nul >"${nodeMarker}"`,
      "exit /b 0",
      "",
    ].join("\r\n"),
  );

  if (initialSettings !== undefined) {
    const claudeHome = path.join(home, ".claude");
    mkdirSync(claudeHome, { recursive: true });
    writeFileSync(path.join(claudeHome, "settings.json"), initialSettings);
  }

  if (preinstallClaude) {
    const claudeBin = path.join(home, ".local", "bin");
    mkdirSync(claudeBin, { recursive: true });
    copyFileSync(process.execPath, path.join(claudeBin, "claude.exe"));
  }

  const command = [
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, [string]$Method, $Headers, [string]$Body, [string]$ContentType, [int]$TimeoutSec)",
    "  if ($Uri -like '*/v1/messages') {",
    "    if ($env:FAKE_GATEWAY_STATUS -and $env:FAKE_GATEWAY_STATUS -ne '200') { throw \"gateway returned $env:FAKE_GATEWAY_STATUS\" }",
    "    $content = if ($env:FAKE_GATEWAY_BODY) { $env:FAKE_GATEWAY_BODY } else { \"event: message_start`ndata: {`\"type`\":`\"message_start`\",`\"message`\":{`\"id`\":`\"msg_fixture`\"}}`n`nevent: content_block_start`ndata: {`\"type`\":`\"content_block_start`\",`\"content_block`\":{`\"type`\":`\"tool_use`\",`\"name`\":`\"eggdoc_check`\"}}`n`nevent: message_stop`ndata: {`\"type`\":`\"message_stop`\"}\" }",
    "    return [pscustomobject]@{ StatusCode = 200; Content = $content }",
    "  }",
    "  throw 'Unexpected web request'",
    "}",
    "$settingsLock = $null",
    "if ($env:EGGDOC_LOCK_SETTINGS) {",
    "  $settingsLock = [IO.File]::Open($env:EGGDOC_SETTINGS_PATH, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)",
    "}",
    "try {",
    `  & $env:EGGDOC_CLAUDE_WRAPPER ${wrapperArguments}`,
    "} finally {",
    "  $registryState = if (Test-Path Env:NPM_CONFIG_REGISTRY) { 'exists:' + $env:NPM_CONFIG_REGISTRY } else { 'missing' }",
    "  [IO.File]::WriteAllText($env:EGGDOC_NPM_REGISTRY_STATE_LOG, $registryState)",
    "  if ($settingsLock) { $settingsLock.Dispose() }",
    "}",
  ].join("\n");
  const results = [];
  const backups: Array<string | undefined> = [];
  const settingsSnapshots: Array<string | undefined> = [];
  for (let run = 0; run < (options.runs ?? 1); run += 1) {
    results.push(
      runPowerShell(
        ["-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
        {
          EGGDOC_CLAUDE_INSTALLER_FIXTURE: fixture,
          EGGDOC_CLAUDE_WRAPPER: scriptPath,
          EGGDOC_CLAUDE_ENV_SCOPE: "Process",
          EGGDOC_CLAUDE_PATH_SCOPE: "Process",
          EGGDOC_LOCK_SETTINGS: options.lockSettings ? "1" : undefined,
          EGGDOC_NODE_BINARY: process.execPath,
          EGGDOC_NODE_INSTALL_DIR: path.join(root, "program-files", "nodejs"),
          EGGDOC_NPM_REGISTRY_STATE_LOG: registryStateLog,
          EGGDOC_SETTINGS_PATH: path.join(home, ".claude", "settings.json"),
          FAKE_NODE_AVAILABLE: "1",
          FAKE_NODE_MAJOR: "22",
          HOME: home,
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
          ProgramFiles: path.join(root, "program-files"),
          TEMP: temporaryFiles,
          TMP: temporaryFiles,
          USERPROFILE: home,
          ...extraEnv,
        },
      ),
    );
    const snapshotSettingsPath = path.join(home, ".claude", "settings.json");
    const snapshotBackupPath = `${snapshotSettingsPath}.eggai.bak`;
    settingsSnapshots.push(
      existsSync(snapshotSettingsPath) ? readFileSync(snapshotSettingsPath, "utf8") : undefined,
    );
    backups.push(existsSync(snapshotBackupPath) ? readFileSync(snapshotBackupPath, "utf8") : undefined);
    if (run === 0 && options.removeBackupAfterFirstRun) {
      rmSync(snapshotBackupPath, { force: true });
    }
  }
  const settingsPath = path.join(home, ".claude", "settings.json");
  const backupPath = `${settingsPath}.eggai.bak`;
  const settings = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : undefined;
  const backup = existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined;
  const settingsAcl = existsSync(settingsPath) ? readAcl(settingsPath) : undefined;
  const backupAcl = existsSync(backupPath) ? readAcl(backupPath) : undefined;
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  const registryState = existsSync(registryStateLog)
    ? readFileSync(registryStateLog, "utf8")
    : undefined;
  const npmCommands = existsSync(npmLog) ? readFileSync(npmLog, "utf8") : "";
  const wingetCommands = existsSync(wingetLog) ? readFileSync(wingetLog, "utf8") : "";
  rmSync(root, { force: true, recursive: true });
  return {
    backup,
    backupAcl,
    backups,
    npmCommands,
    remainingTemporaryFiles,
    registryState,
    result: results.at(-1)!,
    results,
    settings,
    settingsAcl,
    settingsSnapshots,
    wingetCommands,
  };
}

test("the hosted Claude Code PowerShell installer has valid syntax", () => {
  const result = runPowerShell([
    "-Command",
    "$tokens = $null; $errors = $null; " +
      "[Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'public/install/claude-code.ps1'), [ref]$tokens, [ref]$errors) | Out-Null; " +
      "if ($errors.Count -gt 0) { $errors | ForEach-Object { [Console]::Error.WriteLine($_.Message) }; exit 1 }",
  ]);

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test("Claude Code PowerShell dry-run returns control to the caller", () => {
  const quotedScriptPath = scriptPath.replaceAll("'", "''");
  const result = runPowerShell([
    "-Command",
    `& ([scriptblock]::Create([IO.File]::ReadAllText('${quotedScriptPath}'))) -DryRun; Write-Output 'CALLER_CONTINUED'`,
  ]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("CALLER_CONTINUED");
});

test("Claude Code PowerShell dry-run delegates installation without changing configuration", () => {
  const result = runPowerShell(["-File", scriptPath, "-DryRun"]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Claude Code installer dry run");
  expect(result.stdout).toContain("Node.js requirement: >=22");
  expect(result.stdout).toContain("Node.js automatic install: winget OpenJS.NodeJS.LTS");
  expect(result.stdout).toContain("npm package: @anthropic-ai/claude-code@latest");
  expect(result.stdout).toContain("npm registry: https://registry.npmmirror.com");
  expect(result.stdout).toContain("PATH persistence scope: User");
  expect(result.stdout).toContain("Would install/update Claude Code: yes");
  expect(result.stdout).toContain("Would modify Claude Code configuration: no");
});

test("Claude Code PowerShell rejects an invalid EggAi gateway timeout", () => {
  const result = runPowerShell(["-File", scriptPath, "-DryRun", "-EggAi"], {
    EGGDOC_GATEWAY_TIMEOUT_SECONDS: "0",
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer");
});

test("Claude Code PowerShell EggAi dry-run validates inputs and redacts the credential", () => {
  const result = runPowerShell([
    "-File",
    scriptPath,
    "-DryRun",
    "-EggAi",
    "-SkKey",
    "sk-EGGDOC-POWERSHELL-SECRET",
    "-BaseUrl",
    "https://api.example.test/v1",
    "-Model",
    "claude-sonnet-5",
    "-OpusModel",
    "claude-opus-4-8",
    "-SonnetModel",
    "claude-sonnet-5",
    "-HaikuModel",
    "claude-haiku-4-5",
    "-FableModel",
    "claude-fable-5",
  ]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Mode: eggai");
  expect(result.stdout).toContain("Anthropic Base URL: https://api.example.test");
  expect(result.stdout).toContain("Opus model: claude-opus-4-8");
  expect(result.stdout).toContain("Haiku model: claude-haiku-4-5");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).toContain("Would modify Claude Code configuration: yes");
  expect(result.stdout).not.toContain("sk-EGGDOC-POWERSHELL-SECRET");

  const unsafeUrl = runPowerShell([
    "-File",
    scriptPath,
    "-EggAi",
    "-SkKey",
    "secret",
    "-BaseUrl",
    "http://unsafe.test",
  ]);
  const missingKey = runPowerShell([
    "-File",
    scriptPath,
    "-EggAi",
    "-BaseUrl",
    "https://api.example.test/v1",
  ]);
  expect(unsafeUrl.status).not.toBe(0);
  expect(missingKey.status).not.toBe(0);

  const unsupportedModel = runPowerShell([
    "-File",
    scriptPath,
    "-DryRun",
    "-EggAi",
    "-SkKey",
    "secret",
    "-BaseUrl",
    "https://api.example.test/v1",
    "-Model",
    "claude-sonnet-4-8",
  ]);
  expect(unsupportedModel.status).not.toBe(0);
  expect(unsupportedModel.stderr).toContain("is not a supported EggAi Claude model");

  for (const invalidBaseUrl of [
    "https://reader:secret@api.example.test/v1",
    "https://api.example.test/v1?models=1",
    "https://api.example.test/v1#models",
  ]) {
    const invalid = runPowerShell([
      "-File",
      scriptPath,
      "-DryRun",
      "-EggAi",
      "-SkKey",
      "secret",
      "-BaseUrl",
      invalidBaseUrl,
      "-Model",
      "claude-sonnet-5",
    ]);
    expect(invalid.status).not.toBe(0);
    expect(invalid.stderr).toMatch(/baseurl must not contain user information|baseurl must not contain a query string|baseurl must not contain a fragment/);
  }
});

test("Claude Code PowerShell installer accepts official release channels and rejects script input", () => {
  const stable = runPowerShell(["-File", scriptPath, "-DryRun", "-Version", "stable"]);
  const version = runPowerShell(["-File", scriptPath, "-DryRun", "-Version", "2.1.89"]);
  const unsafe = runPowerShell([
    "-File",
    scriptPath,
    "-DryRun",
    "-Version",
    "latest; exit 0",
  ]);

  expect(stable.status).toBe(0);
  expect(stable.stdout).toContain("Release: stable");
  expect(version.status).toBe(0);
  expect(version.stdout).toContain("Release: 2.1.89");
  expect(unsafe.status).not.toBe(0);
  expect(unsafe.stderr).toContain("version must be latest, stable, or a numeric dotted version");
});

test("Claude Code PowerShell preserves an npm installation failure", () => {
  const failed = runWithInstallerFixture("exit 42\n", true);

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("npm could not install @anthropic-ai/claude-code");
  expect(failed.result.stderr).toContain("exit code 42");
  expect(failed.result.stdout).not.toContain("Done: Claude Code is installed");
  expect(failed.registryState).toBe("missing");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code PowerShell installer verifies a successful npm installation", () => {
  const installed = runWithInstallerFixture(`
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`, false);

  expect(installed.result.status).toBe(0);
  expect(installed.result.stdout).toContain("Done: Claude Code is installed");
  expect(installed.result.stdout).toContain(process.version);
  expect(installed.settings).toBeUndefined();
  expect(installed.wingetCommands).toBe("");
  expect(installed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code PowerShell automatically installs missing or outdated Node.js with exact winget identity", () => {
  const installer = `
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`;
  const missing = runWithInstallerFixture(installer, false, "", undefined, {
    FAKE_NODE_AVAILABLE: "0",
  });
  const outdated = runWithInstallerFixture(installer, false, "", undefined, {
    FAKE_NODE_MAJOR: "18",
  });

  for (const installed of [missing, outdated]) {
    expect(installed.result.status, installed.result.stderr).toBe(0);
    expect(installed.wingetCommands).toContain("install --id OpenJS.NodeJS.LTS --exact --source winget");
    expect(installed.npmCommands).toContain("@anthropic-ai/claude-code@latest");
  }
});

test("Claude Code PowerShell reports winget and post-install Node verification failures", () => {
  const wingetFailed = runWithInstallerFixture("exit 0\n", false, "", undefined, {
    FAKE_NODE_AVAILABLE: "0",
    FAKE_WINGET_EXIT: "23",
  });
  const verificationFailed = runWithInstallerFixture("exit 0\n", false, "", undefined, {
    FAKE_NODE_AVAILABLE: "0",
    FAKE_NODE_REMAINS_UNAVAILABLE: "1",
  });

  expect(wingetFailed.result.status).not.toBe(0);
  expect(wingetFailed.result.stderr).toContain("winget could not install the official Node.js LTS package (exit code 23)");
  expect(wingetFailed.npmCommands).toBe("");
  expect(verificationFailed.result.status).not.toBe(0);
  expect(verificationFailed.result.stderr).toContain("Node.js 22 or newer and npm.cmd are required");
  expect(verificationFailed.result.stderr).toContain("verification failed after winget instal");
  expect(verificationFailed.npmCommands).toBe("");
});

test("Claude Code PowerShell scopes the mainland registry to npm", () => {
  const installed = runWithInstallerFixture(`
if ($env:NPM_CONFIG_REGISTRY -cne "https://registry.npmmirror.com") { exit 78 }
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`);
  const failed = runWithInstallerFixture(
    'if ($env:NPM_CONFIG_REGISTRY -cne "https://registry.npmmirror.com") { exit 78 }; exit 42',
    true,
  );

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.registryState).toBe("missing");
  expect(installed.npmCommands).toContain("install --global @anthropic-ai/claude-code@latest");
  expect(installed.npmCommands).toContain("--registry https://registry.npmmirror.com");
  expect(installed.npmCommands).toContain("--include=optional --no-audit --no-fund");
  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("npm could not install @anthropic-ai/claude-code");
  expect(failed.registryState).toBe("missing");
});

test("Claude Code PowerShell restores an existing npm registry after success and failure", () => {
  const previousRegistry = "https://registry.example.test/custom";
  const installed = runWithInstallerFixture(
    `
if ($env:NPM_CONFIG_REGISTRY -cne "${previousRegistry}") { exit 78 }
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`,
    false,
    "",
    undefined,
    { NPM_CONFIG_REGISTRY: previousRegistry },
  );
  const failed = runWithInstallerFixture(
    `if ($env:NPM_CONFIG_REGISTRY -cne "${previousRegistry}") { exit 78 }; exit 42`,
    true,
    "",
    undefined,
    { NPM_CONFIG_REGISTRY: previousRegistry },
  );

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.registryState).toBe(`exists:${previousRegistry}`);
  expect(failed.result.status).not.toBe(0);
  expect(failed.registryState).toBe(`exists:${previousRegistry}`);
});

test("Claude Code PowerShell EggAi mode preserves existing settings and creates a backup", () => {
  const initialSettings = JSON.stringify({
    env: { KEEP_ME: "yes", ANTHROPIC_API_KEY: "old-key" },
    permissions: { allow: ["Read"] },
  });
  const configured = runWithInstallerFixture(
    `
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`,
    false,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-5' -OpusModel 'claude-opus-4-8' -SonnetModel 'claude-sonnet-5' -HaikuModel 'claude-haiku-4-5' -FableModel 'claude-fable-5'",
    initialSettings,
  );

  expect(configured.result.status, configured.result.stderr).toBe(0);
  expect(configured.result.stdout).not.toContain("sk-EGGDOC-POWERSHELL-CONFIG");
  expect(configured.backup).toBe(initialSettings);
  expect(configured.backupAcl).toBe(configured.settingsAcl);
  expect(JSON.parse((configured.settings ?? "").replace(/^\uFEFF/, ""))).toEqual({
    env: {
      ANTHROPIC_AUTH_TOKEN: "sk-EGGDOC-POWERSHELL-CONFIG",
      ANTHROPIC_BASE_URL: "https://api.example.test",
      ANTHROPIC_DEFAULT_FABLE_MODEL: "claude-fable-5",
      ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5",
      ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4-8",
      ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-5",
      ANTHROPIC_MODEL: "claude-sonnet-5",
      KEEP_ME: "yes",
    },
    permissions: { allow: ["Read"] },
  });
});

test("Claude Code PowerShell EggAi mode is idempotent and does not recreate a removed backup", () => {
  const initialSettings = JSON.stringify({ env: { KEEP_ME: "yes" } });
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-IDEMPOTENT' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-6'",
    initialSettings,
    {},
    { runs: 2, removeBackupAfterFirstRun: true },
  );

  expect(configured.results.map((result) => result.status)).toEqual([0, 0]);
  expect(configured.settingsSnapshots[0]).toBe(configured.settingsSnapshots[1]);
  expect(configured.backups).toEqual([initialSettings, undefined]);
  expect(configured.backup).toBeUndefined();
  expect(configured.result.stdout).toContain("Backup: unchanged (configuration already current)");
});

test("Claude Code PowerShell leaves the original settings intact when atomic replacement fails", () => {
  const initialSettings = JSON.stringify({ env: { KEEP_ME: "yes" } });
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-LOCKED' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-6'",
    initialSettings,
    {},
    { lockSettings: true },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.settings).toBe(initialSettings);
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code PowerShell EggAi mode leaves malformed existing settings untouched", () => {
  const malformedSettings = "{not-json\n";
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-6'",
    malformedSettings,
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.settings).toBe(malformedSettings);
  expect(configured.backup).toBeUndefined();
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
});

test("Claude Code PowerShell EggAi mode stops before installation when the gateway rejects the credential", () => {
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-6'",
    undefined,
    { FAKE_GATEWAY_STATUS: "401" },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("could not verify the EggAi gateway");
  expect(configured.result.stdout).not.toContain("Installing or updating Claude Code");
  expect(configured.settings).toBeUndefined();
});

test("Claude Code PowerShell EggAi mode rejects a non-Anthropic success response", () => {
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-6'",
    undefined,
    {
      FAKE_GATEWAY_BODY:
        'event: message_start\ndata: {"type":"wrong","message":{"id":"msg_fake"}}\n' +
        'event: content_block_start\ndata: {"type":"wrong","content_block":{"type":"tool_use","name":"eggdoc_check"}}\n' +
        'event: message_stop\ndata: {"type":"message_stop"}',
    },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("did not return a valid streaming Anthropic tool-use response");
  expect(configured.settings).toBeUndefined();
});
