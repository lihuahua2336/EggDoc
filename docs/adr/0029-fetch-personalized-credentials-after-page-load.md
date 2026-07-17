# Fetch personalized credentials after page load

EggDoc never injects personalized EggAi API credentials into prerendered or server-rendered tutorial HTML. Public pages always contain Configuration Placeholders, and an authenticated client panel retrieves credentials after page load through a private, non-cacheable endpoint, keeping raw keys out of build artifacts, Pagefind indexes, page source, and CDN page caches at the cost of a brief loading state.
