import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
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
      BASE_URL: undefined,
      CODEX_MODEL: undefined,
      CODEX_HOME: "/tmp/eggdoc-codex-shell-test",
      EGGAI_API_KEY: undefined,
      LANGUAGE: undefined,
      MODEL: undefined,
      NPM_CONFIG_REGISTRY: undefined,
      PATH: testPath,
      SK_KEY: undefined,
    },
  });
}

function shellPath(value: string) {
  return value.replaceAll("\\", "/");
}

const successfulInstaller = `#!/bin/sh
set -eu
mkdir -p "$HOME/.local/bin"
cat > "$HOME/.local/bin/codex" <<'EOF'
#!/bin/sh
set -eu
printf '%s\n' "$*" >> "$FAKE_CODEX_LOG"
case "\${1:-}" in
  --version)
    echo "codex-cli 9.9.9 (EggDoc test fixture)"
    ;;
  *) exit 43 ;;
esac
EOF
chmod +x "$HOME/.local/bin/codex"
`;

const fixturePath =
  process.platform === "win32"
    ? `C:\\Program Files\\Git\\usr\\bin;C:\\Program Files\\Git\\bin;${process.env.SystemRoot ?? "C:\\Windows"}\\System32`
    : process.env.PATH;

function runWithInstallerFixture(
  installerSource: string,
  options: {
    args?: string[];
    extraEnv?: NodeJS.ProcessEnv;
    initialConfig?: string;
    initialEnvironment?: string;
    profileAsDirectory?: boolean;
    removeBackupAfterFirstRun?: boolean;
    runs?: number;
    signalAfterConfigWrite?: boolean;
    automaticNode?: boolean;
  } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-codex-shell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.sh");
  const codexLog = path.join(root, "codex.log");
  const npmLog = path.join(root, "npm.log");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);
  let nodeChecksums: string | undefined;
  let nodeArchive: string | undefined;
  if (options.automaticNode) {
    const releaseName = "node-v24.18.0-linux-x64";
    const releaseParent = path.join(root, "node-release");
    const releaseBin = path.join(releaseParent, releaseName, "bin");
    mkdirSync(releaseBin, { recursive: true });
    const nodeRuntime = path.join(releaseBin, "node");
    const npmRuntime = path.join(releaseBin, "npm");
    writeFileSync(nodeRuntime, "#!/bin/sh\ncase \"$1\" in --version) echo v24.18.0 ;; *) exit 64 ;; esac\n");
    writeFileSync(npmRuntime, "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$FAKE_NPM_LOG\"\nsh \"$FAKE_INSTALLER_SOURCE\"\n");
    chmodSync(nodeRuntime, 0o755);
    chmodSync(npmRuntime, 0o755);
    nodeArchive = path.join(root, `${releaseName}.tar.gz`);
    const archiveResult = spawnSync("tar", ["-czf", nodeArchive, "-C", releaseParent, releaseName], {
      encoding: "utf8",
    });
    if (archiveResult.status !== 0) {
      throw new Error(`could not create Node fixture archive: ${archiveResult.stderr}`);
    }
    const digest = createHash("sha256").update(readFileSync(nodeArchive)).digest("hex");
    nodeChecksums = path.join(root, "SHASUMS256.txt");
    writeFileSync(nodeChecksums, `${digest}  ${releaseName}.tar.gz\n`);
  }
  const codexHome = path.join(home, ".codex");
  const configPath = path.join(codexHome, "config.toml");
  const backupPath = `${configPath}.eggai.bak`;
  const environmentPath = path.join(codexHome, "eggai.env");
  const profilePath = path.join(home, ".profile");
  if (options.profileAsDirectory) {
    mkdirSync(profilePath);
  }
  if (options.initialConfig !== undefined) {
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(configPath, options.initialConfig);
  }
  if (options.initialEnvironment !== undefined) {
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(environmentPath, options.initialEnvironment);
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
    --) url="$2"; shift 2 ;;
    http://*|https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
[ -z "\${FAKE_CURL_EXIT:-}" ] || exit "$FAKE_CURL_EXIT"
[ "\${url%/models}" = "$url" ] || { printf '%s' "\${FAKE_MODELS_STATUS:-200}"; exit 0; }
[ "\${url%/responses}" = "$url" ] || { printf '%s' "\${FAKE_RESPONSES_STATUS:-200}"; exit 0; }
[ -n "$output" ] || exit 2
case "$url" in
  */SHASUMS256.txt) cat "$FAKE_NODE_CHECKSUMS" > "$output" ;;
  *.tar.gz) cat "$FAKE_NODE_ARCHIVE" > "$output" ;;
  *) exit 2 ;;
esac
`,
  );
  chmodSync(fakeCurl, 0o755);

  if (options.automaticNode) {
    const fakeUname = path.join(bin, "uname");
    writeFileSync(
      fakeUname,
      "#!/bin/sh\ncase \"$1\" in -s) echo Linux ;; -m) echo x86_64 ;; *) exit 1 ;; esac\n",
    );
    chmodSync(fakeUname, 0o755);
  }

  const fakeNode = path.join(bin, "node");
  writeFileSync(
    fakeNode,
    `#!/bin/sh
case "\${1:-}" in
  --version) printf 'v%s\n' "\${FAKE_NODE_VERSION:-24.18.0}" ;;
  *) exit 64 ;;
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

  const signalMarker = path.join(root, "config-signal-sent");
  if (options.signalAfterConfigWrite) {
    const fakeMove = path.join(bin, "mv");
    writeFileSync(
      fakeMove,
      `#!/bin/sh
target=""
for argument do target="$argument"; done
/usr/bin/mv "$@"
status=$?
if [ "$status" -eq 0 ] && [ "$target" = "$FAKE_SIGNAL_CONFIG_PATH" ] && [ ! -e "$FAKE_SIGNAL_MARKER" ]; then
  : > "$FAKE_SIGNAL_MARKER"
  kill -TERM "$PPID"
fi
exit "$status"
`,
    );
    chmodSync(fakeMove, 0o755);
  }

  const results = [];
  const configs: Array<string | undefined> = [];
  const backups: Array<string | undefined> = [];
  for (let run = 0; run < (options.runs ?? 1); run += 1) {
    results.push(
      spawnSync(shell, [scriptPath, ...(options.args ?? [])], {
        cwd: path.resolve(import.meta.dirname, "../.."),
        encoding: "utf8",
        env: {
          ...process.env,
          BASE_URL: undefined,
          CODEX_MODEL: undefined,
          CODEX_HOME: shellPath(codexHome),
          CODEX_PROFILE: shellPath(profilePath),
          EGGAI_API_KEY: undefined,
          FAKE_CODEX_LOG: shellPath(codexLog),
          FAKE_INSTALLER_SOURCE: shellPath(fixture),
          FAKE_NPM_LOG: shellPath(npmLog),
          FAKE_NODE_ARCHIVE: nodeArchive ? shellPath(nodeArchive) : undefined,
          FAKE_NODE_CHECKSUMS: nodeChecksums ? shellPath(nodeChecksums) : undefined,
          FAKE_NODE_VERSION: options.automaticNode ? "24.17.9" : "24.18.0",
          FAKE_SIGNAL_CONFIG_PATH: options.signalAfterConfigWrite
            ? shellPath(configPath)
            : undefined,
          FAKE_SIGNAL_MARKER: options.signalAfterConfigWrite
            ? shellPath(signalMarker)
            : undefined,
          HOME: shellPath(home),
          LANGUAGE: undefined,
          MODEL: undefined,
          NPM_CONFIG_REGISTRY: undefined,
          PATH: `${bin}${path.delimiter}${fixturePath ?? ""}`,
          TMPDIR: shellPath(temporaryFiles),
          SK_KEY: undefined,
          ...options.extraEnv,
        },
      }),
    );
    configs.push(existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined);
    backups.push(existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined);
    if (run === 0 && options.removeBackupAfterFirstRun) {
      rmSync(backupPath, { force: true });
    }
  }
  const result = results.at(-1)!;
  const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined;
  const backup = existsSync(backupPath) ? readFileSync(backupPath, "utf8") : undefined;
  const installedCodex = existsSync(path.join(home, ".local", "bin", "codex"));
  const codexCommands = existsSync(codexLog) ? readFileSync(codexLog, "utf8") : "";
  const npmCommands = existsSync(npmLog) ? readFileSync(npmLog, "utf8") : "";
  const environment = existsSync(environmentPath)
    ? readFileSync(environmentPath, "utf8")
    : undefined;
  const profile = existsSync(profilePath) && !options.profileAsDirectory
    ? readFileSync(profilePath, "utf8")
    : undefined;
  const remainingTemporaryFiles = readdirSync(temporaryFiles);
  rmSync(root, { force: true, recursive: true });
  return {
    backup,
    backups,
    codexCommands,
    config,
    configs,
    environment,
    installedCodex,
    npmCommands,
    profile,
    remainingTemporaryFiles,
    result,
    results,
  };
}

test("the hosted Shell installer has valid POSIX shell syntax", () => {
  const result = spawnSync(shell, ["-n", scriptPath], {
    cwd: path.resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
  });

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
});

test("default installation propagates an npm package installation failure", () => {
  const failed = runWithInstallerFixture("#!/bin/sh\nexit 0\n", {
    extraEnv: { FAKE_NPM_EXIT: "37" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("npm could not install @openai/codex");
  expect(failed.result.stderr).toContain("exit code 37");
  expect(failed.result.stdout).not.toContain("Done: Codex is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("default installation verifies the installed Codex command before reporting success", () => {
  const installed = runWithInstallerFixture(successfulInstaller);

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.installedCodex).toBe(true);
  expect(installed.result.stdout).toContain("Done: Codex is installed");
  expect(installed.result.stdout).toContain("codex-cli 9.9.9 (EggDoc test fixture)");
  expect(installed.remainingTemporaryFiles).toEqual([]);
});

test("default installation verifies official Node.js before npm when Node is too old", () => {
  const installed = runWithInstallerFixture(successfulInstaller, { automaticNode: true });

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.result.stdout).toContain("Installing Node.js 24.x from nodejs.org");
  expect(installed.result.stdout).toContain("Done: Codex is installed");
  expect(installed.npmCommands).toContain("install --global @openai/codex@latest");
  expect(installed.profile).toContain(".local/share/eggdoc-node/current/bin");
});

test("Codex is installed from the official npm package through the mainland registry", () => {
  const installed = runWithInstallerFixture(successfulInstaller);

  expect(installed.result.status, installed.result.stderr).toBe(0);
  expect(installed.result.stdout).toContain("Done: Codex is installed");
  expect(installed.npmCommands).toContain("install --global @openai/codex@latest");
  expect(installed.npmCommands).toContain("--prefix");
  expect(installed.npmCommands).toContain("--registry https://registry.npmmirror.com");
  expect(installed.npmCommands).toContain("--include=optional --no-audit --no-fund");
});

test("default installation preserves an npm subprocess failure", () => {
  const failed = runWithInstallerFixture("#!/bin/sh\nexit 42\n");

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("npm could not install @openai/codex");
  expect(failed.result.stderr).toContain("exit code 42");
  expect(failed.result.stdout).not.toContain("Done: Codex is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation verifies the endpoint before invoking npm", () => {
  const failed = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-ENDPOINT-FAILURE",
      "--model",
      "gpt-5.6-sol",
    ],
    extraEnv: { FAKE_MODELS_STATUS: "503" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("EggAi Codex endpoint verification returned HTTP 503");
  expect(failed.result.stdout).toContain("Verifying the EggAi Codex endpoint");
  expect(failed.result.stdout).not.toContain("Installing or updating Codex");
  expect(failed.installedCodex).toBe(false);
});

test("EggAi installation verifies the selected model before invoking npm", () => {
  const failed = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", "sk-EGGDOC-SHELL-MODEL-FAILURE", "--model", "gpt-5.6-sol"],
    extraEnv: { FAKE_RESPONSES_STATUS: "404" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("EggAi model verification returned HTTP 404");
  expect(failed.installedCodex).toBe(false);
});

test("EggAi installation configures provider-scoped authentication without changing Codex login", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-INSTALL-FIXTURE";
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      fixtureKey,
      "--baseurl",
      "https://api.example.test/v1",
      "--language",
      "en-us",
      "--model",
      "gpt-5.6-sol",
    ],
  });

  expect(configured.result.status, configured.result.stderr).toBe(0);
  expect(configured.result.stdout).toContain("Done: Codex is installed and configured to use EggAi");
  expect(configured.result.stdout).toContain("codex-cli 9.9.9 (EggDoc test fixture)");
  expect(configured.result.stdout).not.toContain(fixtureKey);
  expect(configured.config).toContain('model_provider = "eggai"');
  expect(configured.config).toContain('model = "gpt-5.6-sol"');
  expect(configured.config).toContain('base_url = "https://api.example.test/v1"');
  expect(configured.config).toContain('env_key = "EGGAI_API_KEY"');
  expect(configured.config).not.toContain("requires_openai_auth");
  expect(configured.config).not.toContain("cli_auth_credentials_store");
  expect(configured.config).toContain("Respond in English by default");
  expect(configured.config).not.toContain(fixtureKey);
  expect(configured.environment).toContain("EGGAI_API_KEY='sk-EGGDOC-SHELL-INSTALL-FIXTURE'");
  expect(configured.environment).toContain(".local/share/eggdoc-node/current/bin");
  expect(configured.profile).toContain("# >>> eggai-codex-env");
  expect(configured.profile).toContain(". '");
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.backup).toBeUndefined();
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation preserves existing configuration and is idempotent", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-IDEMPOTENT-FIXTURE";
  const initialConfig = (
    'model = "keep-me"\n\n[mcp_servers.keep]\ncommand = "keep-command"\n\n' +
    '[model_providers."eggai"] # replace this provider\n' +
    'base_url = "https://old.example.test/v1"\n\n' +
    '[model_providers.eggai.auth]\ntype = "bearer"\n\n' +
    '[model_providers.eggai.http_headers]\nx-old = "remove"\n\n' +
    '[model_providers.eggai.env_http_headers]\nx-env = "OLD_KEY"\n'
  ).replaceAll("\n", "\r\n");
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      fixtureKey,
      "--language",
      "zh-cn",
      "--model",
      "gpt-5.6-sol",
    ],
    initialConfig,
    removeBackupAfterFirstRun: true,
    runs: 2,
  });

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

test("EggAi installation restores existing configuration when API key persistence fails", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-ROLLBACK-FIXTURE";
  const initialConfig = 'model = "keep-before-failed-env-save"\n';
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", fixtureKey, "--model", "gpt-5.6-sol"],
    initialConfig,
    profileAsDirectory: true,
  });

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("could not save EGGAI_API_KEY");
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(configured.config).toBe(initialConfig);
  expect(configured.backup).toBe(initialConfig);
  expect(configured.environment).toBeUndefined();
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation restores configuration when interrupted after the atomic replace", () => {
  const initialConfig = 'model = "keep-before-signal"\n';
  const interrupted = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-SIGNAL-FIXTURE",
      "--model",
      "gpt-5.6-sol",
    ],
    initialConfig,
    signalAfterConfigWrite: true,
  });

  expect(interrupted.result.status).toBe(143);
  expect(interrupted.config).toBe(initialConfig);
  expect(interrupted.environment).toBeUndefined();
  expect(interrupted.profile).toBeUndefined();
  expect(interrupted.result.stdout).not.toContain("installed and configured to use EggAi");
  expect(interrupted.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation preserves an existing API key when profile persistence fails", () => {
  const previousEnvironment = "# existing\nEGGAI_API_KEY='sk-EGGDOC-SHELL-PREVIOUS'\nexport EGGAI_API_KEY\n";
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-NEW",
      "--model",
      "gpt-5.6-sol",
    ],
    initialEnvironment: previousEnvironment,
    profileAsDirectory: true,
  });

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("could not save EGGAI_API_KEY");
  expect(configured.environment).toBe(previousEnvironment);
  expect(configured.config).toBeUndefined();
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation refuses an incomplete managed block without changing configuration", () => {
  const malformedConfig = '# >>> eggai-codex\nmodel_provider = "eggai"\n';
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: [
      "--eggai",
      "--sk-key",
      "sk-EGGDOC-SHELL-MALFORMED-FIXTURE",
      "--model",
      "gpt-5.6-sol",
    ],
    initialConfig: malformedConfig,
  });

  expect(configured.result.status).not.toBe(0);
  expect(configured.result.stderr).toContain("incomplete EggAi managed block");
  expect(configured.config).toBe(malformedConfig);
  expect(configured.backup).toBeUndefined();
  expect(configured.result.stdout).not.toContain("installed and configured to use EggAi");
});

test("default dry-run installs Codex without changing provider configuration", () => {
  const result = runShell(["--dry-run"]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Mode: default");
  expect(result.stdout).toContain("Node.js requirement: >=24.18.0");
  expect(result.stdout).toContain("Node.js automatic install source: https://nodejs.org/dist/latest-v24.x");
  expect(result.stdout).toContain("npm package: @openai/codex@latest");
  expect(result.stdout).toContain("npm registry: https://registry.npmmirror.com");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would write config.toml: no");
  expect(result.stdout).toContain("Would change existing Codex login: no");
  expect(result.stdout).not.toContain("model_provider");
});

test("EggAi dry-run rejects a Base URL query without exposing the key", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-DRY-RUN-ONLY";
  const result = runShell([
    "--dry-run", "--eggai",
    "--sk-key",
    fixtureKey,
    "--baseurl",
    'https://api.example.test/v1?label="shell"',
    "--language",
    "en-us",
    "--model",
    "gpt-5.6-sol",
  ]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("baseurl must not contain a query string");
  expect(result.stdout).not.toContain(fixtureKey);
});

test("EggAi dry-run accepts generated parameters, redacts the key, and previews provider config", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-DRY-RUN-VALID";
  const result = runShell([
    "--dry-run",
    "--eggai",
    "--sk-key",
    fixtureKey,
    "--baseurl",
    "https://api.example.test/v1",
    "--language",
    "en-us",
    "--model",
    "gpt-5.6-sol",
  ]);

  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Mode: eggai");
  expect(result.stdout).toContain("API key: provided (redacted)");
  expect(result.stdout).not.toContain(fixtureKey);
  expect(result.stdout).toContain('base_url = "https://api.example.test/v1"');
  expect(result.stdout).toContain("Respond in English by default");
  expect(result.stdout).toContain("Would install/update Codex: yes");
  expect(result.stdout).toContain("Would save EGGAI_API_KEY for provider-scoped authentication: yes");
  expect(result.stdout).toContain("Would change existing Codex login: no");
  expect(result.stdout).toContain('model = "gpt-5.6-sol"');
  expect(result.stdout).toContain('env_key = "EGGAI_API_KEY"');
  expect(result.stdout).toContain("Backup file: /tmp/eggdoc-codex-shell-test/config.toml.eggai.bak");
});

test("EggAi mode requires an explicit Codex model", () => {
  const result = runShell([
    "--dry-run",
    "--eggai",
    "--sk-key",
    "sk-EGGDOC-SHELL-MISSING-MODEL",
  ]);

  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain("model is required with --eggai");
  expect(result.stdout).not.toContain("Would install/update Codex");
});

test("EggAi dry-run keeps zh-cn and the public EggAi Base URL as stable defaults", () => {
  const result = runShell(["--dry-run", "--eggai", "--model", "gpt-5.6-sol"]);

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("Base URL: https://api.eggai.icu/v1");
  expect(result.stdout).toContain("Language: zh-cn");
  expect(result.stdout).toContain("API key: missing");
  expect(result.stdout).toContain("请默认使用简体中文回答");
});

test("EggAi dry-run rejects invalid language and Base URL before any install path", () => {
  const invalidLanguage = runShell(["--dry-run", "--eggai", "--language", "fr-fr"]);
  const invalidBaseUrl = runShell(["--dry-run", "--eggai", "--baseurl", "file:///tmp/eggai"]);
  const missingHost = runShell(["--dry-run", "--eggai", "--baseurl", "https:///v1"]);
  const userInfo = runShell([
    "--dry-run",
    "--eggai",
    "--baseurl",
    "https://reader:secret@api.example.test/v1",
  ]);
  const fragment = runShell([
    "--dry-run",
    "--eggai",
    "--baseurl",
    "https://api.example.test/v1#models",
  ]);
  const injectedBaseUrl = runShell([
    "--dry-run",
    "--eggai",
    "--baseurl",
    'https://api.example.test/v1\nmodel_provider = "injected"',
  ]);

  expect(invalidLanguage.status).not.toBe(0);
  expect(invalidLanguage.stderr).toContain("language must be zh-cn or en-us");
  expect(invalidLanguage.stdout).not.toContain("Installing or updating Codex");
  expect(invalidBaseUrl.status).not.toBe(0);
  expect(invalidBaseUrl.stderr).toContain("baseurl must start with http:// or https://");
  expect(invalidBaseUrl.stdout).not.toContain("Installing or updating Codex");
  expect(missingHost.status).not.toBe(0);
  expect(missingHost.stderr).toContain("baseurl must include a host");
  expect(userInfo.status).not.toBe(0);
  expect(userInfo.stderr).toContain("baseurl must include a host and must not contain user information");
  expect(fragment.status).not.toBe(0);
  expect(fragment.stderr).toContain("baseurl must not contain a fragment");
  expect(injectedBaseUrl.status).not.toBe(0);
  expect(injectedBaseUrl.stderr).toContain("baseurl must not contain whitespace or control characters");
});
