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
  const shell = buildClaudeCodeShellDefaultInstallCommand("https://docs.example.test/root");
  const powerShell = buildClaudeCodePowerShellDefaultInstallCommand(
    "https://docs.example.test/root",
  );

  expect(shell).toContain("'https://docs.example.test/root/install/claude-code.sh'");
  expect(powerShell).toContain(
    "Invoke-RestMethod -UseBasicParsing -Uri 'https://docs.example.test/root/install/claude-code.ps1'",
  );
  expect(powerShell).not.toContain("| iex");
});

test("EggAi commands safely quote the selected Claude Code credential and URL", () => {
  const shellCommand = buildClaudeCodeShellInstallCommand({
      apiKey: "sk-reader's-$HOME",
      baseUrl: "https://api.example.test/v1",
      installerOrigin: "https://docs.example.test/root",
      models: {
        fable: "claude-fable-5",
        haiku: "claude-haiku-4-5",
        main: "claude-sonnet-5",
        opus: "claude-opus-4-8",
        sonnet: "claude-sonnet-5",
      },
    });

  expect(shellCommand).toContain("--sk-key 'sk-reader'\"'\"'s-$HOME'");
  expect(shellCommand).toContain("--baseurl 'https://api.example.test'");
  expect(shellCommand).toContain("--model 'claude-sonnet-5'");
  expect(shellCommand).toContain("--fable-model 'claude-fable-5'");

  const powerShellCommand = buildClaudeCodePowerShellInstallCommand({
      apiKey: "sk-reader's-$HOME; `exit`",
      baseUrl: "https://api.example.test/v1",
      installerOrigin: "https://docs.example.test/root's",
      models: {
        fable: "claude-fable-5",
        haiku: "claude-haiku-4-5",
        main: "claude-sonnet-5",
        opus: "claude-opus-4-8",
        sonnet: "claude-sonnet-5",
      },
    });

  expect(powerShellCommand).toContain(
    "Invoke-RestMethod -UseBasicParsing -Uri 'https://docs.example.test/root''s/install/claude-code.ps1'",
  );
  expect(powerShellCommand).toContain("-SkKey 'sk-reader''s-$HOME; `exit`'");
  expect(powerShellCommand).toContain("-BaseUrl 'https://api.example.test'");
  expect(powerShellCommand).toContain("-FableModel 'claude-fable-5'");
  expect(powerShellCommand).toContain("scriptblock");
});

test("Claude Code assigns the preferred EggAi model for each model role", () => {
  expect(
    selectClaudeCodeModels([
      "gpt-5.2",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-fable-5",
      "claude-haiku-5",
      "claude-haiku-4-5",
      "claude-opus-4-8",
      "claude-sonnet-5",
    ]),
  ).toEqual({
    fable: "claude-fable-5",
    haiku: "claude-haiku-4-5",
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
