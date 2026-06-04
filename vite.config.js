import { defineConfig } from "vite";

export default defineConfig({
  server: {
    open: false,
    allowedHosts: ["geotime.joey-love.com"],
  },
  build: {
    outDir: "dist",
  },
});
