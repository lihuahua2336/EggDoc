import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import node from "@astrojs/node";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

const deployTarget = process.env.EGGDOC_DEPLOY_TARGET ?? "cloudflare";
if (deployTarget !== "cloudflare" && deployTarget !== "node") {
  throw new Error(`Unsupported EGGDOC_DEPLOY_TARGET: ${deployTarget}`);
}

export default defineConfig({
  adapter:
    deployTarget === "node"
      ? node({ mode: "standalone" })
      : cloudflare({ imageService: "passthrough" }),
  env: {
    schema: {
      EGGDOC_SITE_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_OIDC_ISSUER: envField.string({ context: "server", access: "secret", optional: true }),
      EGGDOC_OIDC_CLIENT_ID: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_OIDC_CLIENT_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_OIDC_RESOURCE: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_OIDC_SCOPES: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_SESSION_SECRET: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_EGGAI_PLATFORM_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
      EGGDOC_EGGAI_ECOSYSTEM_URL: envField.string({
        context: "server",
        access: "secret",
        optional: true,
      }),
    },
  },
  site: process.env.EGGDOC_SITE_URL ?? "https://doc.eggai.icu",
  integrations: [mdx(), react(), sitemap()],
  security: {
    checkOrigin: deployTarget !== "node",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
