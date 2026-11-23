// Exporta la presentación compilada (dist/) a presentacion/presentacion.pdf con Chrome sin ventana.
// Uso: npm run pdf   (compila antes). Ruta de Chrome: variable CHROME o la habitual de Windows.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = join(AQUI, "..", "dist");
const SALIDA = join(AQUI, "..", "..", "presentacion.pdf");
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Servidor estático mínimo sobre dist/.
const servidor = createServer((req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([\\/])+/, "");
  const fichero = join(DIST, ruta || "index.html");
  if (!fichero.startsWith(DIST)) return res.writeHead(403).end();
  let cuerpo;
  try {
    cuerpo = readFileSync(fichero);
  } catch {
    return res.writeHead(404).end();
  }
  res.writeHead(200, { "content-type": TIPOS[extname(fichero)] ?? "application/octet-stream" }).end(cuerpo);
});
await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${servidor.address().port}/index.html?imprimir`;

const perfil = mkdtempSync(join(tmpdir(), "presentacion-"));
const puerto = 9300 + Math.floor(Math.random() * 500);
const chrome = spawn(CHROME, ["--headless=new", `--user-data-dir=${perfil}`, `--remote-debugging-port=${puerto}`, "--hide-scrollbars", "about:blank"]);

try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      ws = (await (await fetch(`http://127.0.0.1:${puerto}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {
      await espera(250);
    }
  }
  if (!ws) throw new Error("Chrome no ha abierto el puerto de depuración.");
  const s = new WebSocket(ws);
  await new Promise((r) => (s.onopen = r));
  let id = 0;
  const pendientes = new Map();
  s.onmessage = (m) => {
    const d = JSON.parse(m.data);
    pendientes.get(d.id)?.(d);
    pendientes.delete(d.id);
  };
  const cmd = (method, params = {}) =>
    new Promise((r) => {
      pendientes.set(++id, r);
      s.send(JSON.stringify({ id, method, params }));
    });

  await cmd("Page.enable");
  await cmd("Page.navigate", { url });
  let listo = false;
  for (let i = 0; i < 80 && !listo; i++) {
    await espera(250);
    const r = await cmd("Runtime.evaluate", { expression: "document.body?.dataset.listo === '1'", returnByValue: true });
    listo = r.result?.result?.value === true;
  }
  if (!listo) throw new Error("La presentación no ha cargado los datos.");
  await espera(800);
  const r = await cmd("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
  if (!r.result) throw new Error(JSON.stringify(r.error));
  writeFileSync(SALIDA, Buffer.from(r.result.data, "base64"));
  console.log(`PDF guardado en ${SALIDA}`);
  s.close();
} finally {
  chrome.kill();
  servidor.close();
  await espera(500);
  rmSync(perfil, { recursive: true, force: true, maxRetries: 5 });
}
