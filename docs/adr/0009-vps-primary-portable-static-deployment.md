# VPS-primary portable static deployment

Status: superseded by ADR-0010

EggDoc targets deployment to a self-managed VPS first, with Cloudflare Pages available as a temporary or secondary deployment option. The site should therefore build into portable static assets that can be served by Caddy, Nginx, or Cloudflare Pages without depending on a platform-specific runtime.
