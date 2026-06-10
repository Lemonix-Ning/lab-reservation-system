import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";


const plugins = [react(), tailwindcss()];

// Determine base path based on environment
const getBase = () => {
  if (process.env.NODE_ENV === "production" && process.env.GITHUB_PAGES === "true") {
    return "/lab-reservation-system/";
  }
  return "/";
};

export default defineConfig({
  base: getBase(),
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: process.env.BACKEND_URL || "http://localhost:3000",
        changeOrigin: true,
      },
      "/api/oauth": {
        target: process.env.BACKEND_URL || "http://localhost:3000",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
