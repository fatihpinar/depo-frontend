// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    port: 5173,               // istersen değiştir ama sabit olsun
    proxy: {
      "/api": {
        target: "http://localhost:3000", // BE dev adresin
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
