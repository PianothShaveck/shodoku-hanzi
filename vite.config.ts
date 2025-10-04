import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import createSvgSpritePlugin from "./vite-plugins/svg-sprite";

const basePath = process.env.BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  build: { sourcemap: true, outDir: "dist" },

  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("c-"),
        },
      },
    }),

    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "icon.svg",
        "apple-touch-icon.png",
        "robots.txt",
      ],
      manifest: {
        name: "Shodoku (Hanzi)",
        short_name: "Shodoku",
        description:
          "Learn Hanzi by reading and writing with spaced repetition and component insights.",
        categories: ["Education", "Reference"],
        background_color: "oklch(90% 0.05 180)",
        theme_color: "oklch(66.5% 0.226 3)",
        orientation: "any",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "browser"],
        start_url: ".",
        scope: ".",
        icons: [
          { src: "icon-192.png", type: "image/png", sizes: "192x192" },
          { src: "icon-mask.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
          { src: "icon-512.png", type: "image/png", sizes: "512x512" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{html,css,js}", "assets/**/*.{png,svg}"],
      },
    }),

    createSvgSpritePlugin("./src/assets/icons/", {
      svgo: { plugins: [{ name: "preset-default" }, { name: "removeXMLNS" }] },
    }),
  ],

  server: { watch: { ignored: ["**/public/data/**"] } },
});