import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// base "./" para abrir la compilación desde cualquier carpeta, también sin red.
export default defineConfig({ base: "./", plugins: [react()] });
