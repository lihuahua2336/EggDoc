export const CODEX_LANGUAGES = ["zh-cn", "en-us"] as const;

export type CodexLanguage = (typeof CODEX_LANGUAGES)[number];

function installerUrl(installerOrigin: string, filename: "codex.ps1" | "codex.sh") {
  return `${installerOrigin.replace(/\/$/, "")}/install/${filename}`;
}

const developerInstructions: Record<CodexLanguage, string> = {
  "en-us": "Respond in English by default unless the user explicitly asks for another language.",
  "zh-cn": "请默认使用简体中文回答，除非用户明确要求其他语言。",
};

export function buildShellDefaultInstallCommand(installerOrigin: string) {
  const scriptUrl = installerUrl(installerOrigin, "codex.sh");
  return `curl -fsSL ${quoteShellArgument(scriptUrl)} | sh`;
}

export function buildPowerShellDefaultInstallCommand(installerOrigin: string) {
  const scriptUrl = installerUrl(installerOrigin, "codex.ps1");
  return `irm ${quotePowerShellArgument(scriptUrl)} | iex`;
}

export function buildShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  language,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  language: CodexLanguage;
}) {
  const scriptUrl = installerUrl(installerOrigin, "codex.sh");

  return (
    `curl -fsSL ${quoteShellArgument(scriptUrl)} | sh -s -- ` +
    "--eggai " +
    `--sk-key ${quoteShellArgument(apiKey)} ` +
    `--baseurl ${quoteShellArgument(baseUrl)} ` +
    `--language ${quoteShellArgument(language)}`
  );
}

export function buildPowerShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  language,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  language: CodexLanguage;
}) {
  const scriptUrl = installerUrl(installerOrigin, "codex.ps1");

  return (
    `& ([scriptblock]::Create((irm ${quotePowerShellArgument(scriptUrl)}))) ` +
    `-EggAi -SkKey ${quotePowerShellArgument(apiKey)} ` +
    `-BaseUrl ${quotePowerShellArgument(baseUrl)} ` +
    `-Language ${quotePowerShellArgument(language)}`
  );
}

export function buildCodexConfigToml({
  baseUrl,
  language,
}: {
  baseUrl: string;
  language: CodexLanguage;
}) {
  return [
    "# EggAi Codex provider configuration. This file does not contain your API key.",
    'cli_auth_credentials_store = "file"',
    'model_provider = "eggai"',
    `developer_instructions = "${escapeTomlBasicString(developerInstructions[language])}"`,
    "",
    "[model_providers.eggai]",
    'name = "EggAi"',
    `base_url = "${escapeTomlBasicString(baseUrl)}"`,
    'wire_api = "responses"',
    "requires_openai_auth = true",
  ].join("\n");
}

function quoteShellArgument(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function quotePowerShellArgument(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function escapeTomlBasicString(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\u0008/g, "\\b")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\f/g, "\\f")
    .replace(/\r/g, "\\r");
}
