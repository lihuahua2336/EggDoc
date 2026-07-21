import {
  buildPowerShellInstallerCommand,
  buildShellInstallerCommand,
  quotePowerShellArgument,
  quoteShellArgument,
} from "../installer-command";

function installerUrl(installerOrigin: string, filename: "claude-code.ps1" | "claude-code.sh") {
  return `${installerOrigin.replace(/\/$/, "")}/install/${filename}`;
}

export function buildClaudeCodeShellDefaultInstallCommand(
  installerOrigin: string,
) {
  return buildShellInstallerCommand({
    scriptUrl: installerUrl(installerOrigin, "claude-code.sh"),
  });
}

export function buildClaudeCodePowerShellDefaultInstallCommand(
  installerOrigin: string,
) {
  return buildPowerShellInstallerCommand({
    scriptUrl: installerUrl(installerOrigin, "claude-code.ps1"),
  });
}

export function buildClaudeCodeShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  models,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  models: ClaudeCodeModels;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  return buildShellInstallerCommand({
    argumentsText:
      `--eggai --sk-key ${quoteShellArgument(apiKey)} --baseurl ${quoteShellArgument(anthropicBaseUrl)} ` +
    `--model ${quoteShellArgument(models.main)} ` +
    `--opus-model ${quoteShellArgument(models.opus)} ` +
    `--sonnet-model ${quoteShellArgument(models.sonnet)} ` +
    `--haiku-model ${quoteShellArgument(models.haiku)} ` +
      `--fable-model ${quoteShellArgument(models.fable)}`,
    scriptUrl: installerUrl(installerOrigin, "claude-code.sh"),
  });
}

export function buildClaudeCodePowerShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  models,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  models: ClaudeCodeModels;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  return buildPowerShellInstallerCommand({
    argumentsText:
      `-EggAi -SkKey ${quotePowerShellArgument(apiKey)} -BaseUrl ${quotePowerShellArgument(anthropicBaseUrl)} ` +
      `-Model ${quotePowerShellArgument(models.main)} ` +
      `-OpusModel ${quotePowerShellArgument(models.opus)} ` +
      `-SonnetModel ${quotePowerShellArgument(models.sonnet)} ` +
      `-HaikuModel ${quotePowerShellArgument(models.haiku)} ` +
      `-FableModel ${quotePowerShellArgument(models.fable)}`,
    scriptUrl: installerUrl(installerOrigin, "claude-code.ps1"),
  });
}

export function normalizeClaudeCodeBaseUrl(baseUrl: string) {
  const withoutTrailingSlashes = baseUrl.replace(/\/+$/, "");
  return withoutTrailingSlashes.replace(/\/v1$/i, "");
}

export type ClaudeCodeModels = {
  fable: string;
  haiku: string;
  main: string;
  opus: string;
  sonnet: string;
};

const supportedClaudeModels = {
  fable: ["claude-fable-5"],
  haiku: ["claude-haiku-4-5"],
  opus: ["claude-opus-4-8", "claude-opus-4-7", "claude-opus-4-6"],
  sonnet: ["claude-sonnet-5", "claude-sonnet-4-6"],
} as const;

export function selectClaudeCodeModels(modelNames: string[]): ClaudeCodeModels | undefined {
  const sonnet = selectSupportedModel(modelNames, supportedClaudeModels.sonnet);
  const sonnet5 = selectSupportedModel(modelNames, ["claude-sonnet-5"]);
  const opus = selectSupportedModel(modelNames, supportedClaudeModels.opus);
  const fable = selectSupportedModel(modelNames, supportedClaudeModels.fable);
  const haiku = selectSupportedModel(modelNames, supportedClaudeModels.haiku);
  const main = fable ?? sonnet5 ?? opus ?? sonnet ?? haiku;
  if (!main) return undefined;

  return {
    fable: fable ?? sonnet ?? main,
    haiku: haiku ?? fable ?? sonnet ?? main,
    main,
    opus: opus ?? main,
    sonnet: sonnet ?? main,
  };
}

function selectSupportedModel(modelNames: string[], priority: readonly string[]) {
  for (const supportedName of priority) {
    const match = modelNames.find((name) => name.toLowerCase() === supportedName);
    if (match) return match;
  }
  return undefined;
}
