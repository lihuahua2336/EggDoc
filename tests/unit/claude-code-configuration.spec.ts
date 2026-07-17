import { expect, test } from "@playwright/test";

import {
  buildClaudeCodePowerShellDefaultInstallCommand,
  buildClaudeCodePowerShellInstallCommand,
  buildClaudeCodeShellDefaultInstallCommand,
  buildClaudeCodeShellInstallCommand,
  normalizeClaudeCodeBaseUrl,
  selectClaudeCodeModel,
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
      model: "claude-sonnet-4-5",
    }),
  ).toBe(
    "curl -fsSL 'https://docs.example.test/root/install/claude-code.sh' | sh -s -- " +
      "--eggai --sk-key 'sk-reader'\"'\"'s-$HOME' --baseurl 'https://api.example.test' " +
      "--model 'claude-sonnet-4-5'",
  );

  expect(
    buildClaudeCodePowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1",
      installerOrigin: "https://docs.example.test/root's",
      model: "claude-sonnet-4-5",
    }),
  ).toBe(
    "& ([scriptblock]::Create((irm 'https://docs.example.test/root''s/install/claude-code.ps1'))) " +
      "-EggAi -SkKey 'sk-reader''s-$HOME; `exit`' -BaseUrl 'https://api.example.test' " +
      "-Model 'claude-sonnet-4-5'",
  );
});

test("Claude Code prefers a Sonnet model and rejects a model list without Claude", () => {
  expect(selectClaudeCodeModel(["gpt-5.2", "claude-haiku-4-5", "claude-sonnet-4-5"])).toBe(
    "claude-sonnet-4-5",
  );
  expect(selectClaudeCodeModel(["anthropic/claude-opus-4-1", "gpt-5.2"])).toBe(
    "anthropic/claude-opus-4-1",
  );
  expect(selectClaudeCodeModel(["gpt-5.2", "gemini-3-pro"])).toBeUndefined();
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
