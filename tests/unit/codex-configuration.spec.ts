import { expect, test } from "@playwright/test";

import {
  buildCodexConfigToml,
  buildPowerShellDefaultInstallCommand,
  buildPowerShellInstallCommand,
  buildShellDefaultInstallCommand,
  buildShellInstallCommand,
  selectCodexModel,
} from "../../src/lib/codex/configuration";

test("default commands install Codex without selecting a third-party provider", () => {
  expect(buildShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/codex.sh' | sh",
  );
  expect(buildPowerShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
    "irm 'https://docs.example.test/root/install/codex.ps1' | iex",
  );
});

test("Codex commands can use a deployment-provided installer mirror", () => {
  expect(
    buildShellDefaultInstallCommand(
      "https://docs.example.test/root",
      "https://mirror.example.test/codex",
    ),
  ).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/codex.sh' | " +
      "CODEX_INSTALLER_URL='https://mirror.example.test/codex/codex.sh' sh",
  );
  expect(
    buildPowerShellDefaultInstallCommand(
      "https://docs.example.test/root",
      "https://mirror.example.test/codex",
    ),
  ).toBe(
    "$env:CODEX_INSTALLER_URL='https://mirror.example.test/codex/codex.ps1'; " +
      "irm 'https://docs.example.test/root/install/codex.ps1' | iex",
  );
});

test("Shell configuration safely quotes the selected credential, URL, and language", () => {
  expect(
    buildShellInstallCommand({
      apiKey: "sk-reader's-$HOME",
      baseUrl: "https://api.example.test/v1?group=reader's",
      installerOrigin: "https://docs.example.test/root",
      language: "en-us",
      model: "openai/gpt-5.10-codex",
    }),
  ).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/codex.sh' | sh -s -- " +
      "--eggai " +
      "--sk-key 'sk-reader'\"'\"'s-$HOME' " +
      "--baseurl 'https://api.example.test/v1?group=reader'\"'\"'s' " +
      "--language 'en-us' " +
      "--model 'openai/gpt-5.10-codex'",
  );
});

test("PowerShell configuration safely quotes the selected credential, URL, language, and installer", () => {
  expect(
    buildPowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
      installerOrigin: "https://docs.example.test/root's",
      language: "en-us",
      model: "gpt-5.6-sol",
    }),
  ).toBe(
    "$env:EGGAI_CODEX_ENV_SCOPE='User'; " +
      "& ([scriptblock]::Create((irm 'https://docs.example.test/root''s/install/codex.ps1'))) " +
      "-EggAi -SkKey 'sk-reader''s-$HOME; `exit`' " +
      "-BaseUrl 'https://api.example.test/v1?group=reader''s&value=$HOME' " +
      "-Language 'en-us' " +
      "-Model 'gpt-5.6-sol'",
  );
});

test("Codex provider configuration escapes TOML and never contains the API key", () => {
  const config = buildCodexConfigToml({
    baseUrl: 'https://api.example.test/v1?label="reader"\\team',
    language: "zh-cn",
    model: "openai/gpt-5.10-codex",
  });

  expect(config).toBe(
    '# EggAi Codex provider configuration. This file does not contain your API key.\n' +
      'model_provider = "eggai"\n' +
      'developer_instructions = "请默认使用简体中文回答，除非用户明确要求其他语言。"\n' +
      'model = "openai/gpt-5.10-codex"\n' +
      "\n" +
      "[model_providers.eggai]\n" +
      'name = "EggAi"\n' +
      'base_url = "https://api.example.test/v1?label=\\\"reader\\\"\\\\team"\n' +
      'env_key = "EGGAI_API_KEY"\n' +
      'env_key_instructions = "EggDoc stores EGGAI_API_KEY in the user environment."\n' +
      'wire_api = "responses"',
  );
  expect(config).not.toContain("sk-reader-secret");
});

test("English configuration uses the English Codex instruction", () => {
  expect(
    buildCodexConfigToml({
      baseUrl: "https://api.example.test/v1",
      language: "en-us",
      model: "gpt-5.2",
    }),
  ).toContain(
    'developer_instructions = "Respond in English by default unless the user explicitly asks for another language."',
  );
});

test("Codex selects the highest available GPT model and preserves its exact provider ID", () => {
  expect(
    selectCodexModel([
      "gemini-3-pro",
      "gpt-5.9",
      "openai/gpt-5.10-codex",
      "claude-sonnet-5",
    ]),
  ).toBe("openai/gpt-5.10-codex");
  expect(selectCodexModel(["claude-sonnet-5", "gemini-3-pro"])).toBeUndefined();
});
