# Generate the Windows Codex Integration Configuration

Status: ready-for-agent

User stories: 28-31, 33, 36, 41

## Parent

`../PRD.md`

## What to build

Extend the Codex configuration panel with browser-informed operating-system selection and a complete Windows PowerShell path. Generate a PowerShell command from the same Selected API Credential, Base URL, language, and public installer origin while maintaining the hosted PowerShell installer's dry-run and recovery behavior.

## Acceptance criteria

- [x] The panel distinguishes Windows from macOS/Linux with a compact control and a browser-informed initial choice.
- [x] Readers can override the detected platform, and only the non-secret platform preference is remembered.
- [x] Windows output contains a complete copyable PowerShell command using the selected key, read-only Base URL, language, and configured installer origin.
- [x] Anonymous Windows output remains fully copyable with a Configuration Placeholder.
- [x] The hosted PowerShell installer continues to handle defaults, winget detection and recovery, Codex fallback installation, configuration backup, and Codex login.
- [x] PowerShell quoting, syntax, validation, and dry-run tests verify the generated contract without installing Codex or writing personal configuration.
- [x] Browser tests cover platform detection, manual switching, preference restoration, copy feedback, and absence of persisted raw commands.

## Blocked by

- `05-shell-codex-configuration.md`

## Comments

### 2026-07-16 implementation

- Implementation commit: `fd431d5` (`Generate Windows Codex configuration`). Task 05 was confirmed fully accepted and committed before implementation began.
- The primary Codex Setup Script control now distinguishes Windows from macOS/Linux. It uses `navigator.userAgentData.platform` with `navigator.platform` as a fallback, while a valid remembered `eggdoc:codex-platform` preference takes precedence. Automatic detection is not persisted; only an explicit Reader choice stores `windows` or `unix`.
- Windows selection generates the complete PowerShell command from the current Selected API Credential or public Configuration Placeholder, read-only Base URL, selected language, and centralized installer origin. PowerShell single-quoted literals double apostrophes so `$`, backticks, semicolons, URLs, and other command-sensitive characters remain data.
- Authenticated command previews continue to use a redacted key marker. The raw key-bearing command is constructed only inside the explicit copy action. Browser assertions confirmed local storage contains platform, language, and token-identifier preferences only, with no raw API token or generated Shell/PowerShell command.
- The pre-existing `public/install/codex.ps1` was not changed. Windows PowerShell 5.1 AST parsing validated both the hosted script and a generated edge-case command. Isolated `-DryRun` tests covered environment-variable input, defaults, validation failures, key redaction, winget detection and repair planning, official installer fallback planning, configuration backup planning, and Codex login planning.
- Every PowerShell dry run used a unique nonexistent temporary `CODEX_HOME` and asserted that the path remained nonexistent. No real winget repair, Codex installation/update, configuration write, login, production EggAi/Logto request, or personal Codex configuration access occurred.
- Browser behavior coverage includes Windows and Linux detection, anonymous placeholder copying, authenticated dynamic values, language propagation, manual switching, copy-feedback reset, preference restoration, and absence of secret-bearing persistence. Playwright Chrome screenshots at 1280px and 390px confirmed the segmented control and long command remain inside the panel with readable contrast and internal horizontal scrolling.
- Verification: `npm test` passed 52 tests; `npm run check` reported 0 errors, warnings, or hints; `npm run build` completed successfully; production `dist` contained none of the authenticated, Base URL, or dry-run fixture values; `git diff --check` passed.
- `/code-review` against `3de545dc` reported 0 Spec findings and 0 hard Standards violations. Two low-priority judgement notes about local two-platform branching and repeated E2E helpers were left local because the direct branches and isolated test setup remain clearer at the current scope.
- Task 07 was not started.
