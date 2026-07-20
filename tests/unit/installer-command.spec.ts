import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  buildPowerShellInstallerCommand,
  buildShellInstallerCommand,
} from "../../src/lib/installer-command";
import { buildPowerShellInstallCommand } from "../../src/lib/codex/configuration";

const shell =
  process.platform === "win32" && existsSync("C:\\Program Files\\Git\\usr\\bin\\sh.exe")
    ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe"
    : "sh";
const shellToolPath =
  process.platform === "win32"
    ? `C:\\Program Files\\Git\\usr\\bin;C:\\Program Files\\Git\\bin;${process.env.PATH ?? ""}`
    : process.env.PATH ?? "";

test("Shell bootstrap rejects an empty response, cleans up, and preserves caller traps", () => {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-bootstrap-"));
  const fakeCurl = path.join(root, process.platform === "win32" ? "curl" : "curl");
  const outputLog = path.join(root, "output-path.txt");
  writeFileSync(
    fakeCurl,
    `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
printf '%s' "\${FAKE_BODY:-}" > "$output"
printf '%s' "$output" > "$FAKE_OUTPUT_LOG"
`,
  );
  chmodSync(fakeCurl, 0o755);

  try {
    for (const { body, message } of [
      { body: "", message: "EggDoc installer response was empty" },
      { body: "  <html>Unavailable</html>", message: "returned HTML instead of a script" },
    ]) {
      for (const scriptUrl of [
        "https://docs.example.test/install/codex.sh",
        "https://docs.example.test/install/claude-code.sh",
      ]) {
        const command = buildShellInstallerCommand({ scriptUrl });
        const result = spawnSync(
          shell,
          [
            "-c",
            `trap 'echo ORIGINAL_TRAP >&2' 0; ${command}; status=$?; exit $status`,
          ],
          {
            encoding: "utf8",
            env: {
              ...process.env,
              FAKE_BODY: body,
              FAKE_OUTPUT_LOG: outputLog,
              PATH: `${root}${path.delimiter}${shellToolPath}`,
            },
          },
        );

        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain(message);
        expect(result.stderr).toContain("ORIGINAL_TRAP");
        expect(existsSync(readFileSync(outputLog, "utf8"))).toBe(false);
      }
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("Shell bootstrap can load the configured provider key into the caller", () => {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-bootstrap-success-"));
  const home = path.join(root, "home");
  const fakeCurl = path.join(root, "curl");
  writeFileSync(
    fakeCurl,
    `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    *) shift ;;
  esac
done
printf '%s' "$FAKE_BODY" > "$output"
`,
  );
  chmodSync(fakeCurl, 0o755);

  try {
    const command = buildShellInstallerCommand({
      scriptUrl: "https://docs.example.test/install/codex.sh",
      successCommand: '. "$HOME/.codex/eggai.env"',
    });
    const result = spawnSync(shell, ["-c", `${command}; printf 'KEY:%s' "$EGGAI_API_KEY"`], {
      encoding: "utf8",
      env: {
        ...process.env,
        FAKE_BODY:
          '#!/bin/sh\nmkdir -p "$HOME/.codex"\nprintf \'EGGAI_API_KEY=%s\\nexport EGGAI_API_KEY\\n\' \'sk-EGGDOC-CURRENT-SHELL\' > "$HOME/.codex/eggai.env"\n',
        HOME: home,
        PATH: `${root}${path.delimiter}${shellToolPath}`,
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("KEY:sk-EGGDOC-CURRENT-SHELL");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("PowerShell bootstrap retries, validates content, isolates execution, and cleans up", () => {
  const command = buildPowerShellInstallerCommand({
    argumentsText: "-EggAi -Model 'gpt-5.6-sol'",
    scriptUrl: "https://docs.example.test/install/codex.ps1",
  });

  expect(command).toContain("foreach ($eggdocAttempt in 1..3)");
  expect(command).toContain("-OutFile $eggdocInstaller -TimeoutSec 120");
  expect(command).toContain("IsNullOrWhiteSpace($eggdocSource)");
  expect(command).toContain("returned HTML instead of a script");
  expect(command).toContain("$eggdocChildCommand='& ' + $eggdocQuotedInstaller");
  expect(command).toContain("-EggAi -Model ''gpt-5.6-sol''");
  expect(command).toContain("-EncodedCommand',$eggdocEncodedCommand");
  expect(command).toContain("$eggdocProcess.ExitCode");
  expect(command).toContain("finally { Remove-Item");
  expect(command).toMatch(/^& \{ /);
  expect(command).not.toContain("$global:LASTEXITCODE");
  expect(command).not.toContain("Invoke-Expression");
  expect(command).not.toContain("ScriptBlock");
});

test("PowerShell Codex bootstrap preserves caller variables, environment, and exit status", () => {
  test.skip(process.platform !== "win32", "PowerShell session isolation is Windows-specific");

  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-powershell-scope-"));
  const installerSource = path.join(root, "installer.ps1");
  const resultPath = path.join(root, "arguments.json");
  const resultLiteral = resultPath.replace(/'/g, "''");
  writeFileSync(
    installerSource,
    `param([switch]$EggAi, [string]$SkKey, [string]$BaseUrl, [string]$Language, [string]$Model)\n` +
      `[pscustomobject]@{ EggAi=[bool]$EggAi; SkKey=$SkKey; BaseUrl=$BaseUrl; Language=$Language; Model=$Model } | ` +
      `ConvertTo-Json -Compress | Set-Content -LiteralPath '${resultLiteral}' -Encoding UTF8\n` +
      "exit 0\n",
  );

  const command = buildPowerShellInstallCommand({
    apiKey: "sk-reader's-$HOME; `exit`",
    baseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
    installerOrigin: "https://docs.example.test",
    language: "zh-cn",
    model: "gpt-5.6-sol",
  });
  const sourceLiteral = installerSource.replace(/'/g, "''");
  const script = [
    `$source='${sourceLiteral}'`,
    "function Invoke-WebRequest { param($Uri, $OutFile); Copy-Item -LiteralPath $source -Destination $OutFile }",
    "$env:EGGAI_CODEX_ENV_SCOPE='OriginalScope'",
    "$global:LASTEXITCODE=73",
    "$beforeVariables=@(Get-Variable -Name 'eggdoc*' -Scope Local -ErrorAction SilentlyContinue).Count",
    command,
    "$afterVariables=@(Get-Variable -Name 'eggdoc*' -Scope Local -ErrorAction SilentlyContinue).Count",
    "Write-Output ('SCOPE:' + $env:EGGAI_CODEX_ENV_SCOPE)",
    "Write-Output ('EXIT:' + $LASTEXITCODE)",
    "Write-Output ('VARIABLES:' + ($afterVariables - $beforeVariables))",
  ].join("; ");

  try {
    const result = spawnSync(
      "powershell.exe",
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script],
      { encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("SCOPE:OriginalScope");
    expect(result.stdout).toContain("EXIT:73");
    expect(result.stdout).toContain("VARIABLES:0");
    expect(JSON.parse(readFileSync(resultPath, "utf8").replace(/^\uFEFF/, ""))).toEqual({
      BaseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
      EggAi: true,
      Language: "zh-cn",
      Model: "gpt-5.6-sol",
      SkKey: "sk-reader's-$HOME; `exit`",
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
