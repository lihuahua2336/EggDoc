# Container-first Node deployment behind a host reverse proxy

EggDoc uses an OCI container running the Astro Node standalone adapter as its primary production deployment. The container serves both prerendered public assets and dynamic authentication/API routes, binds fixed port 4322 to the host loopback interface, and relies on a host-managed Nginx or Caddy reverse proxy for the public HTTPS domain. Cloudflare Worker deployment remains available as a secondary target through the existing adapter and Wrangler configuration.

The deployment uses one ignored `.env` file for Compose interpolation and container runtime variables. Only `EGGDOC_SITE_URL`, `PUBLIC_EGGAI_BASE_URL`, and `PUBLIC_INSTALLER_ORIGIN` enter the image build because they determine canonical URLs and public client configuration; OIDC, session, and EggAi service secrets are injected only when the container starts. The image must not copy `.env`, `.env.local`, or other secret files into any layer.

`EGGDOC_SITE_URL` is the canonical public origin for OIDC callback URLs, Origin validation, and secure EggDoc Session cookies. Dynamic routes use this configured origin instead of trusting the container's internal HTTP request URL or forwarded headers. Because Astro's framework Origin check sees the internal HTTP origin before a route runs, the Node target disables that framework check and the only state-changing route performs an explicit canonical-origin check; the Cloudflare target retains the framework check. This makes the loopback HTTP port safe to place behind an external HTTPS reverse proxy and prevents the Node adapter from producing insecure `http://` callbacks.

The public installer origin defaults to `https://doc.eggai.icu`, which hosts only the EggDoc wrapper scripts. The Codex Shell wrapper and both Claude Code wrappers download their official CLI installers directly. The Windows Codex wrapper installs exact Microsoft Store product `9PLM9XGG6VKS`. No application-provided or third-party binary package is configured.

The container is stateless and requires no application volume because EggDoc keeps its encrypted session in the Reader's cookie and does not persist EggAi API Credentials. Every replica must use the same `EGGDOC_SESSION_SECRET`; rotating it invalidates existing EggDoc Sessions.

This decision supersedes ADR 0024 only where it names Cloudflare as the first runtime target. ADR 0024's prerendered-content boundary, portable web API requirement, future adapter portability, and no-database decision remain in force.
