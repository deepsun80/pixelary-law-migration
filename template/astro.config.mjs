// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";

// ⚠️ UPDATE per client: Set the production domain
const SITE_URL = "https://clientdomain.com";

export default defineConfig({
  site: SITE_URL,
  output: "static", // Static site — no server needed for basic law firm sites
  adapter: cloudflare(),
  integrations: [sitemap()],
  build: {
    // Inline small stylesheets for performance
    inlineStylesheets: "auto",
  },
  vite: {
    build: {
      // CSS code splitting for better caching
      cssCodeSplit: true,
    },
  },
});
