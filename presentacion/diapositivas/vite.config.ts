import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Todo (código, estilos, fuentes y datos) dentro de un único index.html que se abre con doble
// clic, sin servidor ni conexión. Lo copia a presentacion/presentacion.html «npm run html».
export default defineConfig({ base: "./", plugins: [react(), viteSingleFile()] });
