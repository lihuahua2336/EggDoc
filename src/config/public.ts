export const PUBLIC_EGGAI_BASE_URL =
  import.meta.env.PUBLIC_EGGAI_BASE_URL ?? "https://api.eggai.icu/v1";

const defaultInstallerOrigin = "https://doc.eggai.icu";
const configuredInstallerOrigin = (
  import.meta.env.PUBLIC_INSTALLER_ORIGIN ?? defaultInstallerOrigin
).replace(/\/$/, "");
export const PUBLIC_INSTALLER_ORIGIN =
  new URL(configuredInstallerOrigin).hostname.endsWith(".pages.dev")
    ? defaultInstallerOrigin
    : configuredInstallerOrigin;

export const DEFAULT_CODEX_LANGUAGE = "zh-cn";
export const CONFIGURATION_PLACEHOLDER = "sk-EGGDOC-EXAMPLE-REPLACE-ME";
