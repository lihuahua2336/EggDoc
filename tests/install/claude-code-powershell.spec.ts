import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
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

function runWithInstallerFixture(installerSource: string, preinstallClaude = false) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-claude-powershell-"));
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.ps1");
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);

  if (preinstallClaude) {
    const claudeBin = path.join(home, ".local", "bin");
    mkdirSync(claudeBin, { recursive: true });
    copyFileSync(process.execPath, path.join(claudeBin, "claude.exe"));
  }

  const command = [
    "function global:Invoke-WebRequest {",
    "  param([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing)",
    "  Copy-Item -LiteralPath $env:EGGDOC_CLAUDE_INSTALLER_FIXTURE -Destination $OutFile -Force",
    "}",
    "& $env:EGGDOC_CLAUDE_WRAPPER",
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
    },
  );
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  rmSync(root, { force: true, recursive: true });
  return { remainingTemporaryFiles, result };
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
  expect(installed.remainingTemporaryFiles).toEqual([]);
});
