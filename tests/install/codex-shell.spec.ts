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
  } = {},
) {
  const root = mkdtempSync(path.join(tmpdir(), "eggdoc-codex-shell-"));
  const bin = path.join(root, "bin");
  const home = path.join(root, "home");
  const temporaryFiles = path.join(root, "tmp");
  const fixture = path.join(root, "installer.sh");
  const codexLog = path.join(root, "codex.log");
  mkdirSync(bin);
  mkdirSync(home);
  mkdirSync(temporaryFiles);
  writeFileSync(fixture, installerSource);
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
[ -n "$output" ] || exit 2
cat "$FAKE_INSTALLER_SOURCE" > "$output"
`,
  );
  chmodSync(fakeCurl, 0o755);

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
          CODEX_INSTALLER_URL: "https://install.example.test/codex.sh",
          CODEX_PROFILE: shellPath(profilePath),
          EGGAI_API_KEY: undefined,
          FAKE_CODEX_LOG: shellPath(codexLog),
          FAKE_INSTALLER_SOURCE: shellPath(fixture),
          HOME: shellPath(home),
          LANGUAGE: undefined,
          MODEL: undefined,
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

test("default installation propagates an official installer download failure", () => {
  const failed = runWithInstallerFixture("#!/bin/sh\nexit 0\n", {
    extraEnv: { FAKE_CURL_EXIT: "37" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("could not download the official Codex installer");
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

test("default installation rejects invalid responses and preserves installer failure", () => {
  const html = runWithInstallerFixture("<!doctype html><title>Unavailable</title>\n");
  const whitespace = runWithInstallerFixture(" \n\t\n");
  const failed = runWithInstallerFixture("#!/bin/sh\nexit 42\n");

  expect(html.result.status).not.toBe(0);
  expect(html.result.stderr).toContain("returned HTML instead of a script");
  expect(html.remainingTemporaryFiles).toEqual([]);
  expect(whitespace.result.status).not.toBe(0);
  expect(whitespace.result.stderr).toContain("response was empty");
  expect(whitespace.remainingTemporaryFiles).toEqual([]);
  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("official Codex installer did not complete successfully");
  expect(failed.result.stdout).not.toContain("Done: Codex is installed");
  expect(failed.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation verifies the endpoint before downloading the official installer", () => {
  const failed = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", "sk-EGGDOC-SHELL-ENDPOINT-FAILURE"],
    extraEnv: { FAKE_MODELS_STATUS: "503" },
  });

  expect(failed.result.status).not.toBe(0);
  expect(failed.result.stderr).toContain("EggAi Codex endpoint verification returned HTTP 503");
  expect(failed.result.stdout).toContain("Verifying the EggAi Codex endpoint");
  expect(failed.result.stdout).not.toContain("Installing or updating Codex");
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
  expect(configured.profile).toContain("# >>> eggai-codex-env");
  expect(configured.profile).toContain(". '");
  expect(configured.codexCommands).not.toContain("login");
  expect(configured.backup).toBeUndefined();
  expect(configured.remainingTemporaryFiles).toEqual([]);
});

test("EggAi installation preserves existing configuration and is idempotent", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-IDEMPOTENT-FIXTURE";
  const initialConfig =
    'model = "keep-me"\n\n[mcp_servers.keep]\ncommand = "keep-command"\n\n' +
    '[model_providers."eggai"] # replace this provider\n' +
    'base_url = "https://old.example.test/v1"\n\n' +
    '[model_providers.eggai.auth]\ntype = "bearer"\n\n' +
    '[model_providers.eggai.http_headers]\nx-old = "remove"\n\n' +
    '[model_providers.eggai.env_http_headers]\nx-env = "OLD_KEY"\n';
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", fixtureKey, "--language", "zh-cn"],
    initialConfig,
    removeBackupAfterFirstRun: true,
    runs: 2,
  });

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

test("EggAi installation restores existing configuration when API key persistence fails", () => {
  const fixtureKey = "sk-EGGDOC-SHELL-ROLLBACK-FIXTURE";
  const initialConfig = 'model = "keep-before-failed-env-save"\n';
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", fixtureKey],
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

test("EggAi installation preserves an existing API key when profile persistence fails", () => {
  const previousEnvironment = "# existing\nEGGAI_API_KEY='sk-EGGDOC-SHELL-PREVIOUS'\nexport EGGAI_API_KEY\n";
  const configured = runWithInstallerFixture(successfulInstaller, {
    args: ["--eggai", "--sk-key", "sk-EGGDOC-SHELL-NEW"],
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
    args: ["--eggai", "--sk-key", "sk-EGGDOC-SHELL-MALFORMED-FIXTURE"],
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

test("EggAi dry-run keeps zh-cn and the public EggAi Base URL as stable defaults", () => {
  const result = runShell(["--dry-run", "--eggai"]);

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
