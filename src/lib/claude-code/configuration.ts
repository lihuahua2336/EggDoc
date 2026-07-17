function installerUrl(installerOrigin: string, filename: "claude-code.ps1" | "claude-code.sh") {
  return `${installerOrigin.replace(/\/$/, "")}/install/${filename}`;
}

export function buildClaudeCodeShellDefaultInstallCommand(installerOrigin: string) {
  return `curl -fsSL ${quoteShellArgument(installerUrl(installerOrigin, "claude-code.sh"))} | sh`;
}

export function buildClaudeCodePowerShellDefaultInstallCommand(installerOrigin: string) {
  return `irm ${quotePowerShellArgument(installerUrl(installerOrigin, "claude-code.ps1"))} | iex`;
}

export function buildClaudeCodeShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  model,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  model: string;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  return (
    `curl -fsSL ${quoteShellArgument(installerUrl(installerOrigin, "claude-code.sh"))} | sh -s -- ` +
    `--eggai --sk-key ${quoteShellArgument(apiKey)} --baseurl ${quoteShellArgument(anthropicBaseUrl)} ` +
    `--model ${quoteShellArgument(model)}`
  );
}

export function buildClaudeCodePowerShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  model,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  model: string;
}) {
  const anthropicBaseUrl = normalizeClaudeCodeBaseUrl(baseUrl);
  return (
    `& ([scriptblock]::Create((irm ${quotePowerShellArgument(installerUrl(installerOrigin, "claude-code.ps1"))}))) ` +
    `-EggAi -SkKey ${quotePowerShellArgument(apiKey)} -BaseUrl ${quotePowerShellArgument(anthropicBaseUrl)} ` +
    `-Model ${quotePowerShellArgument(model)}`
  );
}

export function normalizeClaudeCodeBaseUrl(baseUrl: string) {
  const withoutTrailingSlashes = baseUrl.replace(/\/+$/, "");
  return withoutTrailingSlashes.replace(/\/v1$/i, "");
}

export function selectClaudeCodeModel(modelNames: string[]) {
  const claudeModels = modelNames.filter((name) => name.toLowerCase().includes("claude"));
  return (
    claudeModels.find((name) => name.toLowerCase().includes("sonnet")) ?? claudeModels[0]
  );
}

function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function quotePowerShellArgument(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
