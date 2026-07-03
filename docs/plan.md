# EggDoc Project Plan

EggDoc is a Chinese-first, consumer-facing documentation and learning site for AI product usage, EggAi integration guides, AI programming concepts, tool introductions, and the process of building EggDoc itself.

## Product Shape

EggDoc should feel like a content-friendly documentation site rather than a generic blog or enterprise docs portal. The homepage acts as a focused portal into the main content tracks, especially EggAi integration guides and the AI programming learning path.

The site is maintained by the owner through Markdown and MDX files in Git. It does not support public editing, user submissions, comments, accounts, or database-backed content in the initial version.

## Content Types

EggDoc uses three primary content types:

**Guide**

Task-oriented documentation for setup, configuration, integration, and troubleshooting. Guides are non-linear: readers usually arrive with a concrete problem.

Examples:

- Configure EggAi in Cursor
- Configure EggAi in Cherry Studio
- Use EggAi with an OpenAI-compatible SDK
- Troubleshoot common API key or base URL errors

**Lesson**

An ordered article inside a learning path. A lesson may include embedded video, but the text remains the canonical content.

Examples:

- Install and configure Codex
- Understand AI programming workflows
- Build the EggDoc site with Astro and shadcn/ui
- Add Markdown/MDX content rendering and search

**Note**

Flexible content for tool introductions, concept briefs, timely explanations, and useful references that do not belong to a guide collection or learning path.

Examples:

- What is MCP?
- What is an AI agent?
- Claude Code vs Codex
- New AI tool overview

## Initial Information Architecture

Primary navigation should be manually curated:

- Home
- EggAi Guide
- AI Programming
- Tools & Concepts
- Search

Suggested URL structure:

```txt
/
/eggai/
/eggai/cursor/
/eggai/cherry-studio/
/learn/
/learn/codex-install/
/learn/ai-programming-concepts/
/learn/build-eggdoc/
/notes/
/notes/what-is-mcp/
/tags/api/
/tags/cursor/
```

URLs use short English slugs. Page titles and content are Chinese.

## Content Organization

Recommended content directory:

```txt
src/content/
  guides/
    eggai/
      cursor.md
      cherry-studio.md
      openai-sdk.md
      troubleshooting.md
  lessons/
    ai-programming/
      01-codex-install.md
      02-ai-programming-concepts.md
      03-build-eggdoc.mdx
  notes/
    what-is-mcp.md
    what-is-agent.md
```

Markdown is the default authoring format. MDX is allowed only when a page needs richer presentation such as interactive examples, reusable callouts, tabs, embeds, or comparison components.

## Frontmatter Model

All content should be validated with TypeScript schemas.

Shared fields:

```yaml
title: 在 Cursor 中配置 EggAi
description: 使用 EggAi 中转 API 连接 Cursor 的配置步骤
publishedAt: 2026-07-03
updatedAt: 2026-07-03
tags: [eggai, cursor, api]
draft: false
featured: false
```

Guide fields:

```yaml
type: guide
service: eggai
app: cursor
order: 20
```

Lesson fields:

```yaml
type: lesson
path: ai-programming
order: 10
videoUrl: https://example.com/video
```

Note fields:

```yaml
type: note
topic: ai-programming
```

`draft` controls publication. `featured` controls editorial promotion. These two concepts must stay separate.

## Technical Architecture

EggDoc should be implemented as a static Astro site:

```txt
Astro
+ Astro Content Collections
+ Markdown and MDX
+ TypeScript
+ Tailwind CSS
+ shadcn/ui for Astro
+ Pagefind
+ Cloudflare Pages
```

Cloudflare Pages is the first deployment target. The generated static output should remain portable enough to serve from a VPS later with Caddy or Nginx.

The initial site should avoid:

- SSR
- User accounts
- Public submissions
- Comments
- Server Actions or equivalent app-server features
- Database-backed content
- Platform-specific image optimization
- Versioned documentation trees

## Rendering And Navigation

The article experience should include:

- Chinese title and description
- Published and updated dates
- Tags
- Reading layout with comfortable width
- Table of contents for longer articles
- Previous and next links for lessons
- Related content based on tags, service, app, or learning path
- Callouts, tabs, and code blocks where useful
- Embedded video for lessons when available

Main navigation is manual. Content navigation is generated from metadata:

- EggAi guide list
- Learning path lesson order
- Article table of contents
- Previous and next lesson links
- Tag pages
- Related content

## Search

Search is part of the MVP. Use Pagefind to build a static search index after Astro generates the site.

Search should cover:

- Guides
- Lessons
- Notes
- Titles
- Descriptions
- Article body text
- Tags

The UI can start as a search button in the header that opens a search dialog or links to a dedicated search page.

## Visual Direction

The interface should combine technical documentation clarity with a more approachable content-site feel.

Design principles:

- Prioritize readability over decoration
- Keep article pages calm and structured
- Make the homepage a clear portal into EggAi and AI programming
- Use shadcn/ui components where they improve interaction
- Avoid turning every section into a card
- Support light, dark, and system theme modes
- Keep code blocks, step lists, screenshots, and callouts polished

Recommended shadcn/ui components:

- Button
- Badge
- Card for repeated content items only
- Tabs
- Accordion
- Command or search dialog
- Breadcrumb
- Separator
- ScrollArea

## MVP Scope

The first usable version should include:

- Astro project setup
- Tailwind and shadcn/ui setup
- Content collections for guides, lessons, and notes
- Markdown and MDX rendering
- Homepage portal
- EggAi guide hub
- AI programming learning path hub
- Notes index
- Article layout
- Tag pages
- Pagefind search
- Theme switcher
- Sitemap and basic SEO metadata
- Cloudflare Pages deployment configuration

## First Content Seeds

Suggested first content:

- EggAi: What is EggAi?
- EggAi: Configure EggAi in Cursor
- EggAi: Configure EggAi in Cherry Studio
- EggAi: Common configuration errors
- AI Programming: Install and configure Codex
- AI Programming: What is AI programming?
- AI Programming: Build EggDoc with Astro and shadcn/ui
- Note: What is MCP?
- Note: What is an AI agent?

## Later

Consider later only when there is a clear need:

- English content and i18n routes
- VPS deployment automation
- RSS feed
- Newsletter
- Analytics
- Comments
- User accounts
- Full-text search service
- Versioned EggAi docs
- CMS or web editor

## Explicit Non-Goals For MVP

- No public user editing
- No CMS
- No login
- No comments
- No database
- No SSR requirement
- No complete i18n system
- No versioned docs
- No product-only taxonomy
