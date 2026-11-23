// Copia la presentación compilada (un único dist/index.html) a presentacion/presentacion.html.
// Uso: npm run html   (compila antes).
import { copyFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(AQUI, "..", "..", "presentacion.html");
copyFileSync(join(AQUI, "..", "dist", "index.html"), SALIDA);
console.log(`Presentación guardada en ${SALIDA} (${Math.round(statSync(SALIDA).size / 1024)} kB)`);
