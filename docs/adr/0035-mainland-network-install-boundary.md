# Mainland network boundary for hosted installers

EggDoc separates installation transport from provider authentication.

The hosted Shell and PowerShell wrappers must validate downloaded installer content, use bounded retries/timeouts, and report a non-zero failure instead of claiming success. The official Codex and Claude installer URLs remain configurable with `CODEX_INSTALLER_URL` and `CLAUDE_CODE_INSTALLER_URL`; a China-accessible mirror, enterprise proxy, or custom domain is an operational deployment choice rather than a hard-coded bypass.

EggAi mode has a different success contract. Codex probes the selected EggAi `/models` endpoint with the selected Bearer key before changing local files. Claude probes the selected EggAi Anthropic Messages endpoint with a bounded streaming tool-use request before installation and settings changes. Successful EggAi configuration therefore depends on the EggAi endpoint being reachable, not on an OpenAI or Anthropic account login.

The scripts do not promise that official account pages or official API endpoints are reachable from mainland China. Default mode intentionally preserves the official provider flow. For a China-facing deployment, `PUBLIC_INSTALLER_ORIGIN` must point to a reachable EggDoc/custom domain. `PUBLIC_CODEX_INSTALLER_ORIGIN` and `PUBLIC_CLAUDE_CODE_INSTALLER_ORIGIN` can inject reviewed reachable mirror directories into generated commands when the upstream installer endpoint is unavailable; the page appends the platform-specific filename. Shell honors standard `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY` variables; Windows PowerShell uses the system/WinHTTP proxy configuration.
