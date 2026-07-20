# EggDoc

EggDoc is a consumer-facing documentation site for practical AI product tutorials and approachable explanations of AI programming concepts.

## Language

**Reader**:
A non-enterprise consumer who wants help understanding or using AI products and AI-assisted programming workflows. A Reader may browse anonymously or sign in with an EggAi Account without changing access to published content.
_Avoid_: Developer, customer, enterprise user

**EggAi Account**:
An identity registered and authenticated by EggAi through Logto. EggDoc relies on this identity and does not create or manage a separate account or password.
_Avoid_: EggDoc account, local account, site account

**EggAi API Account**:
An account activated on the EggAi API platform for an EggAi Account. Activation always creates at least one EggAi API Credential, and the account is distinct from merely having an authenticated EggAi identity.
_Avoid_: New API registration, API login, EggDoc account

**EggDoc Session**:
An authenticated EggDoc browser session established from an EggAi Account. It unlocks personalized configuration retrieval but never controls access to published content.
_Avoid_: Content subscription, member access, EggDoc account

**EggAi API Credential**:
A Reader's API token and Base URL retrieved on demand from the EggAi API platform after authentication. EggDoc may present it for copying but does not own or persist it.
_Avoid_: EggDoc key, site credential, public API key

**Selected API Credential**:
The EggAi API Credential currently chosen by a Reader for generating copyable integration configuration. EggDoc may remember its token identifier in the browser but never the raw API token.
_Avoid_: Default key, saved key, EggDoc key

**Integration Configuration**:
A copyable, application-specific configuration generated from the Selected API Credential. Each supported application has a verified template tied to its Integration Tutorial.
_Avoid_: Generic setup text, unverified template, stored configuration

**Configuration Placeholder**:
A visibly non-secret example value shown inside public tutorial configuration when no EggDoc Session is available. It teaches the configuration shape but must never appear to be a usable credential.
_Avoid_: Demo credential, fallback key, public API key

**Tutorial**:
A practical article that helps the reader complete a concrete task with an AI product or AI programming workflow.
_Avoid_: Blog post, note

**Integration Tutorial**:
A practical article that shows readers how to configure a service, API distribution site, or AI tool inside another application or workflow.
_Avoid_: Website tutorial, setup note

**Codex Setup Script**:
A reader-facing installer script that turns Codex + EggAi setup into a parameterized install/update flow.
_Avoid_: Shell snippet, manual Codex tutorial

**Claude Code Setup Script**:
A reader-facing installer that detects or installs a compatible Node.js runtime and installs Anthropic's official Claude Code npm package. Its default mode leaves authentication and configuration unchanged; its explicit EggAi mode validates the gateway, then backs up and merges the Selected API Credential and role-specific model mappings into user-level Claude Code settings so no second Claude login is required.
_Avoid_: Claude login script, shared-key installer

**EggAi Provider**:
The Codex model-provider configuration that points Codex at EggAi's OpenAI-compatible API endpoint.
_Avoid_: OpenAI account, generic proxy

**Maintainer**:
The person who collects, writes, edits, and publishes EggDoc content through the project repository.
_Avoid_: User, contributor, editor role

**Content Source**:
Markdown files stored in Git and maintained by the site owner as the canonical source of published content.
_Avoid_: CMS entry, user submission, database content

**Article Slug**:
A short English URL segment that identifies an article while the visible title remains Chinese.
_Avoid_: Chinese URL, full title slug

**Concept Guide**:
An explanatory article that helps the reader understand an AI programming idea before or while applying it.
_Avoid_: Architecture article, essay

**Tool Introduction**:
An article that explains what a tool is, what problem it is useful for, and when a reader might choose it.
_Avoid_: Product documentation, review

**Concept Brief**:
A timely explanatory article about a new or emerging AI concept, written for reader orientation rather than exhaustive reference.
_Avoid_: News post, announcement

**Learning Path**:
A sequenced set of articles or videos that guides readers through a topic from setup through concepts and a complete practical build.
_Avoid_: Category, tag, playlist

**Guide Collection**:
A task-oriented set of articles that readers can enter non-linearly to solve a specific setup, configuration, or troubleshooting problem.
_Avoid_: Course, learning path

**Lesson**:
An article inside a learning path that may include an embedded video, but remains readable and searchable as text.
_Avoid_: Video, episode

**Note**:
A flexible article for tool introductions, concept briefs, timely observations, or useful references that do not belong to a guide collection or learning path.
_Avoid_: Blog post, miscellaneous article

**Project Architecture**:
The implementation structure of the documentation website itself, including routing, content storage, rendering, navigation, and deployment choices.
_Avoid_: Architecture design article

**Content Experience**:
A site shape that combines consumer-friendly content discovery with documentation-style article reading and navigation.
_Avoid_: Pure docs site, blog
