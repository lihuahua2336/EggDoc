# Add mobile navigation with EggAi identity state

Status: ready-for-agent
Execution: completed

User stories: 55-57

## Parent

`../PRD.md`

## What to build

Replace the missing small-screen primary navigation with a mobile drawer that preserves the current desktop header and integrates the anonymous or authenticated identity actions delivered by the login slice. The drawer must provide predictable navigation without obscuring content after a selection.

## Acceptance criteria

- [x] Small screens expose a menu icon while retaining the EggDoc identity, search, and theme controls without overlap.
- [x] The drawer contains Home, EggAi Guide, AI Programming, and Tools and Concepts links.
- [x] Anonymous state provides the EggAi login action, and authenticated state provides identity, API-platform, and EggDoc logout actions.
- [x] Navigating or pressing Escape closes the drawer and restores focus predictably.
- [x] Desktop navigation remains unchanged in behavior and does not render a redundant drawer control.
- [x] Responsive browser tests cover common mobile and desktop widths, keyboard operation, focus, text fit, and both identity states.

## Blocked by

- `02-eggai-login-and-eggdoc-session.md`

## Comments

### 2026-07-17 implementation

- Implementation commit: `624eb58644501d8b44575faa3b7e72570e4272d1`.
- Tests: `npm test` passed all 59 HTTP, browser, installer, output, and unit tests. The focused mobile-navigation suite passed 7 scenarios and a repeated stability run passed 14/14, covering anonymous and authenticated mobile drawers, keyboard opening, Tab order, Escape, focus restoration, navigation closure, EggAi identity actions, logout, 320/390px mobile fit, and 1024/1280px desktop fit.
- Checks: `npm run check` completed with 0 errors, warnings, or hints. `npm run build` completed successfully, prerendered all 27 public routes, generated the sitemap, and indexed 6 public article pages with Pagefind.
- Review: `/code-review` initially found duplicated primary-navigation data, inconsistent focus restoration on primary-link selection, and incomplete authenticated/narrow-desktop geometry coverage. The navigation data now has one owner, all close paths use the same focus behavior, and the responsive scenarios cover both identity states. Final Standards review reported 0 hard violations and 0 judgement findings; final Spec review reported no remaining deviations or scope creep.
- Security: automated identity states use only the existing simulated EggAi and Logto fixtures. No production credentials or real account data were read, logged, or stored.
