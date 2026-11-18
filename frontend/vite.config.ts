import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" para que la misma compilación funcione en GitHub Pages
// (https://javiersaguar.github.io/PIDS-Proyecto3/) y desde cualquier carpeta local.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { chunkSizeWarningLimit: 6000 },
});
