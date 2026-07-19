export const PUBLIC_EGGAI_BASE_URL =
  import.meta.env.PUBLIC_EGGAI_BASE_URL ?? "https://api.eggai.icu/v1";

export const PUBLIC_INSTALLER_ORIGIN = (
  import.meta.env.PUBLIC_INSTALLER_ORIGIN ?? "https://eggdoc.pages.dev"
).replace(/\/$/, "");

export const PUBLIC_CODEX_INSTALLER_URL = import.meta.env.PUBLIC_CODEX_INSTALLER_URL;
export const PUBLIC_CLAUDE_CODE_INSTALLER_URL = import.meta.env.PUBLIC_CLAUDE_CODE_INSTALLER_URL;

export const DEFAULT_CODEX_LANGUAGE = "zh-cn";
export const CONFIGURATION_PLACEHOLDER = "sk-EGGDOC-EXAMPLE-REPLACE-ME";
