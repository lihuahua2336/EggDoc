# Add EggAi login and the EggDoc Session

Status: ready-for-agent
Execution: completed
Closed: 2026-07-17

User stories: 7-13, 48, 50, 52-54, 63, 67

## Parent

`../PRD.md`

## What to build

Add optional EggAi authentication through the dedicated Logto application using a mature cross-runtime OIDC library. Establish the encrypted, database-free EggDoc Session, current-user state, safe source-page return, header and tutorial login actions, reauthorization, and EggDoc-only logout. Public content must remain available through every authentication state and failure.

## Acceptance criteria

- [x] Header and tutorial actions initiate Authorization Code with PKCE using the configured audience and scopes.
- [x] Login success returns to a validated same-origin source path and optional configuration anchor.
- [x] Cancellation and login failure return to public content with a local, non-sensitive error.
- [x] The encrypted HttpOnly Session uses production-safe cookie attributes, enforces its maximum lifetime, and refreshes authorization when required.
- [x] The header exposes authenticated identity state without adding an EggDoc account center.
- [x] Logout clears only EggDoc state and does not end the shared EggAi/Logto session.
- [x] Automated HTTP and browser tests simulate OIDC behavior without contacting production services or storing real credentials.

## Blocked by

- `01-portable-runtime-and-anonymous-config.md`

## Comments

### 2026-07-14 implementation

- Implementation commit: `8ef32750adcc625e67633d31c856a9d6cb84f3c3`.
- Tests: `npm test` passed 16 HTTP, browser, output, and focused Session tests. The simulated Logto fixture verified discovery, Authorization Code + PKCE, state, nonce, ID Token validation, token refresh, cancellation, generic failures, safe source return, reauthorization, encrypted Cookie behavior, and EggDoc-only logout without contacting production services.
- Checks: `npm run check` completed with 0 errors, warnings, or hints. `npm run build` completed successfully, prerendered all 27 public routes, generated the sitemap, and indexed 6 public article pages with Pagefind.
- Review: `/code-review` Standards found one domain-language mismatch, one duplicated redirect helper, and one test-hook type-safety concern; Spec found missing direct evidence for the seven-day server expiry boundary and HTTPS `Secure` cookies. All findings were resolved, and the full verification suite passed afterward.
- Security: all committed OIDC values, tokens, identities, and Session secrets are explicit test fixtures. No production credential or real account data was read, logged, or stored.
