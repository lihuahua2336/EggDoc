# Cloudflare-first Astro static site

EggDoc uses Astro as the primary application framework and Cloudflare Pages as the first deployment target, while preserving the ability to serve the generated static assets from a VPS later. Astro is preferred over Next.js for this project because EggDoc is content-first, Markdown/MDX-heavy, and does not currently need a long-running application server or framework-specific runtime features.
