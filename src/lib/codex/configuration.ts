import {
  buildPowerShellInstallerCommand,
  buildShellInstallerCommand,
  quotePowerShellArgument,
  quoteShellArgument,
} from "../installer-command";

export const CODEX_LANGUAGES = ["zh-cn", "en-us"] as const;
export const CODEX_DEFAULT_MODEL = "gpt-5.6-sol";

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
  return `${buildShellInstallerCommand({ scriptUrl })} && export PATH="$HOME/.local/share/eggdoc-node/current/bin:$HOME/.local/bin:$PATH"`;
}

export function buildPowerShellDefaultInstallCommand(installerOrigin: string) {
  const scriptUrl = installerUrl(installerOrigin, "codex.ps1");
  return buildPowerShellInstallerCommand({ scriptUrl });
}

export function buildShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  language,
  model,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  language: CodexLanguage;
  model: string;
}) {
  const scriptUrl = installerUrl(installerOrigin, "codex.sh");

  return `${buildShellInstallerCommand({
    argumentsText:
      "--eggai " +
    `--sk-key ${quoteShellArgument(apiKey)} ` +
      `--baseurl ${quoteShellArgument(baseUrl)} ` +
      `--language ${quoteShellArgument(language)} ` +
      `--model ${quoteShellArgument(model)}`,
    scriptUrl,
  })} && . "${"${CODEX_HOME:-$HOME/.codex}"}/eggai.env"`;
}

export function buildPowerShellInstallCommand({
  apiKey,
  baseUrl,
  installerOrigin,
  language,
  model,
}: {
  apiKey: string;
  baseUrl: string;
  installerOrigin: string;
  language: CodexLanguage;
  model: string;
}) {
  const scriptUrl = installerUrl(installerOrigin, "codex.ps1");

  return buildPowerShellInstallerCommand({
    argumentsText:
      `-EggAi -SkKey ${quotePowerShellArgument(apiKey)} ` +
      `-BaseUrl ${quotePowerShellArgument(baseUrl)} ` +
      `-Language ${quotePowerShellArgument(language)} ` +
      `-Model ${quotePowerShellArgument(model)}`,
    scriptUrl,
  });
}

export function buildCodexConfigToml({
  baseUrl,
  language,
  model,
}: {
  baseUrl: string;
  language: CodexLanguage;
  model: string;
}) {
  return [
    "# EggAi Codex provider configuration. This file does not contain your API key.",
    'model_provider = "eggai"',
    'approval_policy = "never"',
    'sandbox_mode = "danger-full-access"',
    `developer_instructions = "${escapeTomlBasicString(developerInstructions[language])}"`,
    `model = "${escapeTomlBasicString(model)}"`,
    "",
    "[model_providers.eggai]",
    'name = "EggAi"',
    `base_url = "${escapeTomlBasicString(baseUrl)}"`,
    'env_key = "EGGAI_API_KEY"',
    'env_key_instructions = "EggDoc stores EGGAI_API_KEY in the user environment."',
    'wire_api = "responses"',
  ].join("\n");
}

export function codexModels(modelNames: string[]) {
  return modelNames.filter((name) => {
    const basename = name.toLowerCase().split("/").at(-1) ?? "";
    return /^gpt-\d/.test(basename);
  });
}

export function selectCodexModel(modelNames: string[]) {
  return codexModels(modelNames)[0];
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
