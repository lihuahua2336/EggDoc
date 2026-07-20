# Localhost real EggAi acceptance

This runbook configures EggDoc against a dedicated non-production EggAi test account and the real Logto and EggAi services. It intentionally contains no real credentials or tenant-specific values.

## Prerequisites

- Tasks 06, 07, and 08 are accepted and committed.
- The maintainer has access to a dedicated EggDoc Logto application and a non-production EggAi test account.
- The Logto application is a confidential web application with Authorization Code and refresh-token support.
- The application allows this exact redirect URI: `http://127.0.0.1:4322/auth/callback`.
- The application requests the EggAi resource audience `https://api.eggai.icu/api` and the `ecosystem:me`, `ecosystem:models:read`, and `ecosystem:tokens:read` scopes required by `/api/ecosystem/me`, `/api/ecosystem/models`, and `/api/ecosystem/tokens`.
- Authorization requests include `prompt=consent` because the encrypted EggDoc Session requires a refresh token for `offline_access`.

EggDoc clears only its own local Session on logout. No Logto post-logout redirect URI is required for this acceptance pass.

## Local configuration

Copy `.env.example` to the ignored `.env.local` file and replace the deployment-specific example values. Keep `.env.local` on this machine only; never paste or commit its contents.

| Variable | Required | Source or format |
| --- | --- | --- |
| `EGGDOC_OIDC_ISSUER` | Yes | HTTPS issuer URL for the EggAi Logto tenant. |
| `EGGDOC_OIDC_CLIENT_ID` | Yes | Client ID of the dedicated EggDoc Logto application. |
| `EGGDOC_OIDC_CLIENT_SECRET` | For a confidential client | Client secret of the dedicated EggDoc Logto application. |
| `EGGDOC_OIDC_RESOURCE` | Yes | EggAi ecosystem API resource indicator: `https://api.eggai.icu/api`. |
| `EGGDOC_OIDC_SCOPES` | Yes | `openid profile offline_access ecosystem:me ecosystem:models:read ecosystem:tokens:read`. |
| `EGGDOC_SESSION_SECRET` | Yes | Exactly 32 random bytes encoded as unpadded Base64URL. |
| `EGGDOC_EGGAI_PLATFORM_URL` | Yes | Browser-facing EggAi API platform origin used for activation and management. |
| `EGGDOC_EGGAI_ECOSYSTEM_URL` | Yes | Server-facing origin that exposes the three `/api/ecosystem/*` routes. |
| `PUBLIC_EGGAI_BASE_URL` | Optional | Public OpenAI-compatible API base URL used when an EggAi API Credential omits `base_url`. |
| `PUBLIC_INSTALLER_ORIGIN` | Optional | Public origin that hosts the EggDoc install scripts. Defaults to `https://doc.eggai.icu`. |

Generate a localhost-only Session secret with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Do not put real values in `wrangler.toml`; its `env.test` section is reserved for automated fixtures.

The EggDoc scripts use official product channels: native installer URLs for Codex CLI and Claude Code CLI, and exact Microsoft Store product `9PLM9XGG6VKS` for the Windows Codex desktop app. They do not use a site-provided binary package. If an official channel cannot be reached, the command fails clearly instead of silently switching sources. Installer subprocesses get a process-scoped `https://registry.npmmirror.com` npm registry default.

The committed `.env.test` contains recognizable fake values and overrides `.env.local` during `astro build --mode test`. Do not replace those fixtures with real service settings.

## Build and run

Astro reads the server environment during the build, so rebuild after changing `.env.local`:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 4322
```

Open `http://127.0.0.1:4322/eggai/codex-installer/#codex-config`. Use `127.0.0.1` consistently because the registered redirect URI and browser origin must match exactly.

## Acceptance sequence

1. Confirm the public tutorial and Configuration Placeholder load before login.
2. Start login from the tutorial panel, authenticate through real Logto, and confirm return to `#codex-config` with the EggAi identity visible.
3. With an inactive test EggAi API Account, open activation in a new tab, complete activation, return to EggDoc, and confirm an EggAi API Credential appears after the bounded refresh or a manual recheck.
4. Confirm the active panel shows an EggAi API Credential, read-only Base URL, and model summary. If the EggAi API Account has multiple EggAi API Credentials, switch between them and confirm the Selected API Credential changes.
5. Copy the API key, Base URL, non-secret `config.toml`, Shell command, and PowerShell command. Do not execute either generated installer command during acceptance.
6. Leave the page open until the short-lived access token needs refresh, then request the account again and confirm the EggDoc Session remains authenticated.
7. Exit EggDoc and confirm the page returns to the anonymous placeholder while the shared EggAi/Logto session remains available for a subsequent login.
8. During an unavailable or failed integration response, confirm the public article remains readable and only the configuration panel degrades.

## Evidence rules

Record only pass/fail outcomes, HTTP status classes, timestamps, and generic UI states. Never record API keys, client secrets, access tokens, resource tokens, refresh tokens, encrypted Session cookies, full authorization URLs, account identifiers, or unredacted upstream payloads. Before committing, inspect staged changes and confirm `.env.local` is absent.

The current ecosystem EggAi API Credential contract uses `token_id`, `api_key`, `token_name`, `group`, and `base_url`. Treat any different field shape as an incompatible upstream response rather than silently accepting legacy aliases.
