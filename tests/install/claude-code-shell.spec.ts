import { spawnSync } from "node:child_process";
import {
  chmodSync,
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
      NPM_CONFIG_REGISTRY: undefined,
      ...extraEnv,
    },
  });
}

function shellPath(value: string) {
  return value.replaceAll("\\", "/");
}

function runWithInstallerFixture(
  installerSource: string,
  preinstallClaude = false,
  args: string[] = [],
  initialSettings?: string,
  extraEnv: NodeJS.ProcessEnv = {},
  options: { runs?: number; removeBackupAfterFirstRun?: boolean } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-claude-shell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.sh");
  const npmLog = path.join(root, "npm.log");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);

  if (initialSettings !== undefined) {
    const claudeHome = path.join(home, ".claude");
    mkdirSync(claudeHome, { recursive: true });
    writeFileSync(path.join(claudeHome, "settings.json"), initialSettings);
  }

  const fakeCurl = path.join(bin, "curl");
  writeFileSync(
    fakeCurl,
    `#!/bin/sh
output=""
url=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    -w) shift 2 ;;
    http://*|https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
[ -n "$output" ] || exit 2
case "$url" in
  */v1/messages)
    if [ -n "\${FAKE_GATEWAY_BODY:-}" ]; then
      printf '%s' "$FAKE_GATEWAY_BODY" > "$output"
    else
      printf '%s\n' \
        'event: message_start' \
        'data: {"type":"message_start","message":{"id":"msg_fixture"}}' \
        '' \
        ': ping' \
        '' \
        'event: content_block_start' \
        'data: {"type":"content_block_start","content_block":{"type":"tool_use","name":"eggdoc_check"}}' \
        '' \
        'event: message_stop' \
        'data: {"type":"message_stop"}' \
        '' > "$output"
    fi
    printf '%s' "\${FAKE_GATEWAY_STATUS:-200}"
    exit 0
    ;;
esac
cat "$FAKE_INSTALLER_SOURCE" > "$output"
`,
  );
  chmodSync(fakeCurl, 0o755);

  const fakeNode = path.join(bin, "node");
  writeFileSync(
    fakeNode,
    `#!/bin/sh
case "\${1:-}" in
  -p) printf '%s\n' "\${FAKE_NODE_MAJOR:-22}" ;;
  --version) printf 'v%s.0.0\n' "\${FAKE_NODE_MAJOR:-22}" ;;
  *) exec "$REAL_NODE_COMMAND" "$@" ;;
esac
`,
  );
  chmodSync(fakeNode, 0o755);

  const fakeNpm = path.join(bin, "npm");
  writeFileSync(
    fakeNpm,
    `#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
[ -z "\${FAKE_NPM_EXIT:-}" ] || exit "$FAKE_NPM_EXIT"
sh "$FAKE_INSTALLER_SOURCE"
`,
  );
  chmodSync(fakeNpm, 0o755);

  if (preinstallClaude) {
    const claudeBin = path.join(home, ".local", "bin");
    mkdirSync(claudeBin, { recursive: true });
    const claude = path.join(claudeBin, "claude");
    writeFileSync(claude, "#!/bin/sh\necho 'existing Claude Code'\n");
    chmodSync(claude, 0o755);
  }

  const results = [];
  const backups: Array<string | undefined> = [];
  const settingsSnapshots: Array<string | undefined> = [];
  for (let run = 0; run < (options.runs ?? 1); run += 1) {
    results.push(
      runShell(args, {
        FAKE_INSTALLER_SOURCE: shellPath(fixture),
        FAKE_NPM_LOG: shellPath(npmLog),
        HOME: shellPath(home),
        PATH: `${bin}${path.delimiter}${testPath ?? ""}`,
        TMPDIR: shellPath(temporaryFiles),
        REAL_NODE_COMMAND: shellPath(process.execPath),
        ...extraEnv,
      }),
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
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  const npmCommands = existsSync(npmLog) ? readFileSync(npmLog, "utf8") : "";
  rmSync(root, { force: true, recursive: true });
  return {
    backup,
    backups,
    npmCommands,
    remainingTemporaryFiles,
    result: results.at(-1)!,
    results,
    settings,
    settingsSnapshots,
  };
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
  expect(result.stdout).toContain("Node.js requirement: >=22");
  expect(result.stdout).toContain("Node.js automatic install source: https://nodejs.org/dist/latest-v22.x");
  expect(result.stdout).toContain("npm package: @anthropic-ai/claude-code@latest");
  expect(result.stdout).toContain("npm registry: https://registry.npmmirror.com");
  expect(result.stdout).toContain("Would install/update Claude Code: yes");
  expect(result.stdout).toContain("Would modify Claude Code configuration: no");
});

test("Claude Code Shell rejects an invalid EggAi gateway timeout", () => {
  const result = runShell(["--dry-run", "--eggai"], {
    EGGDOC_GATEWAY_TIMEOUT_SECONDS: "0",
  });

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("EGGDOC_GATEWAY_TIMEOUT_SECONDS must be a positive integer");
});

test("Claude Code Shell EggAi dry-run validates inputs and redacts the credential", () => {
  const result = runShell([
    "--dry-run",
    "--eggai",
    "--sk-key",
    "sk-EGGDOC-SHELL-SECRET",
    "--baseurl",
    "https://api.example.test/v1",
    "--model",
    "claude-sonnet-5",
    "--opus-model",
    "claude-opus-4-8",
    "--sonnet-model",
    "claude-sonnet-5",
    "--haiku-model",
    "claude-haiku-4-5",
    "--fable-model",
    "claude-fable-5",
  ]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Mode: eggai");
  expect(result.stdout).toContain("Anthropic Base URL: https://api.example.test");
  expect(result.stdout).toContain("Opus model: claude-opus-4-8");
  expect(result.stdout).toContain("Haiku model: claude-haiku-4-5");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).toContain("Would modify Claude Code configuration: yes");
  expect(result.stdout).not.toContain("sk-EGGDOC-SHELL-SECRET");

  expect(runShell(["--eggai", "--sk-key", "secret", "--baseurl", "http://unsafe.test"]).status).not.toBe(0);
  expect(runShell(["--eggai", "--sk-key", "secret", "--baseurl", "https:///v1"]).status).not.toBe(0);
  const unsupportedModel = runShell([
    "--dry-run",
    "--eggai",
    "--sk-key",
    "secret",
    "--baseurl",
    "https://api.example.test/v1",
    "--model",
    "claude-sonnet-4-8",
  ]);
  expect(unsupportedModel.status).not.toBe(0);
  expect(unsupportedModel.stderr).toContain("is not a supported EggAi Claude model");
  expect(
    runShell([
      "--dry-run",
      "--eggai",
      "--sk-key",
      "secret",
      "--model",
      "claude-sonnet-4-6",
      "--baseurl",
      "https://reader:secret@api.example.test/v1",
    ]).stderr,
  ).toContain("baseurl must contain a host and no user information");
  expect(
    runShell([
      "--dry-run",
      "--eggai",
      "--sk-key",
      "secret",
      "--model",
      "claude-sonnet-4-6",
      "--baseurl",
      "https://api.example.test/v1?models=1",
    ]).stderr,
  ).toContain("baseurl must not contain whitespace, a query, or a fragment");
  expect(
    runShell([
      "--dry-run",
      "--eggai",
      "--sk-key",
      "secret",
      "--model",
      "claude-sonnet-4-6",
      "--baseurl",
      "https://api.example.test/v1#models",
    ]).stderr,
  ).toContain("baseurl must not contain whitespace, a query, or a fragment");
  expect(runShell(["--eggai", "--baseurl", "https://api.example.test/v1"]).status).not.toBe(0);
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

test("Claude Code Shell installer propagates npm failure and cleans up", () => {
  const failed = runWithInstallerFixture("#!/usr/bin/env bash\nexit 42\n", true);

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("npm could not install @anthropic-ai/claude-code");
  expect(failed.result.stderr).toContain("exit code 42");
  expect(failed.result.stdout).not.toContain("Done: Claude Code is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code Shell installer verifies a successful npm installation", () => {
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
  expect(installed.settings).toBeUndefined();
  expect(installed.remainingTemporaryFiles).toEqual([]);
});

test("Claude Code uses the official npm package through the mainland registry", () => {
  const installed = runWithInstallerFixture(`#!/usr/bin/env bash
set -eu
[ "$NPM_CONFIG_REGISTRY" = "https://registry.npmmirror.com" ] || exit 78
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/claude" <<'EOF'
#!/bin/sh
echo "9.9.9 (Claude Code registry fixture)"
EOF
chmod +x "$HOME/.local/bin/claude"
`);

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.result.stdout).toContain("Claude Code registry fixture");
  expect(installed.npmCommands).toContain("install --global @anthropic-ai/claude-code@latest");
  expect(installed.npmCommands).toContain("--prefix");
  expect(installed.npmCommands).toContain("--registry https://registry.npmmirror.com");
  expect(installed.npmCommands).toContain("--include=optional --no-audit --no-fund");
});

test("Claude Code Shell EggAi mode preserves existing settings and creates a backup", () => {
  const initialSettings = JSON.stringify({
    env: { KEEP_ME: "yes", ANTHROPIC_API_KEY: "old-key" },
    permissions: { allow: ["Read"] },
  });
  const configured = runWithInstallerFixture(
    `#!/usr/bin/env bash
set -eu
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/claude" <<'EOF'
#!/bin/sh
echo "9.9.9 (Claude Code test fixture)"
EOF
chmod +x "$HOME/.local/bin/claude"
`,
    false,
    [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-CONFIG",
      "--baseurl",
      "https://api.example.test/v1",
      "--model",
      "claude-sonnet-5",
      "--opus-model",
      "claude-opus-4-8",
      "--sonnet-model",
      "claude-sonnet-5",
      "--haiku-model",
      "claude-haiku-4-5",
      "--fable-model",
      "claude-fable-5",
    ],
    initialSettings,
  );

  expect(configured.result.status).toBe(0);
  expect(configured.result.stdout).not.toContain("sk-EGGDOC-SHELL-CONFIG");
  expect(configured.backup).toBe(initialSettings);
  expect(JSON.parse(configured.settings ?? "")).toEqual({
    env: {
      ANTHROPIC_AUTH_TOKEN: "sk-EGGDOC-SHELL-CONFIG",
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

test("Claude Code Shell EggAi mode is idempotent and does not recreate a removed backup", () => {
  const initialSettings = JSON.stringify({ env: { KEEP_ME: "yes" } });
  const configured = runWithInstallerFixture(
    "#!/usr/bin/env bash\nexit 0\n",
    true,
    [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-IDEMPOTENT",
      "--baseurl",
      "https://api.example.test/v1",
      "--model",
      "claude-sonnet-4-6",
    ],
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

test("Claude Code Shell EggAi mode leaves malformed existing settings untouched", () => {
  const malformedSettings = "{not-json\n";
  const configured = runWithInstallerFixture(
    "#!/usr/bin/env bash\nexit 0\n",
    true,
    [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-CONFIG",
      "--baseurl",
      "https://api.example.test/v1",
      "--model",
      "claude-sonnet-4-6",
    ],
    malformedSettings,
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.settings).toBe(malformedSettings);
  expect(configured.backup).toBeUndefined();
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
});

test("Claude Code Shell EggAi mode stops before installation when the gateway rejects the credential", () => {
  const configured = runWithInstallerFixture(
    "#!/usr/bin/env bash\nexit 0\n",
    true,
    [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-CONFIG",
      "--baseurl",
      "https://api.example.test/v1",
      "--model",
      "claude-sonnet-4-6",
    ],
    undefined,
    { FAKE_GATEWAY_STATUS: "401" },
  );

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("gateway verification returned HTTP 401");
  expect(configured.result.stdout).not.toContain("Installing or updating Claude Code");
  expect(configured.settings).toBeUndefined();
});

test("Claude Code Shell EggAi mode rejects a non-Anthropic success response", () => {
  const configured = runWithInstallerFixture(
    "#!/usr/bin/env bash\nexit 0\n",
    true,
    [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-CONFIG",
      "--baseurl",
      "https://api.example.test/v1",
      "--model",
      "claude-sonnet-4-6",
    ],
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

for (const jsonEngine of ["node", "python3", "jq", "perl"] as const) {
  test(`Claude Code Shell uses ${jsonEngine} for the same SSE and settings contract`, () => {
    const availabilityCommand = {
      jq: "jq --version",
      node: 'node -e \'JSON.parse("{}")\'',
      perl: "perl -MJSON::PP -e 1",
      python3: "python3 -c 'import json'",
    }[jsonEngine];
    const available = spawnSync(shell, ["-c", availabilityCommand], {
      encoding: "utf8",
      env: { ...process.env, PATH: testPath },
    });
    test.skip(available.status !== 0, `${jsonEngine} is not available in this environment`);

    const configured = runWithInstallerFixture(
      "#!/usr/bin/env bash\nexit 0\n",
      true,
      [
        "--eggai",
        "--sk-key",
        "sk-EGGDOC-SHELL-CONFIG",
        "--baseurl",
        "https://api.example.test/v1",
        "--model",
        "claude-sonnet-4-6",
      ],
      undefined,
      { EGGDOC_JSON_ENGINE: jsonEngine },
    );

    expect(configured.result.status, configured.result.stderr).toBe(0);
    const settings = JSON.parse(configured.settings ?? "");
    expect(settings.env.ANTHROPIC_BASE_URL).toBe("https://api.example.test");
    expect(settings.env.ANTHROPIC_MODEL).toBe("claude-sonnet-4-6");
  });
}
