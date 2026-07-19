function installerUrl(installerOrigin: string, filename: "claude-code.ps1" | "claude-code.sh") {
  return `${installerOrigin.replace(/\/$/, "")}/install/${filename}`;
}

function overrideInstallerUrl(
  installerOrigin: string | undefined,
  filename: "claude-code.ps1" | "claude-code.sh",
) {
  return installerOrigin ? `${installerOrigin.replace(/\/$/, "")}/${filename}` : undefined;
}

export function buildClaudeCodeShellDefaultInstallCommand(
  installerOrigin: string,
  installerOriginOverride?: string,
) {
  const overrideUrl = overrideInstallerUrl(installerOriginOverride, "claude-code.sh");
  const override = overrideUrl
    ? `CLAUDE_CODE_INSTALLER_URL=${quoteShellArgument(overrideUrl)} `
    : "";
  return `curl -fsSL ${quoteShellArgument(installerUrl(installerOrigin, "claude-code.sh"))} | ${override}sh`;
}

export function buildClaudeCodePowerShellDefaultInstallCommand(
  installerOrigin: string,
  installerOriginOverride?: string,
) {
  const overrideUrl = overrideInstallerUrl(installerOriginOverride, "claude-code.ps1");
  const override = overrideUrl
    ? `$env:CLAUDE_CODE_INSTALLER_URL=${quotePowerShellArgument(overrideUrl)}; `
    : "";
  return `${override}irm ${quotePowerShellArgument(installerUrl(installerOrigin, "claude-code.ps1"))} | iex`;
}

export function buildClaudeCodeShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  installerOriginOverride,
  models,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  installerOriginOverride?: string;
  models: ClaudeCodeModels;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  const overrideUrl = overrideInstallerUrl(installerOriginOverride, "claude-code.sh");
  const override = overrideUrl
    ? `CLAUDE_CODE_INSTALLER_URL=${quoteShellArgument(overrideUrl)} `
    : "";
  return (
    `curl -fsSL ${quoteShellArgument(installerUrl(installerOrigin, "claude-code.sh"))} | ${override}sh -s -- ` +
    `--eggai --sk-key ${quoteShellArgument(apiKey)} --baseurl ${quoteShellArgument(anthropicBaseUrl)} ` +
    `--model ${quoteShellArgument(models.main)} ` +
    `--opus-model ${quoteShellArgument(models.opus)} ` +
    `--sonnet-model ${quoteShellArgument(models.sonnet)} ` +
    `--haiku-model ${quoteShellArgument(models.haiku)} ` +
    `--fable-model ${quoteShellArgument(models.fable)}`
  );
}

export function buildClaudeCodePowerShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  installerOriginOverride,
  models,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  installerOriginOverride?: string;
  models: ClaudeCodeModels;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  const overrideUrl = overrideInstallerUrl(installerOriginOverride, "claude-code.ps1");
  const override = overrideUrl
    ? `$env:CLAUDE_CODE_INSTALLER_URL=${quotePowerShellArgument(overrideUrl)}; `
    : "";
  return (
    `${override}& ([scriptblock]::Create((irm ${quotePowerShellArgument(installerUrl(installerOrigin, "claude-code.ps1"))}))) ` +
    `-EggAi -SkKey ${quotePowerShellArgument(apiKey)} -BaseUrl ${quotePowerShellArgument(anthropicBaseUrl)} ` +
    `-Model ${quotePowerShellArgument(models.main)} ` +
    `-OpusModel ${quotePowerShellArgument(models.opus)} ` +
    `-SonnetModel ${quotePowerShellArgument(models.sonnet)} ` +
    `-HaikuModel ${quotePowerShellArgument(models.haiku)} ` +
    `-FableModel ${quotePowerShellArgument(models.fable)}`
  );
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

export function selectClaudeCodeModels(modelNames: string[]): ClaudeCodeModels | undefined {
  const sonnet = selectFamilyModel(modelNames, "sonnet", ["claude-sonnet-5"]);
  const opus = selectFamilyModel(modelNames, "opus", ["claude-opus-4-8"]);
  const fable = selectFamilyModel(modelNames, "fable", ["claude-fable-5"]);
  const haiku = selectFamilyModel(modelNames, "haiku", ["claude-haiku-4-5"]);
  const main = sonnet ?? opus ?? fable ?? haiku;
  if (!main) return undefined;

  return {
    fable: fable ?? sonnet ?? main,
    haiku: haiku ?? fable ?? sonnet ?? main,
    main,
    opus: opus ?? main,
    sonnet: sonnet ?? main,
  };
}

function selectFamilyModel(modelNames: string[], family: string, preferred: string[] = []) {
  const familyPrefix = `claude-${family}`;
  const candidates = modelNames.filter((name) => {
    const basename = name.toLowerCase().split("/").at(-1) ?? "";
    return basename === familyPrefix || basename.startsWith(`${familyPrefix}-`);
  });
  for (const preferredName of preferred) {
    const match = candidates.find(
      (name) => (name.toLowerCase().split("/").at(-1) ?? "") === preferredName,
    );
    if (match) return match;
  }
  return candidates.sort((left, right) => compareModelVersions(right, left, family))[0];
}

function compareModelVersions(left: string, right: string, family: string) {
  const versionPattern = new RegExp(`claude-${family}-(\\d+(?:[-.]\\d+)*)`, "i");
  const leftParts = left.match(versionPattern)?.[1].split(/[-.]/).map(Number) ?? [];
  const rightParts = right.match(versionPattern)?.[1].split(/[-.]/).map(Number) ?? [];
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right);
}

function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function quotePowerShellArgument(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
