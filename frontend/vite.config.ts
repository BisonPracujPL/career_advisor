import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker: VITE_PROXY_TARGET=http://backend:8000 (set in docker-compose)
const apiTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true },
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/health": { target: apiTarget, changeOrigin: true },
    },
  },
});
