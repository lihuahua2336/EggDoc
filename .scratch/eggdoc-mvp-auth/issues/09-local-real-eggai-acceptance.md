# Validate the real EggAi integration on localhost

Status: ready-for-human
Execution: completed
Closed: 2026-07-17

User stories: 69

## Parent

`../PRD.md`

## What to build

Perform the manual acceptance pass that automated fixtures cannot prove. Configure the dedicated EggDoc Logto application for a localhost callback, use a dedicated non-production EggAi test account, and verify the complete public-to-personalized tutorial path without deploying to Cloudflare or exposing credentials in project artifacts.

## Acceptance criteria

- [x] Local environment documentation lists every required public and secret setting without containing real values.
- [x] A test Reader can start from the public Codex tutorial, authenticate through real Logto, and return to the configuration anchor.
- [x] An inactive EggAi API Account can follow the new-tab activation flow and return to a newly available EggAi API Credential.
- [x] An active EggAi API Account can retrieve a key, switch EggAi API Credentials when multiple exist, and copy Shell and PowerShell configuration.
- [x] Session refresh and EggDoc-only logout behave correctly against the real services.
- [x] Public content remains available before, during, and after integration failures.
- [x] The acceptance record contains outcomes and sanitized diagnostics only; no API key, client secret, resource token, or refresh token is committed.

## Blocked by

- `06-windows-codex-configuration.md`
- `07-mobile-navigation-with-identity.md`
- `08-article-interactions-and-video-links.md`

## Comments

### 2026-07-17 localhost acceptance completed

- Preconditions: tasks 06, 07, and 08 were fully accepted and committed before the real-service pass began.
- Automated baseline: `npm test` passed 69 tests, `npm run check` reported 0 diagnostics, and `npm run build` produced 27 public routes with 6 Pagefind-indexed article pages. After the real-contract fixes, the focused authentication and credential suites passed 19/19 and the full suite again passed all 69 tests.
- Test isolation: a committed `.env.test` now overrides ignored `.env.local` values for `astro build --mode test`; the authorization seam was verified to use the mock issuer on port 4323. Automated tests do not contact real Logto or EggAi services.
- Real OIDC: the dedicated EggDoc application accepted `http://127.0.0.1:4322/auth/callback`. The confirmed issuer, API resource, and scopes were configured locally without committing their deployment-specific credentials. Login returned to the Codex tutorial configuration anchor and established the EggDoc identity state.
- Refresh and logout: the first authorization required explicit consent to issue a refresh token. A forced localhost-only acceptance pass exercised the real refresh grant without reading or logging token values; the temporary hook was removed immediately afterward. EggDoc-only logout removed identity and the raw EggAi API Credential from the page, restored the anonymous placeholder, and a subsequent login reused the existing Logto SSO session without credential entry.
- Real ecosystem contract: the API resource is `https://api.eggai.icu/api`; required scopes are `ecosystem:me`, `ecosystem:models:read`, and `ecosystem:tokens:read`. Credential entries use `token_id`, `api_key`, `token_name`, `group`, and `base_url`. The adapter and fixtures now accept only this current contract.
- Inactive account: a separate EggAi identity with no EggAi API Credential returned an account object and model list but an empty current-contract EggAi API Credential list. EggDoc now maps that exact response to inactive, displayed the activation action, and opened the API platform in a new tab. After the platform's EggAi sign-in created the EggAi API Account and one temporary EggAi API Credential, returning to EggDoc showed the active state and the newly available EggAi API Credential without recording its value.
- Active account: the test account returned 31 model names. After a second temporary EggAi API Credential was created, EggDoc displayed exactly two EggAi API Credential options. Selecting the new EggAi API Credential changed the displayed key; API Key and PowerShell command copies matched the Selected API Credential; switching back restored the original key. Base URL, non-secret `config.toml`, Shell command, and PowerShell command copy behavior all passed without recording any copied value.
- Failure containment: an invalid resource target and an incompatible EggAi API Credential shape both degraded only the configuration panel. The public tutorial, anonymous examples, navigation, and article content remained readable throughout.
- Review: the two-axis Task 09 review found that the automated authorization fixture still used an obsolete resource and scope contract, plus domain-term and progress-record drift. The fixture resource, granular scopes, discovery metadata, assertions, terminology, and execution summary were corrected. Standards and Spec re-review found no remaining actionable issues.
- Final verification: `npm test` passed the complete HTTP, browser, installer, unit, and production-preview suites; `npm run check` reported 0 diagnostics; the production build generated 27 public routes and Pagefind indexed 6 article pages.
- Security audit: the implementation staged exactly 9 Task 09 files. Exact scans found no test-account identifier, password, exposed Client Secret, JWT-like token, or unknown real `sk-` value in staged content or the client build. `.env.local` remained ignored and unstaged. The implementation commit is `3dcd927`.
- Credential lifecycle: all temporary test credentials and the Client Secret used during acceptance are scheduled for reset after this localhost pass; none is stored in the repository.
