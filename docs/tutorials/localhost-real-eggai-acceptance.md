# Localhost real EggAi acceptance

This runbook configures EggDoc against a dedicated non-production EggAi test account and the real Logto and Sub2API services. Domains are deployment examples; no usable credentials are included. For the deployed EggDoc example, parameter mapping, Docker updates, and the 401/403 incident review, see [EggDoc + Sub2API 配置与排障手册](eggdoc-sub2api-oidc-runbook.md).

## Prerequisites

- Tasks 06, 07, and 08 are accepted and committed.
- The maintainer has access to a dedicated EggDoc Logto application and a non-production EggAi test account.
- The Logto application is a confidential web application with Authorization Code and refresh-token support.
- The application allows this exact redirect URI: `http://127.0.0.1:4322/auth/callback`.
- The application requests the target API's resource audience (example: `https://api.eggai.icu/api`) and the `ecosystem:me`, `ecosystem:models:read`, and `ecosystem:tokens:read` scopes required by `/api/v1/ecosystem/me`, `/api/v1/ecosystem/models`, and `/api/v1/ecosystem/keys`.
- The target Sub2API allows the EggDoc application Client ID, the test user has these API Resource permissions, and the same `(issuer, subject)` is linked to an enabled Sub2API user. Verify the target instance's `/api/v1/ecosystem/docs`; do not copy the audience from another local or public instance.
- Authorization requests include `prompt=consent` because the encrypted EggDoc Session requires a refresh token for `offline_access`.

EggDoc clears only its own local Session on logout. No Logto post-logout redirect URI is required for this acceptance pass.

## Local configuration

Copy `.env.example` to the ignored `.env.local` file and replace the deployment-specific example values. Keep `.env.local` on this machine only; never paste or commit its contents.

| Variable | Required | Source or format |
| --- | --- | --- |
| `EGGDOC_SITE_URL` | Yes for a fixed origin | Use `http://127.0.0.1:4322` for this localhost pass; production must use the public HTTPS origin and register its exact callback. |
| `EGGDOC_OIDC_ISSUER` | Yes | HTTPS issuer URL for the EggAi Logto tenant. |
| `EGGDOC_OIDC_CLIENT_ID` | Yes | Client ID of the dedicated EggDoc Logto application. |
| `EGGDOC_OIDC_CLIENT_SECRET` | For a confidential client | Client secret of the dedicated EggDoc Logto application. |
| `EGGDOC_OIDC_RESOURCE` | Yes | EggAi ecosystem API resource indicator: `https://api.eggai.icu/api`. |
| `EGGDOC_OIDC_SCOPES` | Yes | `openid profile offline_access ecosystem:me ecosystem:models:read ecosystem:tokens:read`. |
| `EGGDOC_SESSION_SECRET` | Yes | Exactly 32 random bytes encoded as unpadded Base64URL. |
| `EGGDOC_EGGAI_PLATFORM_URL` | Yes | Browser-facing EggAi API platform origin used for activation and management. |
| `EGGDOC_EGGAI_ECOSYSTEM_URL` | Yes | Server-facing root origin exposing `/api/v1/ecosystem/me`, `/models`, and `/keys`; do not append a `/v1` path. |
| `PUBLIC_EGGAI_BASE_URL` | Optional | Public OpenAI-compatible API base URL used when an EggAi API Credential omits `base_url`. |
| `PUBLIC_INSTALLER_ORIGIN` | Optional | Public origin that hosts the EggDoc install scripts. Defaults to `https://doc.eggai.icu`. |

Generate a localhost-only Session secret with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Do not put real values in `wrangler.toml`; its `env.test` section is reserved for automated fixtures.

The EggDoc scripts use official product identities: `@openai/codex` and `@anthropic-ai/claude-code` for CLI installations, and exact Microsoft Store product `9PLM9XGG6VKS` for the Windows Codex desktop app. CLI scripts detect Node.js and install Node 22 from the official Node.js channel when the runtime is missing or too old. They do not use a site-provided binary package. If an official Node.js or Store channel, or the npm registry, cannot be reached, the command fails clearly instead of silently switching sources. npm receives a command-scoped `https://registry.npmmirror.com` registry default.

The committed `.env.test` contains recognizable fake values and overrides `.env.local` during `astro build --mode test`. Do not replace those fixtures with real service settings.

## Build and run

For the primary Node runtime, build the portable server and explicitly load the local environment at startup (Bash example):

```bash
EGGDOC_DEPLOY_TARGET=node npm run build
HOST=127.0.0.1 PORT=4322 node --env-file=.env.local dist/server/entry.mjs
```

On PowerShell, set `$env:EGGDOC_DEPLOY_TARGET = 'node'` before building and `$env:HOST = '127.0.0.1'; $env:PORT = '4322'` before running the same Node command. For Docker, use the ignored `.env` and `docker compose up -d --build app` instead. Secrets are injected at container startup; canonical site and `PUBLIC_*` changes require rebuilding. A plain container restart does not update environment variables.

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

The current Sub2API contract uses a `code: 0` success envelope, model objects with `model`, and paginated Key data in `data.items` with `page/pages` metadata. Key fields are `id`, `key`, `name`, and nullable `group_id`; the current API omits `base_url`, so EggDoc uses `PUBLIC_EGGAI_BASE_URL`. The adapter reads all pages, excludes explicitly expired or quota-exhausted keys, and preserves legacy envelope/field parsing compatibility without falling back to legacy route paths. See ADR 0030 for the migration decision.

HTTP 403 is a permission or identity-link failure and must not clear an otherwise valid EggDoc Session. `ecosystem_client_not_allowed` requires adding the EggDoc Client ID to the target API's allowlist; `insufficient_scope` requires the relevant role grants and a new Token. Neither is fixed by repeatedly rebuilding EggDoc. An unlinked Sub2API identity leads to activation; an upstream 401 may require reauthorization. Record only the allowlisted reason, never Token contents.
