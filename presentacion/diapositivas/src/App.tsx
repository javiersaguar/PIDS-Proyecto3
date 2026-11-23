// Presentación: una diapositiva a pantalla completa con flechas, espacio, clic o deslizando.
// Con ?imprimir se dibujan todas seguidas y sin animación (lo usa scripts/pdf.mjs).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { Estatico, SUAVE } from "./animacion";
import { DIAPOSITIVAS } from "./diapositivas";
import type { Datos } from "./tipos";

const IMPRIMIR = new URLSearchParams(location.search).has("imprimir");
const N = DIAPOSITIVAS.length;
const indiceDeRuta = () => Math.min(Math.max(Number(location.hash.replace("#/", "")) || 1, 1), N) - 1;

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

// Fondo de cada diapositiva: rejilla tenue y manchas de luz que se desplazan despacio.
function Fondo({ portada }: { portada?: boolean }) {
  return (
    <div className={`fondo${portada ? " fondo-portada" : ""}`} aria-hidden>
      <div className="mancha m1" />
      <div className="mancha m2" />
      <div className="mancha m3" />
      <div className="rejilla" />
    </div>
  );
}

function Lienzo({ d, i, escala }: { d: Datos; i: number; escala: number }) {
  const diapo = DIAPOSITIVAS[i];
  return (
    <div className="lienzo" style={{ transform: `translate(-50%, -50%) scale(${escala})` }}>
      <Fondo portada={diapo.portada} />
      <section className={`diapositiva${diapo.portada ? " portada" : ""}`} aria-label={diapo.titulo}>
        {diapo.contenido(d)}
        <footer className="pie">
          <span>PIDS · Proyecto 3 · Grupo 05</span>
          <span>
            {String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}
          </span>
        </footer>
      </section>
    </div>
  );
}

// La diapositiva que sale se aleja y se desenfoca; la que entra llega desde el lado del avance.
const paso = {
  entra: (dir: number) => ({ opacity: 0, x: dir * 160, scale: 1.04, filter: "blur(14px)" }),
  centro: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
  sale: (dir: number) => ({ opacity: 0, x: dir * -160, scale: 0.94, filter: "blur(14px)" }),
};

export function App() {
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState("");
  const [[i, dir], setPaso] = useState<[number, number]>([indiceDeRuta(), 0]);
  const escala = useEscala();
  const toque = useRef<number | null>(null);

  useEffect(() => {
    fetch("./datos.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`datos.json: ${r.status}`))))
      .then(setD)
      .catch((e: Error) => setError(e.message));
  }, []);

  const ir = useCallback(
    (n: number) => {
      const j = Math.min(Math.max(n, 0), N - 1);
      if (j === i) return;
      history.replaceState(null, "", `#/${j + 1}`);
      setPaso([j, j > i ? 1 : -1]);
    },
    [i],
  );

  useEffect(() => {
    if (IMPRIMIR) return;
    const tecla = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) ir(i + 1);
      else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) ir(i - 1);
      else if (e.key === "Home") ir(0);
      else if (e.key === "End") ir(N - 1);
      else if (e.key === "f") document.documentElement.requestFullscreen?.();
    };
    const ruta = () => {
      const j = indiceDeRuta();
      setPaso(([k]) => [j, j >= k ? 1 : -1]);
    };
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
    <MotionConfig reducedMotion="user">
      <div
        className="escenario"
        onClick={(e) => ir(e.clientX > innerWidth / 3 ? i + 1 : i - 1)}
        onTouchStart={(e) => (toque.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (toque.current === null) return;
          const dx = e.changedTouches[0].clientX - toque.current;
          toque.current = null;
          if (Math.abs(dx) > 50) ir(dx < 0 ? i + 1 : i - 1);
        }}
      >
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={i} className="capa" custom={dir} variants={paso} initial="entra" animate="centro" exit="sale" transition={{ duration: 0.45, ease: SUAVE }}>
            <Lienzo d={d} i={i} escala={escala} />
          </motion.div>
        </AnimatePresence>

        {/* Barrido de color que cruza la pantalla en cada cambio de diapositiva. */}
        {dir !== 0 && (
          <motion.div
            key={`barrido-${i}`}
            className="barrido"
            initial={{ x: dir > 0 ? "-120%" : "120%" }}
            animate={{ x: dir > 0 ? "120%" : "-120%" }}
            transition={{ duration: 0.95, ease: [0.65, 0, 0.35, 1] }}
          />
        )}

        <motion.div className="progreso" initial={false} animate={{ scaleX: (i + 1) / N }} transition={{ type: "spring", stiffness: 120, damping: 22 }} />

        <nav className="navegacion" onClick={(e) => e.stopPropagation()} aria-label="Diapositivas">
          {DIAPOSITIVAS.map((dp, j) => (
            <button key={dp.id} className="punto" onClick={() => ir(j)} aria-label={`${j + 1}. ${dp.titulo}`} aria-current={j === i}>
              {j === i && <motion.span layoutId="activo" className="activo" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            </button>
          ))}
        </nav>
      </div>
    </MotionConfig>
  );
}
