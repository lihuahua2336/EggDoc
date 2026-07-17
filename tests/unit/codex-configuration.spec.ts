import { expect, test } from "@playwright/test";

import {
  buildCodexConfigToml,
  buildPowerShellDefaultInstallCommand,
  buildPowerShellInstallCommand,
  buildShellDefaultInstallCommand,
  buildShellInstallCommand,
} from "../../src/lib/codex/configuration";

test("default commands install Codex without selecting a third-party provider", () => {
  expect(buildShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/codex.sh' | sh",
  );
  expect(buildPowerShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
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
    }),
  ).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/codex.sh' | sh -s -- " +
      "--eggai " +
      "--sk-key 'sk-reader'\"'\"'s-$HOME' " +
      "--baseurl 'https://api.example.test/v1?group=reader'\"'\"'s' " +
      "--language 'en-us'",
  );
});

test("PowerShell configuration safely quotes the selected credential, URL, language, and installer", () => {
  expect(
    buildPowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
      installerOrigin: "https://docs.example.test/root's",
      language: "en-us",
    }),
  ).toBe(
    "& ([scriptblock]::Create((irm 'https://docs.example.test/root''s/install/codex.ps1'))) " +
      "-EggAi -SkKey 'sk-reader''s-$HOME; `exit`' " +
      "-BaseUrl 'https://api.example.test/v1?group=reader''s&value=$HOME' " +
      "-Language 'en-us'",
  );
});

test("Codex provider configuration escapes TOML and never contains the API key", () => {
  const config = buildCodexConfigToml({
    baseUrl: 'https://api.example.test/v1?label="reader"\\team',
    language: "zh-cn",
  });

  expect(config).toBe(
    '# EggAi Codex provider configuration. This file does not contain your API key.\n' +
      'cli_auth_credentials_store = "file"\n' +
      'model_provider = "eggai"\n' +
      'developer_instructions = "请默认使用简体中文回答，除非用户明确要求其他语言。"\n' +
      "\n" +
      "[model_providers.eggai]\n" +
      'name = "EggAi"\n' +
      'base_url = "https://api.example.test/v1?label=\\\"reader\\\"\\\\team"\n' +
      'wire_api = "responses"\n' +
      "requires_openai_auth = true",
  );
  expect(config).not.toContain("sk-reader-secret");
});

test("English configuration uses the English Codex instruction", () => {
  expect(
    buildCodexConfigToml({ baseUrl: "https://api.example.test/v1", language: "en-us" }),
  ).toContain(
    'developer_instructions = "Respond in English by default unless the user explicitly asks for another language."',
  );
});
