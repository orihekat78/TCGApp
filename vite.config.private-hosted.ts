import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(__dirname, "meta-app"),
  publicDir: resolve(__dirname, "public"),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\//.test(id)) return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: [
      { find: "@meta", replacement: resolve(__dirname, "meta-app/src") },
      { find: "@", replacement: resolve(__dirname, "src") },
    ],
  },
});
