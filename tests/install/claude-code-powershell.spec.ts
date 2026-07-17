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
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-claude-powershell-"));
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.ps1");
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);

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
    "  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, [string]$Method, $Headers, [string]$Body, [string]$ContentType)",
    "  if ($Uri -like '*/v1/messages') {",
    "    if ($env:FAKE_GATEWAY_STATUS -and $env:FAKE_GATEWAY_STATUS -ne '200') { throw \"gateway returned $env:FAKE_GATEWAY_STATUS\" }",
    "    $content = if ($env:FAKE_GATEWAY_BODY) { $env:FAKE_GATEWAY_BODY } else { \"event: message_start`ndata: {`\"type`\":`\"message_start`\",`\"message`\":{`\"id`\":`\"msg_fixture`\"}}`n`nevent: content_block_start`ndata: {`\"type`\":`\"content_block_start`\",`\"content_block`\":{`\"type`\":`\"tool_use`\",`\"name`\":`\"eggdoc_check`\"}}`n`nevent: message_stop`ndata: {`\"type`\":`\"message_stop`\"}\" }",
    "    return [pscustomobject]@{ StatusCode = 200; Content = $content }",
    "  }",
    "  Copy-Item -LiteralPath $env:EGGDOC_CLAUDE_INSTALLER_FIXTURE -Destination $OutFile -Force",
    "}",
    `& $env:EGGDOC_CLAUDE_WRAPPER ${wrapperArguments}`,
  ].join("\n");
  const result = runPowerShell(
    ["-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")],
    {
      EGGDOC_CLAUDE_INSTALLER_FIXTURE: fixture,
      EGGDOC_NODE_BINARY: process.execPath,
      EGGDOC_CLAUDE_WRAPPER: scriptPath,
      HOME: home,
      TEMP: temporaryFiles,
      TMP: temporaryFiles,
      USERPROFILE: home,
      ...extraEnv,
    },
  );
  const settingsPath = path.join(home, ".claude", "settings.json");
  const backupPath = `${settingsPath}.eggai.bak`;
  const settings = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : undefined;
  const backup = existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined;
  const settingsAcl = existsSync(settingsPath) ? readAcl(settingsPath) : undefined;
  const backupAcl = existsSync(backupPath) ? readAcl(backupPath) : undefined;
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  rmSync(root, { force: true, recursive: true });
  return { backup, backupAcl, remainingTemporaryFiles, result, settings, settingsAcl };
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

test("Claude Code PowerShell dry-run delegates installation without changing configuration", () => {
  const result = runPowerShell(["-File", scriptPath, "-DryRun"]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Claude Code installer dry run");
  expect(result.stdout).toContain("Official installer URL: https://claude.ai/install.ps1");
  expect(result.stdout).toContain("Would install/update Claude Code: yes");
  expect(result.stdout).toContain("Would modify Claude Code configuration: no");
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

test("Claude Code PowerShell installer rejects invalid responses and preserves installer failure", () => {
  const html = runWithInstallerFixture("<!doctype html><title>Unavailable</title>\n");
  const whitespace = runWithInstallerFixture(" \n\t\n");
  const failed = runWithInstallerFixture('& "$env:ComSpec" /c "exit 42"\n', true);

  expect(html.result.status).not.toBe(0);
  expect(html.result.stderr).toContain("returned HTML instead of a script");
  expect(html.remainingTemporaryFiles).toEqual([]);
  expect(whitespace.result.status).not.toBe(0);
  expect(whitespace.result.stderr).toContain("response was empty");
  expect(whitespace.remainingTemporaryFiles).toEqual([]);
  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("Anthropic installer exited with code 42");
  expect(failed.result.stdout).not.toContain("Done: Claude Code is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code PowerShell installer verifies a successful delegated installation", () => {
  const installed = runWithInstallerFixture(`
$claudeBin = Join-Path $env:USERPROFILE ".local\\bin"
New-Item -ItemType Directory -Force -Path $claudeBin | Out-Null
Copy-Item -LiteralPath $env:EGGDOC_NODE_BINARY -Destination (Join-Path $claudeBin "claude.exe") -Force
`, false);

  expect(installed.result.status).toBe(0);
  expect(installed.result.stdout).toContain("Done: Claude Code is installed");
  expect(installed.result.stdout).toContain(process.version);
  expect(installed.settings).toBeUndefined();
  expect(installed.remainingTemporaryFiles).toEqual([]);
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

test("Claude Code PowerShell EggAi mode leaves malformed existing settings untouched", () => {
  const malformedSettings = "{not-json\n";
  const configured = runWithInstallerFixture(
    "# Keep the preinstalled Claude fixture.\n",
    true,
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-5'",
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
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-5'",
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
    "-EggAi -SkKey 'sk-EGGDOC-POWERSHELL-CONFIG' -BaseUrl 'https://api.example.test/v1' -Model 'claude-sonnet-4-5'",
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
