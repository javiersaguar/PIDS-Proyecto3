// Presentación: una diapositiva a pantalla completa con flechas, espacio o clic.
// Con ?imprimir se dibujan todas seguidas y sin animación (lo usa scripts/pdf.mjs).
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DIAPOSITIVAS } from "./diapositivas";
import { Estatico } from "./graficos";
import type { Datos } from "./tipos";

const IMPRIMIR = new URLSearchParams(location.search).has("imprimir");
const indiceDeRuta = () => Math.min(Math.max(Number(location.hash.replace("#/", "")) || 1, 1), DIAPOSITIVAS.length) - 1;

function useEscala() {
  const [escala, setEscala] = useState(1);
  useLayoutEffect(() => {
    const ajustar = () => setEscala(Math.min(innerWidth / 1920, innerHeight / 1080));
    ajustar();
    addEventListener("resize", ajustar);
    return () => removeEventListener("resize", ajustar);
  }, []);
  return escala;
}

function Lienzo({ d, i, escala }: { d: Datos; i: number; escala: number }) {
  const diapo = DIAPOSITIVAS[i];
  return (
    <div className="lienzo" style={{ transform: `translate(-50%, -50%) scale(${escala})` }}>
      <section className={`diapositiva${diapo.portada ? " portada" : ""}`} aria-label={diapo.titulo}>
        {diapo.contenido(d)}
        <footer className="pie">
          <span>PIDS · Proyecto 3 · Grupo 02</span>
          <span>
            {i + 1} / {DIAPOSITIVAS.length}
          </span>
        </footer>
      </section>
    </div>
  );
}

export function App() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [i, setI] = useState(indiceDeRuta);
  const escala = useEscala();

  useEffect(() => {
    fetch("./datos.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`datos.json: ${r.status}`))))
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, []);

  const ir = useCallback((n: number) => {
    const j = Math.min(Math.max(n, 0), DIAPOSITIVAS.length - 1);
    history.replaceState(null, "", `#/${j + 1}`);
    setI(j);
  }, []);

  useEffect(() => {
    if (IMPRIMIR) return;
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) ir(i + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) ir(i - 1);
      else if (e.key === "Home") ir(0);
      else if (e.key === "End") ir(DIAPOSITIVAS.length - 1);
      else if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    const ruta = () => setI(indiceDeRuta());
    addEventListener("keydown", tecla);
    addEventListener("hashchange", ruta);
    return () => {
      removeEventListener("keydown", tecla);
      removeEventListener("hashchange", ruta);
    };
  }, [i, ir]);

  useEffect(() => {
    document.documentElement.classList.toggle("imprimir", IMPRIMIR);
    if (d && IMPRIMIR) document.body.dataset.listo = "1";
  }, [d]);

  if (error) return <p style={{ color: "#fff", padding: 40 }}>No se pudieron cargar los datos ({error}). Ejecuta «npm run datos».</p>;
  if (!d) return null;

  if (IMPRIMIR)
    return (
      <Estatico.Provider value>
        <div className="escenario">
          {DIAPOSITIVAS.map((_, j) => (
            <Lienzo key={j} d={d} i={j} escala={1} />
          ))}
        </div>
      </Estatico.Provider>
    );

  return (
    <div className="escenario" onClick={(e) => ir(e.clientX > innerWidth / 3 ? i + 1 : i - 1)}>
      <AnimatePresence mode="wait">
        <motion.div key={i} className="capa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <Lienzo d={d} i={i} escala={escala} />
        </motion.div>
      </AnimatePresence>
      <nav className="navegacion" onClick={(e) => e.stopPropagation()}>
        {i + 1} / {DIAPOSITIVAS.length}
        <button onClick={() => ir(i - 1)} aria-label="Anterior">
          ←
        </button>
        <button onClick={() => ir(i + 1)} aria-label="Siguiente">
          →
        </button>
      </nav>
    </div>
  );
}
