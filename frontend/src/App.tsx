import { lazy, Suspense, useEffect } from "react";
import { FASES } from "./fases";
import { PaginaFase } from "./paginas/PaginaFase";
import { Inicio } from "./paginas/Inicio";
import { useRuta } from "./ruta";

const REPO = "https://github.com/javiersaguar/PIDS-Proyecto3";

// El mapa 3D (deck.gl) se carga aparte para que el resto de la web no lo descargue.
const Mapa3D = lazy(() => import("./mapa/Mapa3D"));

export function App() {
  const [pagina, seccion] = useRuta();
  const fase = FASES.find((f) => f.id === pagina);

  // Al cambiar de fase se vuelve arriba; si la ruta nombra una sección, se baja hasta ella.
  useEffect(() => {
    if (pagina === "mapa") return;
    if (!seccion) {
      window.scrollTo({ top: 0 });
      return;
    }
    const buscar = () => document.getElementById(seccion)?.scrollIntoView({ behavior: "smooth" });
    const t = window.setTimeout(buscar, 60);
    return () => window.clearTimeout(t);
  }, [pagina, seccion]);

  if (pagina === "mapa") {
    return (
      <Suspense fallback={<div className="mapa-cargando-modulo">Cargando el mapa 3D…</div>}>
        <Mapa3D />
      </Suspense>
    );
  }

  return (
    <>
      <header className="cabecera">
        <div className="contenedor">
          <a className="marca" href="#/">
            PIDS · Proyecto 3 <span>· Recarga de patinetes en Roma</span>
          </a>
          <nav className="pestanas" aria-label="Fases del proyecto">
            <a href="#/" aria-current={!fase ? "page" : undefined}>
              Inicio
            </a>
            {FASES.map((f) => (
              <a key={f.id} href={`#/${f.id}`} aria-current={fase?.id === f.id ? "page" : undefined}>
                {f.pestana}
              </a>
            ))}
            <a href="#/mapa">Mapa 3D</a>
            <a href="./presentacion/" target="_blank" rel="noopener">
              Presentación
            </a>
          </nav>
        </div>
      </header>
      <main className="contenedor">{fase ? <PaginaFase fase={fase} /> : <Inicio />}</main>
      <footer className="pie">
        <div className="contenedor">
          <span>Javier Saguar y Alejandro Cuevas · PIDS, Universidad Politécnica de Madrid · 2026</span>
          <span>
            Datos: viajes de Helbiz en Roma, febrero de 2021 · <a href={REPO}>Código y notebooks</a>
          </span>
        </div>
      </footer>
    </>
  );
}
