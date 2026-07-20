import { expect, test } from "@playwright/test";

import {
  buildPowerShellInstallerCommand,
  buildShellInstallerCommand,
} from "../../src/lib/installer-command";
import { buildPowerShellInstallCommand } from "../../src/lib/codex/configuration";

test("Shell command matches the locked one-line installer contract", () => {
  const command = buildShellInstallerCommand({
    argumentsText: "--eggai --sk-key 'sk-test' --model 'gpt-5.6-sol'",
    scriptUrl: "https://docs.example.test/install/codex.sh",
  });

  expect(command).toBe(
    "curl -fsSL 'https://docs.example.test/install/codex.sh' | sh -s -- --eggai --sk-key 'sk-test' --model 'gpt-5.6-sol'",
  );
  expect(command).not.toContain("mktemp");
  expect(command).not.toContain("--retry");
  expect(command).not.toContain("eggai.env");
});

test("PowerShell command matches the locked one-line installer contract", () => {
  const command = buildPowerShellInstallerCommand({
    argumentsText: "-EggAi -Model 'gpt-5.6-sol'",
    scriptUrl: "https://docs.example.test/install/codex.ps1",
  });

  expect(command).toBe(
    "& ([scriptblock]::Create((Invoke-RestMethod -UseBasicParsing -Uri 'https://docs.example.test/install/codex.ps1'))) -EggAi -Model 'gpt-5.6-sol'",
  );
  expect(command).not.toContain("foreach");
  expect(command).not.toContain("TimeoutSec");
  expect(command).not.toContain("Start-Process");
  expect(command).not.toContain("EGGAI_CODEX_ENV_SCOPE");
});

test("PowerShell configuration keeps selected values as direct script arguments", () => {
  const command = buildPowerShellInstallCommand({
    apiKey: "sk-reader's-$HOME; `exit`",
    baseUrl: "https://api.example.test/v1?group=reader's&value=$HOME",
    installerOrigin: "https://docs.example.test/root",
    language: "en-us",
    model: "gpt-5.6-sol",
  });

  expect(command).toContain("Invoke-RestMethod -UseBasicParsing -Uri");
  expect(command).toContain("-SkKey 'sk-reader''s-$HOME; `exit`'");
  expect(command).toContain("-BaseUrl 'https://api.example.test/v1?group=reader''s&value=$HOME'");
  expect(command).toContain("-Language 'en-us' -Model 'gpt-5.6-sol'");
  expect(command).not.toContain("EGGAI_CODEX_ENV_SCOPE");
});
