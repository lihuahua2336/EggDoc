# EggDoc MVP Experience and EggAi Configuration

Status: completed
Execution: completed
Closed: 2026-07-17

## Problem Statement

EggDoc already publishes a usable Chinese-first documentation and learning site, but its MVP experience is incomplete on mobile, in article interactions, and around lesson media. More importantly, EggAi integration tutorials require every Reader to manually replace configuration placeholders even when the Reader already has an EggAi Account and an EggAi API Credential.

Readers need a public tutorial experience that remains complete without registration while giving authenticated Readers a faster, trustworthy way to retrieve their own EggAi API Credential and generate copyable Codex configuration. EggDoc must add this capability without becoming a separate account system, persisting API keys, placing secrets in static output, or tying the application permanently to Cloudflare when a future VPS deployment is expected.

## Solution

Keep all published content public and prerendered. Add an optional EggAi login enhancement backed by a dedicated Logto application, an encrypted EggDoc Session, and a small portable Astro server runtime. After page load, an authenticated configuration panel retrieves the Reader's EggAi API Account status, available models, and API credentials through an EggDoc-owned adapter over the established EggAi ecosystem contract.

Anonymous Readers continue to see and copy complete tutorial examples containing an unmistakable Configuration Placeholder. Authenticated Readers with an active EggAi API Account see their Selected API Credential directly and can generate complete Shell or PowerShell Codex installation commands, including the raw API key when they explicitly copy the command. Readers who have not activated an EggAi API Account are guided to activate it in a new tab and can refresh the tutorial on return.

Complete the remaining MVP experience with a mobile navigation drawer, code-copy controls, Note/Tip/Warning callouts, lesson video links, resilient loading and error states, and behavior-focused automated tests. Maintain the existing hosted Shell and PowerShell installers and preserve a portable path from Cloudflare to a future Node-based VPS deployment.

## User Stories

1. As an anonymous Reader, I want to open every published guide, lesson, note, tag page, and search page, so that registration never blocks learning.
2. As an anonymous Reader, I want EggAi configuration examples to contain an obvious Configuration Placeholder, so that I never mistake an example for a working credential.
3. As an anonymous Reader, I want to copy a complete Shell installation example containing a placeholder, so that I can manually insert an API key obtained elsewhere.
4. As an anonymous Reader, I want to copy a complete PowerShell installation example containing a placeholder, so that I can follow the Windows tutorial without signing in.
5. As an anonymous Reader, I want to copy the public EggAi Base URL separately, so that I can configure a tool manually.
6. As an anonymous Reader, I want an inline explanation that EggAi login can fill my configuration automatically, so that I understand the optional benefit.
7. As an anonymous Reader, I want a login action beside the tutorial configuration, so that I can authenticate without leaving the task context first.
8. As an anonymous Reader, I want a login action in the global navigation, so that I can authenticate from anywhere on the site.
9. As a Reader starting login from a tutorial, I want to return to the same tutorial and configuration anchor, so that I can resume the task immediately.
10. As a Reader, I want login and registration to be handled by EggAi, so that I do not have to create a second EggDoc password.
11. As a Reader with an existing EggAi session, I want Logto single sign-on to complete quickly, so that moving between EggAi applications is low friction.
12. As an authenticated Reader, I want the header to show my EggAi identity, so that I can tell which account is active.
13. As an authenticated Reader, I want EggDoc to check my EggAi API Account only when a configuration panel needs it, so that public page HTML stays generic and cacheable.
14. As an authenticated Reader with an active EggAi API Account, I want the tutorial to display my API key directly, so that I can use it without visiting another dashboard.
15. As an authenticated Reader, I want the configuration panel to display my Base URL, so that I can verify the target endpoint.
16. As an authenticated Reader, I want the configuration panel to summarize available models, so that I can see that the EggAi API connection is working.
17. As an authenticated Reader, I do not want the MVP to choose a model for Codex, so that configuration follows current provider defaults.
18. As an authenticated Reader with multiple API credentials, I want to choose a credential by token name and group, so that I use the intended token.
19. As a returning Reader, I want EggDoc to remember the identifier of my last Selected API Credential, so that I do not repeatedly choose it.
20. As a returning Reader, I do not want EggDoc to persist the raw API token, so that the convenience setting does not become secret storage.
21. As an authenticated Reader whose remembered token no longer exists, I want the panel to select the first available credential, so that configuration remains usable.
22. As an authenticated Reader without an activated EggAi API Account, I want a clear activation action, so that I know why no credential is shown.
23. As a Reader activating an EggAi API Account, I want the API platform to open in a new tab, so that my tutorial and reading position remain open.
24. As a Reader returning after activation, I want EggDoc to automatically check again, so that the newly created credential appears without another login.
25. As a Reader whose browser does not trigger the automatic check, I want a manual recheck action, so that I can continue reliably.
26. As an authenticated Reader, I want to copy my API key explicitly, so that I can use it in another application.
27. As an authenticated Reader, I want to copy my Base URL explicitly, so that I can use it independently from the generated command.
28. As a Codex Reader, I want to switch between Windows and macOS/Linux instructions, so that I receive the correct command syntax.
29. As a first-time Reader, I want the operating-system choice to default from my browser platform, so that the likely command is shown first.
30. As a Reader, I want to override the detected operating system, so that browser detection never traps me in the wrong instructions.
31. As a Reader, I want EggDoc to remember only my operating-system preference, so that convenience does not persist a generated secret-bearing command.
32. As a Chinese-speaking Reader, I want generated Codex commands to default to `zh-cn`, so that Codex uses simplified Chinese by default.
33. As an English-speaking Reader, I want to select English, so that the installer configures English instructions.
34. As a Reader, I want the language selection remembered without storing my API key, so that future visits remain convenient and safe.
35. As a Codex Reader, I want a generated Shell command containing my Selected API Credential, Base URL, and language, so that I can install with one explicit copy action.
36. As a Windows Reader, I want a generated PowerShell command containing my Selected API Credential, Base URL, and language, so that I can install with one explicit copy action.
37. As a security-conscious Reader, I want a warning before copying a command containing my raw API key, so that I understand clipboard and shell-history exposure.
38. As a Reader, I want a separate non-secret `config.toml` copy action, so that I can inspect or apply provider settings independently.
39. As a Reader, I want the Base URL to follow the Selected API Credential and remain read-only, so that generated configuration matches EggAi's trusted configuration.
40. As a Reader, I want the hosted Shell installer to remain available at the configured public site origin, so that tutorial commands continue to work.
41. As a Windows Reader, I want the hosted PowerShell installer to remain available at the configured public site origin, so that Windows setup stays supported.
42. As a future self-hosting maintainer, I want the public installer origin to be configurable, so that moving to a VPS does not require rewriting UI components.
43. As a maintainer, I want old installer URLs to remain compatible after a domain migration, so that published tutorials do not silently break.
44. As an authenticated Reader, I want the raw API key to exist only in current page memory, so that it is absent from persistent browser storage.
45. As a Reader viewing page source, I want to see only placeholders, so that personalized credentials never enter public HTML.
46. As a Reader using site search, I want search results to contain only public tutorial text, so that Pagefind never indexes API credentials.
47. As a Reader, I want configuration requests to bypass caches, so that another Reader cannot receive my credential.
48. As a Reader whose EggDoc Session expires, I want the panel to clear personalized data and restore the public placeholder, so that stale credentials do not remain visible.
49. As a Reader affected by a temporary EggAi API outage, I want the article to remain readable and the panel to offer retry, so that an integration failure does not become a content outage.
50. As a Reader whose authorization needs refreshing, I want a reauthorization action, so that I can recover without losing the tutorial context.
51. As a Reader, I want service configuration errors to appear as a generic unavailable state, so that sensitive deployment details are not exposed.
52. As an authenticated Reader, I want a direct link to the EggAi API platform, so that I can manage credentials in the owning system.
53. As an authenticated Reader, I want to exit EggDoc without being signed out of every EggAi application, so that other work remains uninterrupted.
54. As a Reader who exits EggDoc, I want the Session, raw key in memory, remembered token identifier, and user state cleared, so that the browser returns to an anonymous state.
55. As a mobile Reader, I want a menu button that exposes the primary navigation, so that all main sections are reachable on small screens.
56. As a mobile Reader, I want the drawer to close after navigation, so that content is not obscured.
57. As a mobile Reader, I want login or user actions inside the drawer, so that authentication remains accessible on small screens.
58. As a Reader, I want code blocks to have a copy action with success or failure feedback, so that commands are easier to use.
59. As a Reader, I want Note, Tip, and Warning callouts, so that important tutorial guidance has consistent visual meaning.
60. As a lesson Reader, I want an available video URL shown as a clear external link, so that I can open the lesson video without an embedded player.
61. As a lesson Reader, I want lessons without a video URL to avoid empty video UI, so that the reading layout remains clean.
62. As an anonymous Reader, I want search and theme switching to continue working after the server runtime is introduced, so that existing MVP behavior does not regress.
63. As a maintainer, I want authentication code to use a mature cross-runtime OIDC library, so that EggDoc does not own low-level protocol security.
64. As a maintainer, I want EggAi ecosystem responses adapted into EggDoc domain concepts, so that New API field changes are localized.
65. As a maintainer, I want public content prerendered while only authentication and configuration routes are dynamic, so that the site remains content-first.
66. As a maintainer, I want server code based on portable Web APIs, so that a future Node-based VPS deployment does not require a rewrite.
67. As a maintainer, I want encrypted cookie sessions without a database, so that the MVP remains operationally small.
68. As a maintainer, I want automated tests to use simulated Logto and EggAi API responses, so that CI never requires production credentials.
69. As a maintainer, I want a localhost test-account flow against the real services, so that the integration contract is verified before considering the MVP complete.
70. As a maintainer, I want installer tests to use syntax checks and dry runs, so that tests never install Codex or modify personal configuration.

## Implementation Decisions

- EggDoc remains a single-context, Chinese-first content site. Published content is never gated by authentication.
- EggAi owns registration and identity through Logto. EggDoc has a dedicated OIDC application but no local accounts, passwords, profile editing, or account database.
- The application keeps public content prerendered and adds a small Astro server runtime only for authorization, callbacks, Session management, current-user state, and EggAi configuration retrieval.
- The initial runtime target is Cloudflare-compatible, while server modules use standard Web APIs and Web Crypto to preserve a later switch to a Node adapter on a VPS.
- The OIDC Authorization Code flow uses PKCE, state, nonce, discovery, verified ID Tokens, resource audience, refresh tokens, and the confirmed ecosystem scopes. A mature cross-runtime OIDC library owns protocol mechanics.
- EggDoc stores the minimum authentication state in an encrypted HttpOnly cookie with Secure and SameSite=Lax behavior in production, a seven-day maximum lifetime, and no server-side Session database.
- Logging out clears only the EggDoc Session and does not call Logto global logout.
- Authentication returns to a validated same-origin path and optional configuration anchor. Login failures and cancellation return to the originating public page.
- The EggAi adapter calls the confirmed account, model, and token ecosystem endpoints and converts responses into EggAi API Account, EggAi API Credential, and model-summary domain data.
- An activated EggAi API Account always has at least one credential because activation creates one. The UI does not model a separate activated-without-token state.
- The personalized configuration endpoint requires a valid EggDoc Session, refreshes the resource token when needed, never logs response payloads, and returns private non-cacheable responses.
- Personalized credentials are never included in prerendered or server-rendered tutorial HTML. A client panel retrieves them after page load.
- The configuration panel has explicit anonymous, loading, authenticated-and-active, needs-activation, reauthorization, transient-error, and unavailable states. Failures remain local to the panel.
- Anonymous configuration remains complete and copyable with a visibly fake API-key placeholder and real public defaults.
- The authenticated panel displays the Selected API Credential in plaintext, its read-only Base URL, token identity, token group, and an available-model summary.
- Multiple credentials are selectable. The browser may remember the selected token identifier, operating-system choice, and language, but never the raw key, Base URL response, or generated command.
- The first usable credential is selected when no remembered identifier is valid.
- API Account activation opens the configured EggAi API platform in a new tab. Returning focus triggers one refresh, and a manual refresh remains available.
- MVP configuration templates include generic API key/Base URL values, a Codex provider block, a hosted Shell command, and a hosted PowerShell command.
- Generated commands may contain the raw Selected API Credential only after an explicit user copy action and with a visible warning about clipboard and shell-history exposure.
- Operating-system selection distinguishes Windows from macOS/Linux. Language selection supports simplified Chinese and English and defaults to `zh-cn`.
- Base URL follows the selected credential and is not editable in the personalized panel. If the credential omits it, the configured public EggAi Base URL is used.
- Models are retrieved and summarized but do not affect the generated Codex configuration in this MVP.
- The project continues to maintain both hosted installers. Their public origin is centrally configurable, defaults to the current public site origin, and can later move to a VPS domain.
- The existing Codex Integration Tutorial becomes the first MDX host for the reusable personalized configuration panel. New application templates are added only alongside verified Integration Tutorials.
- The global header includes authenticated and anonymous states. Mobile navigation uses a drawer containing the primary links and identity actions. No account center is added.
- Article enhancements include code-block copying and Note, Tip, and Warning callouts. Tabs, accordions, embedded video players, and other complex MDX components are deferred.
- Lesson video metadata renders as an external address only. It does not create an iframe in this MVP.
- Existing Pagefind search, theme modes, content collections, article navigation, related content, tags, sitemap, and basic SEO remain supported.
- Real Cloudflare deployment is not an acceptance requirement. Local real-service integration with a dedicated test account is required; VPS deployment remains future work.

## Testing Decisions

- Tests assert external behavior and domain outcomes rather than component state, private functions, implementation-specific OIDC details, or exact markup structure.
- The primary seam is a running Astro application's HTTP and browser boundary. Playwright drives public navigation and configuration behavior while controlled upstream fixtures simulate Logto and EggAi ecosystem responses.
- Browser scenarios cover anonymous public access, placeholders, direct login initiation, validated return paths, authenticated user state, API Account activation, automatic and manual refresh, multiple credentials, plaintext display, generic and Codex copies, Session expiry, logout cleanup, transient failures, mobile navigation, code copy, callouts, video links, search, and theme regression.
- API scenarios cover missing and invalid Sessions, encrypted Session round trips, resource-token refresh, missing API Account, active API Account, ecosystem errors, response adaptation, no-store headers, and absence of sensitive deployment details.
- The second seam is the hosted installer CLI boundary. Shell and PowerShell scripts receive syntax checks and dry-run invocations for defaults, custom values, validation failures, key redaction, and generated provider configuration.
- Pure unit tests are limited to behavior that is difficult to assert reliably at the two main seams, especially shell/PowerShell quoting, template generation, safe redirect validation, and configuration-state classification.
- Test fixtures use fake credentials with recognizable non-production values. Snapshot output and failure messages must never contain a real credential.
- Automated tests never contact production Logto or EggAi API services and never perform a real Codex installation.
- Manual localhost acceptance uses a dedicated test account and the real EggAi services to verify login, API Account detection, credential retrieval, copy generation, refresh, and EggDoc-only logout.
- The existing type check and static build remain required. A production-like built preview verifies Pagefind generation and that personalized data is absent from output.
- There is no existing test prior art in this repository. The new suite establishes the browser and installer seams for later features.

## Out of Scope

- Gating guides, lessons, notes, search, tags, or other published content behind login.
- EggDoc-owned registration, passwords, password recovery, profiles, roles, subscriptions, or account administration.
- An EggDoc account center, device list, Session list, or cross-device preference synchronization.
- Persisting API keys, generated commands, credentials, or personalized configuration in a database, KV store, localStorage, or other browser storage.
- Global EggAi/Logto logout or account deletion.
- Selecting or recommending a Codex model.
- Custom Base URL editing in the personalized configuration panel.
- Cursor, Cherry Studio, or other new tool configuration templates and tutorials.
- Embedded video players, video-provider integrations, Tabs, Accordion, or complex MDX widgets.
- English site content or general i18n routing.
- Analytics, newsletter, RSS, comments, CMS, public editing, versioned documentation, or full-text search services.
- Real Cloudflare deployment, production secret configuration, production callback setup, or deployment smoke tests.
- VPS deployment implementation, Caddy/Nginx configuration, database introduction, or server-side Session storage.
- Automated tests that use production credentials or perform real third-party mutations.

## Further Notes

- The current project already has public content collections, article layouts, Pagefind, tags, theme switching, Cloudflare-oriented static configuration, and hosted Codex installers. This PRD extends those capabilities rather than replacing the content model.
- The established domain language distinguishes an EggAi Account, an EggAi API Account, an EggDoc Session, an EggAi API Credential, a Selected API Credential, an Integration Configuration, and a Configuration Placeholder.
- Security decisions deliberately allow plaintext API-key display and explicit copying of a complete command containing the key. The UI warning and non-persistence requirements are part of the feature, not optional polish.
- The future VPS requirement is a portability constraint, not a deployment deliverable for this MVP.
