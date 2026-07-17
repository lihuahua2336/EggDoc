# Add article copy controls, callouts, and video links

Status: ready-for-agent
Execution: completed
Closed: 2026-07-17

User stories: 58-61

## Parent

`../PRD.md`

## What to build

Complete the remaining public article MVP interactions independently from authentication. Add reliable code-block copying, reusable Note, Tip, and Warning callouts for MDX content, and a simple external lesson video address when metadata is present. Keep articles without video metadata unchanged and defer embedded players and more complex MDX widgets.

## Acceptance criteria

- [x] Rendered code blocks expose an accessible copy control with success and failure feedback.
- [x] Note, Tip, and Warning callouts have distinct semantic labels, restrained styling, and accessible contrast in light and dark themes.
- [x] MDX content can use the callouts without weakening standard Markdown rendering.
- [x] Lessons with a video URL show a clear external link, while lessons without one show no empty video area.
- [x] External video links use safe new-tab behavior and do not create iframes or autoplay media.
- [x] Browser tests cover copying, feedback, callout semantics, theme appearance, and both lesson video states across mobile and desktop widths.

## Blocked by

None - can start immediately.

## Comments

### 2026-07-17 implementation

- Implementation commit: `1dee7731ee3b2e6d27a44a7e0940b1f666d44e32` (`Add article interactions and video links`).
- Tests: `npm test` passed 69 tests. The 11 focused article-interaction scenarios cover copy success and simulated failure, live feedback, Note/Tip/Warning semantics, light/dark contrast, video-present/video-absent behavior, safe external-link attributes, absence of iframe/autoplay media, and text/control fit at both 320px and 1280px.
- Checks: `npm run check` reported 0 errors, warnings, or hints. The production phase of `npm test` rebuilt 27 public routes, indexed 6 public article pages with Pagefind, and passed both production preview tests. The postbuild guard confirmed that the test-only lesson route and fake video address were absent from production output.
- Browser QA: the in-app browser verified the production guide at 320px and 1280px. All three callouts stayed within the article bounds, copy controls did not overlap code, and the existing Codex configuration panel received no duplicate article-copy control. Light and dark presentation remained readable.
- Review: `/code-review` initially found a Markdown-first violation, repeated MDX component registration, test-fixture policy coupling, an incomplete cross-viewport matrix, and contradictory test/production preview expectations. The fixture now uses Markdown, MDX registration and test-content policy have single owners, all requested states run at both target widths, and test-mode suites are followed by a separate guarded production build. Final Standards and Spec reviews both reported 0 remaining findings.
- Scope: no iframe, autoplay, Tabs, Accordion, or other complex MDX widget was added. Task 09 was not started.
