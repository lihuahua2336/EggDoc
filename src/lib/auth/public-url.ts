const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function isAllowedPublicSiteUrl(siteUrl: URL) {
  return (
    siteUrl.protocol === "https:" ||
    (siteUrl.protocol === "http:" && LOOPBACK_HOSTNAMES.has(siteUrl.hostname))
  );
}

export function toPublicRequestUrl(requestUrl: URL, siteUrl: URL) {
  return new URL(`${requestUrl.pathname}${requestUrl.search}`, siteUrl);
}
