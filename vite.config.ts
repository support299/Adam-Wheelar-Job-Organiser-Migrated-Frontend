import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Cache the app shell (HTML/JS/CSS) so a hard refresh/relaunch works
      // even with zero network — the Dexie cache (src/db/dexie.ts) then
      // supplies the data once the app boots.
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
      },
      manifest: {
        name: "Job Organiser",
        short_name: "Job Organiser",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [
          { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // jsPDF lazily imports these for doc.html()/SVG, which the field forms
      // never use — they draw via explicit primitives (src/lib/fieldForms/pdf).
      // Left in, the service worker precaches ~377KB onto every phone for code
      // that never runs. Remove these three if jsPDF's HTML path is ever needed.
      html2canvas: path.resolve(__dirname, "./src/lib/fieldForms/pdf/emptyModule.ts"),
      dompurify: path.resolve(__dirname, "./src/lib/fieldForms/pdf/emptyModule.ts"),
      canvg: path.resolve(__dirname, "./src/lib/fieldForms/pdf/emptyModule.ts"),
    },
  },
});
