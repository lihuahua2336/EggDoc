# Establish the portable runtime and anonymous Codex configuration

Status: ready-for-agent

User stories: 1-6, 45-47, 62, 65-66

## Parent

`../PRD.md`

## What to build

Introduce the smallest portable Astro server runtime while preserving prerendered public content and existing search, theme, sitemap, and article behavior. Turn the Codex Integration Tutorial into the first host for a client configuration panel that remains fully usable anonymously: it shows a Configuration Placeholder, the public Base URL, the default language, and copyable public Shell and PowerShell examples. Establish the running-application browser test seam and verify that public output never contains personalized data.

## Acceptance criteria

- [x] Every published guide, lesson, note, tag, and search page remains anonymously accessible and prerendered where appropriate.
- [x] The Codex tutorial contains an anonymous configuration panel with an unmistakable fake key and copyable public examples.
- [x] The application can expose dynamic server routes without moving public content into personalized rendering.
- [x] A production-like build still generates Pagefind and the sitemap, and existing theme behavior remains functional.
- [x] Browser tests cover anonymous access, placeholder rendering, public copying, and regression of search and theme behavior.
- [x] Built HTML and the Pagefind index contain only public placeholders and never fixture credentials.

## Blocked by

None - can start immediately.

## Comments

### 2026-07-14 implementation

- Implementation commit: `b561ace5ab2c3f8fc69abd68fb5b70e417831ff5`.
- Tests: `npm test` passed 5 Playwright HTTP/browser/output tests. The production build prerendered all 27 expected public routes, indexed 6 public article pages with Pagefind, generated the sitemap, verified anonymous HTTP access for every published route, and scanned all build output for the personalized fixture credential.
- Checks: `npm run check` completed with 0 errors, warnings, or hints. `npm run build` completed successfully and regenerated Pagefind and the sitemap.
- Review: `/code-review` Standards and Spec reviews found no remaining actionable issues after extracting shared copy behavior, removing the duplicate health assertion, and deriving complete published-route coverage from content frontmatter.
- Visual verification: the anonymous panel was checked at 1440 x 900 and 390 x 844; controls remained within the panel and long commands scrolled inside their code areas.
