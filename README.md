# EggDoc

EggDoc is a Chinese-first Astro documentation and learning site for EggAi integration guides, AI programming lessons, and AI tool or concept notes.

## Commands

```bash
npm install
npm run dev
npm run check
npm run build
npm run preview
```

- `npm run dev` starts the local Astro development server.
- `npm run check` validates Astro and TypeScript types.
- `npm run build` validates the project, builds static files into `dist/`, and generates the Pagefind search index.
- `npm run preview` previews the generated static site locally.
- `npm run deploy:cloudflare` builds the site and deploys `dist/` with Wrangler.

## Content

Content lives in `src/content` and is validated by `src/content.config.ts`.

- `src/content/guides` stores task-oriented setup and troubleshooting guides.
- `src/content/lessons` stores ordered learning-path lessons.
- `src/content/notes` stores flexible tool and concept notes.

Markdown is the default format. Use MDX only when an article needs richer presentation.

## Deployment

The site builds to static assets in `dist/`, making it suitable for Cloudflare Pages now and portable VPS static hosting later.

### Cloudflare Pages

Cloudflare Pages is the first deployment target for EggDoc.

Recommended Pages settings:

```txt
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Root directory: /
Node.js version: 22 or newer
```

The repository includes `wrangler.toml` with:

```toml
name = "eggdoc"
compatibility_date = "2026-07-03"
pages_build_output_dir = "dist"
```

For dashboard deployment, connect the Git repository to Cloudflare Pages and use the settings above. For CLI deployment, authenticate Wrangler and run:

```bash
npm run deploy:cloudflare
```

This project is a static Astro site. It does not need the Cloudflare adapter unless the site later adds server-side rendering, sessions, actions, or Workers runtime features.
