import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

export default defineConfig({
  adapter: cloudflare({ imageService: "passthrough" }),
  env: {
    schema: {
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
    },
  },
  site: "https://eggdoc.pages.dev",
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
