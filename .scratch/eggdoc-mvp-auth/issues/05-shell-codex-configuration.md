# Generate the Shell Codex Integration Configuration

Status: ready-for-agent
Execution: completed
Closed: 2026-07-17

User stories: 26-27, 32-35, 37-40, 42-43

## Parent

`../PRD.md`

## What to build

Turn the Selected API Credential into copyable generic values, a non-secret Codex provider configuration, and a complete macOS/Linux installation command backed by the maintained hosted Shell installer. Add the `zh-cn` default and English option, centralized public installer origin, explicit secret-copy action, and the required clipboard and shell-history warning.

## Acceptance criteria

- [x] Readers can separately copy the API key, Base URL, non-secret Codex configuration, and complete Shell command.
- [x] The Shell command uses the selected credential's read-only Base URL, selected language, and centrally configured installer origin.
- [x] Language defaults to simplified Chinese, supports English, and persists without persisting the generated command or key.
- [x] Copying a complete command containing the raw key requires an explicit action beside a visible exposure warning.
- [x] Anonymous Readers receive the same copy actions with the Configuration Placeholder instead of a raw key.
- [x] The maintained Shell installer accepts the generated parameters and retains stable default, validation, backup, and login behavior.
- [x] Quoting tests cover credential, URL, and language generation, while Shell syntax and dry-run tests verify redaction and generated provider configuration without installing Codex.

## Blocked by

- `04-display-and-select-api-credentials.md`

## Comments

### 2026-07-15 implementation

- Implementation commit: `4cda841a` (`Generate Shell Codex configuration`).
- The Codex panel now exposes separate API Key, read-only Base URL, non-secret `config.toml`, language, and complete Shell command copy actions. Language defaults to `zh-cn`, supports `en-us`, and persists only `eggdoc:codex-language`.
- Shell templates use a centralized `PUBLIC_INSTALLER_ORIGIN` (default `https://eggdoc.pages.dev`) and single-quote shell escaping. The complete command preview is redacted; the raw Selected API Credential is constructed only inside the explicit copy handler. Copy status resets when credential, Base URL, or language changes.
- The explicit-copy warning names clipboard, shell history, screenshots, and shared commands. Anonymous state uses `sk-EGGDOC-EXAMPLE-REPLACE-ME`; authenticated values remain in current page memory and are not written to browser storage.
- Browser behavior coverage includes anonymous and authenticated copy flows, English selection and persistence, no secret-bearing persistence, explicit raw-command copy, status reset, and a 390px mobile layout regression. In-app browser checks at 1280px and 390px confirmed no panel overflow; long commands scroll only within their code blocks.
- Template tests cover API-key/URL apostrophe quoting, TOML escaping, language instructions, and redaction. Shell tests use `sh -n` and fake-key `--dry-run` only for defaults, validation, provider preview, backup/login plan, and key redaction. No real Codex installation, download, login, or production EggAi/Logto service was executed.
- Verification: `npm test` passed 43 tests; `npm run check` reported 0 errors, warnings, or hints; `npm run build` completed successfully; production `dist` contained no personalized fixture keys or Base URLs.
- `/code-review` Standards and Spec follow-up reviews reported no remaining or new findings. Task 06 was not started.

### 2026-07-15 UX follow-up

- Simplified the default panel to a Quick Start card with one visible Shell command and one primary copy action, matching the requested one-click workflow.
- Moved credential selection, language, API Key/Base URL, `config.toml`, and PowerShell controls into a collapsed `配置详情` disclosure while keeping login, activation, retry, and reauthorization actions visible.
- Desktop and 390px in-app browser checks confirmed the compact card, collapsed details, internal command scrolling, and no page overflow. Full verification passed 44 tests with 0 type-check diagnostics.
