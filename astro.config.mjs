import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://eggdoc.pages.dev",
  integrations: [mdx(), react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
