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

## Content

Content lives in `src/content` and is validated by `src/content.config.ts`.

- `src/content/guides` stores task-oriented setup and troubleshooting guides.
- `src/content/lessons` stores ordered learning-path lessons.
- `src/content/notes` stores flexible tool and concept notes.

Markdown is the default format. Use MDX only when an article needs richer presentation.

## Deployment

The site builds to static assets in `dist/`, making it suitable for Cloudflare Pages now and portable VPS static hosting later.
