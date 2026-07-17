# Prerendered content with a portable server runtime

EggDoc keeps public content prerendered while adding a small Astro server runtime for EggAi authentication, session handling, and personalized configuration retrieval. Cloudflare is the first runtime target, but server code should use portable web APIs so a future VPS deployment can switch to Astro's Node adapter behind Caddy or Nginx without rewriting the integration; a separate authentication service and database are not part of this decision.
