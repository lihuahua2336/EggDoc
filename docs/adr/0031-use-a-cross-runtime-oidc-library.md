# Use a cross-runtime OIDC library

EggDoc reuses Infinite Canvas's authentication flow and EggAi ecosystem contract but does not copy its hand-written OIDC discovery, PKCE, token exchange, refresh, and ID Token verification code. A mature Web API and Web Crypto compatible OIDC library handles the protocol so the same authentication module can run on Cloudflare now and Node on a future VPS with less security risk.
