import { expect, test } from "@playwright/test";

import {
  buildClaudeCodePowerShellDefaultInstallCommand,
  buildClaudeCodePowerShellInstallCommand,
  buildClaudeCodeShellDefaultInstallCommand,
  buildClaudeCodeShellInstallCommand,
  normalizeClaudeCodeBaseUrl,
  selectClaudeCodeModels,
} from "../../src/lib/claude-code/configuration";

test("default commands install Claude Code without changing its provider", () => {
  expect(buildClaudeCodeShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/claude-code.sh' | sh",
  );
  expect(buildClaudeCodePowerShellDefaultInstallCommand("https://docs.example.test/root")).toBe(
    "irm 'https://docs.example.test/root/install/claude-code.ps1' | iex",
  );
});

test("EggAi commands safely quote the selected Claude Code credential and URL", () => {
  expect(
    buildClaudeCodeShellInstallCommand({
      apiKey: "sk-reader's-$HOME",
      baseUrl: "https://api.example.test/v1",
      installerOrigin: "https://docs.example.test/root",
      models: {
        fable: "claude-fable-5",
        haiku: "claude-fable-5",
        main: "claude-sonnet-5",
        opus: "claude-opus-4-8",
        sonnet: "claude-sonnet-5",
      },
    }),
  ).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/claude-code.sh' | sh -s -- " +
      "--eggai --sk-key 'sk-reader'\"'\"'s-$HOME' --baseurl 'https://api.example.test' " +
      "--model 'claude-sonnet-5' --opus-model 'claude-opus-4-8' " +
      "--sonnet-model 'claude-sonnet-5' --haiku-model 'claude-fable-5' " +
      "--fable-model 'claude-fable-5'",
  );

  expect(
    buildClaudeCodePowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1",
      installerOrigin: "https://docs.example.test/root's",
      models: {
        fable: "claude-fable-5",
        haiku: "claude-fable-5",
        main: "claude-sonnet-5",
        opus: "claude-opus-4-8",
        sonnet: "claude-sonnet-5",
      },
    }),
  ).toBe(
    "& ([scriptblock]::Create((irm 'https://docs.example.test/root''s/install/claude-code.ps1'))) " +
      "-EggAi -SkKey 'sk-reader''s-$HOME; `exit`' -BaseUrl 'https://api.example.test' " +
      "-Model 'claude-sonnet-5' -OpusModel 'claude-opus-4-8' " +
      "-SonnetModel 'claude-sonnet-5' -HaikuModel 'claude-fable-5' " +
      "-FableModel 'claude-fable-5'",
  );
});

test("Claude Code assigns the preferred EggAi model for each model role", () => {
  expect(
    selectClaudeCodeModels([
      "gpt-5.2",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-fable-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
    ]),
  ).toEqual({
    fable: "claude-fable-5",
    haiku: "claude-fable-5",
    main: "claude-sonnet-5",
    opus: "claude-opus-4-8",
    sonnet: "claude-sonnet-5",
  });
});

test("Claude Code uses the highest available family versions and rejects a list without Claude", () => {
  expect(
    selectClaudeCodeModels([
      "anthropic/claude-haiku-4-5",
      "anthropic/claude-opus-4-1",
      "anthropic/claude-opus-4-7",
      "anthropic/claude-sonnet-4-5",
    ]),
  ).toEqual({
    fable: "anthropic/claude-sonnet-4-5",
    haiku: "anthropic/claude-haiku-4-5",
    main: "anthropic/claude-sonnet-4-5",
    opus: "anthropic/claude-opus-4-7",
    sonnet: "anthropic/claude-sonnet-4-5",
  });
  expect(selectClaudeCodeModels(["gpt-5.2", "gemini-3-pro"])).toBeUndefined();
});

test("Claude Code removes the OpenAI v1 suffix before appending Anthropic endpoints", () => {
  expect(normalizeClaudeCodeBaseUrl("https://api.example.test/v1")).toBe(
    "https://api.example.test",
  );
  expect(normalizeClaudeCodeBaseUrl("https://api.example.test/gateway/v1/")).toBe(
    "https://api.example.test/gateway",
  );
  expect(normalizeClaudeCodeBaseUrl("https://api.example.test/anthropic")).toBe(
    "https://api.example.test/anthropic",
  );
});
