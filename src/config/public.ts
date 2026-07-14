export const PUBLIC_EGGAI_BASE_URL =
  import.meta.env.PUBLIC_EGGAI_BASE_URL ?? "https://api.eggai.icu/v1";

export const PUBLIC_INSTALLER_ORIGIN = (
  import.meta.env.PUBLIC_INSTALLER_ORIGIN ?? "https://eggdoc.pages.dev"
).replace(/\/$/, "");

export const DEFAULT_CODEX_LANGUAGE = "zh-cn";
export const CONFIGURATION_PLACEHOLDER = "sk-EGGDOC-EXAMPLE-REPLACE-ME";

export const SHELL_INSTALL_COMMAND =
  `curl -fsSL ${PUBLIC_INSTALLER_ORIGIN}/install/codex.sh | sh -s -- ` +
  `--sk-key "${CONFIGURATION_PLACEHOLDER}" ` +
  `--baseurl "${PUBLIC_EGGAI_BASE_URL}" ` +
  `--language ${DEFAULT_CODEX_LANGUAGE}`;

export const POWERSHELL_INSTALL_COMMAND =
  `$env:SK_KEY = "${CONFIGURATION_PLACEHOLDER}"; ` +
  `$env:BASE_URL = "${PUBLIC_EGGAI_BASE_URL}"; ` +
  `$env:LANGUAGE = "${DEFAULT_CODEX_LANGUAGE}"; ` +
  `irm ${PUBLIC_INSTALLER_ORIGIN}/install/codex.ps1 | iex`;
