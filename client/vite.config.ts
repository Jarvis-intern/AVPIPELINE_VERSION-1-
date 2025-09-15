import path from "path";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ADD THIS 'server' BLOCK
  server: {
    proxy: {
      // Proxy all API requests starting with /api
      "/api": {
        target: "http://localhost:8000", // Your Go backend URL
        changeOrigin: true,
      },
      // Proxy all WebSocket requests starting with /ws
      "/ws": {
        target: "ws://localhost:8000", // Your Go WebSocket URL
        ws: true, // This is crucial for WebSockets
      },
    },
  },
});