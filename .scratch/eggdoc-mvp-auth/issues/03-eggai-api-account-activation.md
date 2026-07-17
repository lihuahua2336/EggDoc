# Add the EggAi API Account activation flow

Status: ready-for-agent
Execution: completed
Closed: 2026-07-17

User stories: 22-25, 49-51

## Parent

`../PRD.md`

## What to build

Extend the authenticated tutorial panel through the EggAi adapter to distinguish an active EggAi API Account from an EggAi identity that has not activated the API platform. Provide a new-tab activation action, automatic refresh when the Reader returns, a manual recheck, and resilient panel-local errors that never interrupt the tutorial.

## Acceptance criteria

- [x] The adapter uses the confirmed ecosystem account contract without leaking New API response shapes into tutorial UI.
- [x] An authenticated Reader without an EggAi API Account sees a clear activation action rather than a generic login error.
- [x] Activation opens the configured EggAi API platform in a new tab and preserves the tutorial state.
- [x] Returning focus triggers a bounded automatic recheck, and a manual recheck remains available.
- [x] Temporary upstream errors, authorization problems, and missing server configuration produce distinct recoverable panel states without exposing deployment details.
- [x] Tests cover inactive, active, expired-authorization, unavailable, and retry outcomes while asserting that the surrounding article stays usable.

## Blocked by

- `02-eggai-login-and-eggdoc-session.md`

## Comments

### 2026-07-15 implementation

- Implementation commit: `0d7e76fb22c87dd4b846229dad90aafc232c8b56`.
- Focused tests: `npx playwright test tests/e2e/eggai-account-activation.spec.ts` passed 7 browser/HTTP scenarios covering active, inactive, expired authorization, temporary outage, unavailable configuration, manual retry, and one bounded focus-return recheck.
- Full verification: `npm test` passed all 23 HTTP, browser, production-output, and Session tests. `npm run check` completed with 0 errors, warnings, or hints. `npm run build` prerendered all 27 public routes, generated the sitemap, and Pagefind indexed the same 6 public article pages.
- Review: `/code-review` Standards found no hard violations and suggested separating the expanded component, sharing and validating the response state contract, and renaming the combined service fixture. Spec found that the unavailable test initially bypassed the simulated ecosystem boundary. All findings were resolved; follow-up review found no remaining Spec gap or new hard Standards issue.
- Security: ecosystem errors are converted to local states without returning upstream messages. All tokens, identities, account fields, URLs, and failure details used by automated tests are explicit non-production fixtures; no real credential or account data was read, logged, stored, or committed.
