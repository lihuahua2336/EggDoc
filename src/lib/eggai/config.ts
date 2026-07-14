import { EGGDOC_EGGAI_ECOSYSTEM_URL } from "astro:env/server";

export function getEcosystemUrl() {
  if (!EGGDOC_EGGAI_ECOSYSTEM_URL) return null;
  try {
    return new URL(EGGDOC_EGGAI_ECOSYSTEM_URL);
  } catch {
    return null;
  }
}
