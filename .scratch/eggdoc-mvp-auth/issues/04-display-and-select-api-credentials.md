# Display and select EggAi API Credentials

Status: ready-for-agent

User stories: 14-21, 44-47, 64

## Parent

`../PRD.md`

## What to build

Complete the active EggAi API Account path by adapting the ecosystem model and token responses into EggDoc domain data. Show the Selected API Credential in plaintext with its read-only Base URL and model summary, support multiple credentials, and remember only a token identifier. Keep raw credentials confined to current page memory and private non-cacheable responses.

## Acceptance criteria

- [x] An active account receives adapted credential and model data through an authenticated, private, no-store endpoint.
- [x] The panel displays the selected raw key, Base URL, token name, group, and an available-model summary.
- [x] Multiple credentials can be selected, with a remembered token identifier restored when still valid.
- [x] Missing remembered tokens fall back to the first usable credential.
- [x] Raw keys, Base URLs returned by the account, and generated secret-bearing values are never written to persistent browser storage or server logs.
- [x] Session expiry immediately removes personalized data and restores the anonymous panel.
- [x] Tests cover one credential, multiple credentials, stale selection, malformed upstream data, no-store headers, and absence of credentials from static output.

## Blocked by

- `03-eggai-api-account-activation.md`

## Comments

### 2026-07-15 implementation

- Implementation commit: `7e0c68907ec6c3652ba8290dca2d06f41b0f1dff`.
- Focused tests: the task 03 activation suite and task 04 credential suite passed all 18 HTTP/browser scenarios, including single and multiple credentials, remembered and stale identifiers, Session expiry, an in-flight response after Session clearing, and malformed model/token entries and envelopes.
- Full verification: `npm test` passed all 33 HTTP, browser, production-output, and Session tests. `npm run check` completed with 0 errors, warnings, or hints. `npm run build` prerendered all 27 public routes, generated the sitemap, and Pagefind indexed the same 6 public article pages.
- Review: `/code-review` Standards initially found one low-priority duplicated request-classification shape. Spec found a Session-clear race and incomplete upstream envelope validation. The implementation now invalidates in-flight requests, requires explicit successful ecosystem envelopes, and centralizes request classification; follow-up Standards and Spec reviews reported no remaining or new findings.
- Sensitive-data isolation: credential and model responses are adapted behind the EggDoc boundary and returned only from the authenticated `private, no-store` endpoint. The client fetch also uses `no-store`; raw keys and account-provided Base URLs stay in the current React state and are removed when the Session clears. Browser persistence stores only the selected token identifier and clears it on EggDoc exit. Server and client code do not log credential payloads.
- Redaction verification: production `dist`, static HTML, and Pagefind output were scanned for all recognizable non-production personalized fixture values and none were present. Automated tests used only explicit non-production fixtures; no real API key, Client Secret, resource token, refresh token, account identifier, or account Base URL was read, printed, logged, stored, or committed.
