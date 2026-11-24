// Lee docs/TAREAS.md y escribe src/tareas.json con los bloques y el estado de cada tarea.
// TAREAS.md es la única fuente: la web no repite estados ni repartos a mano.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const origen = join(aqui, "..", "..", "docs", "TAREAS.md");
const destino = join(aqui, "..", "src", "tareas.json");
const ESTADOS = ["pendiente", "en curso", "revisión", "hecha"];

const texto = readFileSync(origen, "utf8").replace(/\r\n/g, "\n");
const limpiar = (s) => s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`/g, "").trim();
const celdas = (linea) => linea.split("|").slice(1, -1).map((c) => c.trim());

function expandir(rangos) {
  const ids = [];
  for (const parte of rangos.split(",").map((s) => s.trim()).filter(Boolean)) {
    const m = parte.match(/^T(\d+)(?:\s*[–-]\s*T(\d+))?$/);
    if (!m) throw new Error(`Rango de tareas no válido en TAREAS.md: «${parte}»`);
    const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
    for (let n = a; n <= b; n++) ids.push(`T${String(n).padStart(2, "0")}`);
  }
  return ids;
}

const tareas = {};
const bloques = [];
let seccion = "";
for (const linea of texto.split("\n")) {
  if (linea.startsWith("## ")) seccion = linea.slice(3).trim();
  if (!linea.startsWith("|") || /^\|[\s|:-]+\|$/.test(linea)) continue;
  const c = celdas(linea);
  if (seccion === "Bloques" && c[0] !== "Bloque") {
    bloques.push({ nombre: limpiar(c[0]), rangos: c[1], responsable: limpiar(c[2]), tareas: expandir(c[1]) });
  } else if (/^T\d{2}$/.test(c[0])) {
    const [id, titulo, tipo, responsable, estado] = c;
    if (!ESTADOS.includes(estado)) throw new Error(`${id}: estado «${estado}» no reconocido`);
    if (tareas[id]) throw new Error(`${id} aparece dos veces en TAREAS.md`);
    tareas[id] = { titulo: limpiar(titulo), tipo, responsable: limpiar(responsable), estado, seccion };
  }
}

// Cada tarea pertenece a un solo bloque y cada bloque nombra tareas que existen.
const vistas = new Map();
for (const b of bloques) {
  for (const id of b.tareas) {
    if (!tareas[id]) throw new Error(`El bloque «${b.nombre}» nombra ${id}, que no está en las tablas de tareas`);
    if (vistas.has(id)) throw new Error(`${id} está en los bloques «${vistas.get(id)}» y «${b.nombre}»`);
    vistas.set(id, b.nombre);
  }
}
const sueltas = Object.keys(tareas).filter((id) => !vistas.has(id));
if (sueltas.length) throw new Error(`Tareas sin bloque en TAREAS.md: ${sueltas.join(", ")}`);
if (!bloques.length) throw new Error("TAREAS.md no tiene la tabla de bloques");

writeFileSync(destino, JSON.stringify({ estados: ESTADOS, bloques, tareas }, null, 1) + "\n");
console.log(`tareas.json: ${Object.keys(tareas).length} tareas en ${bloques.length} bloques`);
