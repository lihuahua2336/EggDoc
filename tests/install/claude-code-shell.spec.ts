import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "@playwright/test";

const shell =
  process.platform === "win32" && existsSync("C:\\Program Files\\Git\\usr\\bin\\sh.exe")
    ? "C:\\Program Files\\Git\\usr\\bin\\sh.exe"
    : "sh";
const repoRoot = path.resolve(import.meta.dirname, "../..");
const scriptPath = "public/install/claude-code.sh";
const testPath =
  process.platform === "win32"
    ? `C:\\Program Files\\Git\\usr\\bin;C:\\Program Files\\Git\\bin;${process.env.PATH ?? ""}`
    : process.env.PATH;

function runShell(args: string[], extraEnv: NodeJS.ProcessEnv = {}) {
  return spawnSync(shell, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
}

function shellPath(value: string) {
  return value.replaceAll("\\", "/");
}

function runWithInstallerFixture(installerSource: string, preinstallClaude = false) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-claude-shell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.sh");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);

  const fakeCurl = path.join(bin, "curl");
  writeFileSync(
    fakeCurl,
    `#!/bin/sh
output=""
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    output="$2"
    shift 2
  else
    shift
  fi
done
[ -n "$output" ] || exit 2
cat "$FAKE_INSTALLER_SOURCE" > "$output"
`,
  );
  chmodSync(fakeCurl, 0o755);

  if (preinstallClaude) {
    const claudeBin = path.join(home, ".local", "bin");
    mkdirSync(claudeBin, { recursive: true });
    const claude = path.join(claudeBin, "claude");
    writeFileSync(claude, "#!/bin/sh\necho 'existing Claude Code'\n");
    chmodSync(claude, 0o755);
  }

  const result = runShell([], {
    FAKE_INSTALLER_SOURCE: shellPath(fixture),
    HOME: shellPath(home),
    PATH: `${bin}${path.delimiter}${testPath ?? ""}`,
    TMPDIR: shellPath(temporaryFiles),
  });
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  rmSync(root, { force: true, recursive: true });
  return { remainingTemporaryFiles, result };
}

test("the hosted Claude Code Shell installer has valid POSIX syntax", () => {
  const result = spawnSync(shell, ["-n", scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test("Claude Code Shell dry-run delegates installation without changing configuration", () => {
  const result = runShell(["--dry-run"]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Claude Code installer dry run");
  expect(result.stdout).toContain("Official installer URL: https://claude.ai/install.sh");
  expect(result.stdout).toContain("Would install/update Claude Code: yes");
  expect(result.stdout).toContain("Would modify Claude Code configuration: no");
});

test("Claude Code Shell installer accepts official release channels and rejects shell input", () => {
  const stable = runShell(["--dry-run", "--version", "stable"]);
  const version = runShell(["--dry-run", "--version", "2.1.89"]);
  const unsafe = runShell(["--dry-run", "--version", "latest;exit 0"]);
  const malformed = runShell(["--dry-run", "--version", "2.1.89."]);

  expect(stable.status).toBe(0);
  expect(stable.stdout).toContain("Release: stable");
  expect(version.status).toBe(0);
  expect(version.stdout).toContain("Release: 2.1.89");
  expect(unsafe.status).not.toBe(0);
  expect(unsafe.stderr).toContain("version must be latest, stable, or a numeric dotted version");
  expect(malformed.status).not.toBe(0);
});

test("Claude Code Shell installer rejects invalid responses, propagates failure, and cleans up", () => {
  const html = runWithInstallerFixture("<!doctype html><title>Unavailable</title>\n");
  const whitespace = runWithInstallerFixture(" \n\t\n");
  const failed = runWithInstallerFixture("#!/usr/bin/env bash\nexit 42\n", true);

  expect(html.result.status).not.toBe(0);
  expect(html.result.stderr).toContain("returned HTML instead of a script");
  expect(html.remainingTemporaryFiles).toEqual([]);
  expect(whitespace.result.status).not.toBe(0);
  expect(whitespace.result.stderr).toContain("response was empty");
  expect(whitespace.remainingTemporaryFiles).toEqual([]);
  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("Anthropic installer did not complete successfully");
  expect(failed.result.stdout).not.toContain("Done: Claude Code is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code Shell installer verifies a successful delegated installation", () => {
  const installed = runWithInstallerFixture(`#!/usr/bin/env bash
set -eu
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/claude" <<'EOF'
#!/bin/sh
echo "9.9.9 (Claude Code test fixture)"
EOF
chmod +x "$HOME/.local/bin/claude"
`);

  expect(installed.result.status).toBe(0);
  expect(installed.result.stdout).toContain("Done: Claude Code is installed");
  expect(installed.result.stdout).toContain("9.9.9 (Claude Code test fixture)");
  expect(installed.remainingTemporaryFiles).toEqual([]);
});
