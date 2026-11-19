// Mapa 3D de Roma para la defensa: un relato por capítulos sobre los datos del notebook
// movilidad/T36_capas_mapa.ipynb. Ruta: #/mapa/<capítulo>.
import { FlyToInterpolator, type MapViewState, type PickingInfo } from "@deck.gl/core";
import DeckGL from "@deck.gl/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { num } from "../formato";
import { useRuta } from "../ruta";
import { capaEtiquetas, capasBase, capasDatos, luces, maximosDe, pasoOcupacion, valorDemanda, valorSaldo } from "./capas";
import { CAPITULOS, type Capas, type Contexto, type TipoDia } from "./capitulos";
import { horaDelDia, horaReloj, useDemo, type CeldaDemanda, type CeldaSaldo, type Demo, type Estacion } from "./datos";
import { Ficha } from "./Ficha";
import { CurvaCobertura } from "./Graficas";
import "./mapa.css";
import { css, rampa, TEMAS, type Tema } from "./tema";

type Vista = MapViewState & {
  transitionDuration?: number;
  transitionInterpolator?: FlyToInterpolator;
  padding?: { left: number; right: number; top: number; bottom: number };
};

const DIA_S = 24 * 3600;
const VELOCIDADES = [
  { valor: 360, nombre: "×1", detalle: "una hora cada 10 s" },
  { valor: 720, nombre: "×2", detalle: "una hora cada 5 s" },
  { valor: 1440, nombre: "×4", detalle: "una hora cada 2,5 s" },
];

const leerTema = (): Tema["nombre"] => {
  // ?tema=claro u ?tema=oscuro en la URL manda (útil para abrir la defensa con el tema del proyector).
  const pedido = new URLSearchParams(window.location.search).get("tema");
  if (pedido === "claro" || pedido === "oscuro") return pedido;
  try {
    return localStorage.getItem("mapa-tema") === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
};

const movimientoReducido = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Mapa3D() {
  const carga = useDemo();
  const [tema, setTema] = useState<Tema["nombre"]>(leerTema);
  useEffect(() => {
    try {
      localStorage.setItem("mapa-tema", tema);
    } catch {
      /* sin almacenamiento: el tema no se recuerda */
    }
  }, [tema]);

  if (!carga.demo) {
    return (
      <div className={`mapa3d tema-${tema}`}>
        <div className="mapa-carga">
          {carga.error ? (
            <>
              <p>No se pudieron cargar los datos del mapa: {carga.error}</p>
              <a href="#/">Volver a la web de resultados</a>
            </>
          ) : (
            <>
              <div className="mapa-carga-titulo">Roma · estaciones de recarga</div>
              <div className="mapa-carga-barra">
                <span style={{ width: `${Math.round(carga.progreso * 100)}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  return <Escena demo={carga.demo} tema={tema} setTema={setTema} />;
}

function Escena({ demo, tema: nombreTema, setTema }: { demo: Demo; tema: Tema["nombre"]; setTema: (t: Tema["nombre"]) => void }) {
  const tema = TEMAS[nombreTema];
  const [, idRuta] = useRuta();
  const indice = Math.max(0, CAPITULOS.findIndex((c) => c.id === idRuta));
  const capitulo = CAPITULOS[indice];
  const reducido = useMemo(movimientoReducido, []);

  const radioDefecto = demo.manifiesto.networks.find((r) => r.network_id === demo.manifiesto.network_por_defecto)!.radio_m;
  const [radio, setRadio] = useState(radioDefecto);
  const red = demo.redes.get(radio)!;
  const barrido = demo.barrido.radios[String(radio)];
  const [k, setK] = useState(barrido.k_referencia);
  const [t, setT] = useState(capitulo.horaInicial ?? 0);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [velocidad, setVelocidad] = useState(VELOCIDADES[1].valor);
  const [tipoDia, setTipoDia] = useState<TipoDia>("laborable");
  const [franja, setFranja] = useState(-1);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [panelVisible, setPanelVisible] = useState(true);
  const [capasLibres, setCapasLibres] = useState<Capas>(capitulo.capas);
  const [errorWebgl, setErrorWebgl] = useState<string | null>(null);
  const estrecho = typeof window !== "undefined" && window.innerWidth < 820;

  const capas = capitulo.controles.capas ? capasLibres : capitulo.capas;
  const hora = horaDelDia(t, demo.manifiesto.hora_reposicion);

  // Cámara controlada: los capítulos vuelan a su vista y el usuario puede moverla libremente.
  const ahoraBase = { vacias: 0, llenas: 0, enCurso: 0 };
  const contextoVista: Contexto = { demo, red, radio, barrido, k, t, tipoDia, ahora: ahoraBase };
  const vistaDe = useCallback(
    (ctx: Contexto, conTransicion: boolean): Vista => {
      const v = capitulo.vista(ctx);
      return {
        ...v,
        zoom: v.zoom - (estrecho ? 0.9 : 0),
        maxPitch: 75,
        minZoom: 10.5,
        maxZoom: 17,
        padding: { left: panelVisible && !estrecho ? 430 : 0, right: 0, top: 0, bottom: estrecho ? 220 : 0 },
        ...(conTransicion && !reducido
          ? { transitionDuration: 2200, transitionInterpolator: new FlyToInterpolator({ speed: 1.3 }) }
          : {}),
      };
    },
    [capitulo, estrecho, panelVisible, reducido],
  );
  const [vista, setVista] = useState<Vista>(() => vistaDe(contextoVista, false));
  const interaccion = useRef({ usuario: false, transicion: false });

  // Al entrar en un capítulo: cámara, reloj, k y selección.
  useEffect(() => {
    interaccion.current = { usuario: false, transicion: true };
    setVista(vistaDe({ ...contextoVista }, true));
    if (capitulo.horaInicial !== undefined) setT(capitulo.horaInicial);
    setReproduciendo(Boolean(capitulo.reproducir) && !reducido);
    setFranja(-1);
    if (capitulo.controles.capas) setCapasLibres(capitulo.capas);
    if (capitulo.seleccionarMaxEnergia) {
      const max = red.estaciones.reduce((a, b) => (b.energia_kwh_dia > a.energia_kwh_dia ? b : a));
      setSeleccion(max.station_id);
    } else {
      setSeleccion(null);
    }
    if (capitulo.animarK && !reducido) {
      const fin = barrido.k_referencia;
      const inicio = performance.now();
      let marco = 0;
      const avanzar = (ahora: number) => {
        const f = Math.min(1, (ahora - inicio) / 3800);
        setK(Math.max(1, Math.round(fin * (1 - (1 - f) ** 2))));
        if (f < 1) marco = requestAnimationFrame(avanzar);
      };
      marco = requestAnimationFrame(avanzar);
      return () => cancelAnimationFrame(marco);
    }
    setK(barrido.k_referencia);
    // Solo al cambiar de capítulo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capitulo.id]);

  // Al cambiar de radio, la red de referencia de ese radio.
  useEffect(() => {
    setK(barrido.k_referencia);
    // Los identificadores se repiten entre redes pero son estaciones distintas: se cierra la ficha.
    setSeleccion(
      capitulo.seleccionarMaxEnergia
        ? red.estaciones.reduce((a, b) => (b.energia_kwh_dia > a.energia_kwh_dia ? b : a)).station_id
        : null,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radio]);

  // Reloj y giro suave de la cámara en la portada.
  const refs = useRef({ reproduciendo, velocidad, girar: Boolean(capitulo.girar) && !reducido });
  refs.current = { reproduciendo, velocidad, girar: Boolean(capitulo.girar) && !reducido };
  useEffect(() => {
    let marco = 0;
    let antes = performance.now();
    const latido = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      const r = refs.current;
      if (r.reproduciendo) setT((x) => (x + dt * r.velocidad) % DIA_S);
      if (r.girar && !interaccion.current.usuario && !interaccion.current.transicion) {
        setVista((v) => ({ ...v, bearing: (v.bearing ?? 0) + dt * 2.2, transitionDuration: 0 }));
      }
      marco = requestAnimationFrame(latido);
    };
    marco = requestAnimationFrame(latido);
    return () => cancelAnimationFrame(marco);
  }, []);

  // Navegación entre capítulos con el teclado (sin robar las flechas a los controles).
  const ir = useCallback((i: number) => {
    const destino = CAPITULOS[Math.min(CAPITULOS.length - 1, Math.max(0, i))];
    window.location.hash = `#/mapa/${destino.id}`;
  }, []);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const objetivo = e.target as HTMLElement;
      const enControl = ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(objetivo.tagName);
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!enControl && (e.key === "ArrowRight" || e.key === "PageDown")) ir(indice + 1);
      else if (!enControl && (e.key === "ArrowLeft" || e.key === "PageUp")) ir(indice - 1);
      else if (e.key === "Escape") setSeleccion(null);
      else if (!enControl && e.key === " " && capitulo.controles.reloj) {
        e.preventDefault();
        setReproduciendo((r) => !r);
      } else if (!enControl && e.key.toLowerCase() === "h") setPanelVisible((p) => !p);
      else if (!enControl && e.key.toLowerCase() === "t") setTema(nombreTema === "oscuro" ? "claro" : "oscuro");
      else if (!enControl && e.key.toLowerCase() === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, ir, capitulo.controles.reloj, nombreTema, setTema]);

  // Estado de las estaciones en este instante (capítulo de la jornada).
  const paso = pasoOcupacion(demo, t);
  const ahora = useMemo(() => {
    const occ = demo.dia.ocupacion[red.resumen.network_id];
    let vacias = 0;
    let llenas = 0;
    red.estaciones.forEach((s) => {
      const n = occ[s.indice][paso];
      if (n === 0) vacias += 1;
      else if (n >= s.anclajes) llenas += 1;
    });
    const enCurso = demo.dia.viajes.filter((v) => v.salida <= t && t <= v.llegada);
    return { vacias, llenas, enCurso: enCurso.length };
  }, [demo, red, paso, t]);
  const contexto: Contexto = { demo, red, radio, barrido, k, t, tipoDia, ahora };

  const base = useMemo(() => capasBase(demo.base, tema), [demo, tema]);
  const etiquetas = useMemo(
    () => capaEtiquetas(demo.base.etiquetas, tema, vista.zoom),
    // Las etiquetas de barrio aparecen o desaparecen al cruzar el umbral de zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, tema, vista.zoom >= 12.9],
  );
  const efectos = useMemo(() => [luces(tema)], [tema]);
  const datos = capasDatos(demo, { capas, red, radio, k, t, tipoDia, franja, seleccion }, tema);

  const estacionElegida = seleccion ? red.estaciones.find((s) => s.station_id === seleccion) : undefined;

  const alPulsar = (info: PickingInfo) => {
    const id = info.layer?.id ?? "";
    const o = info.object as Estacion | { rango: number } | undefined;
    if (!o) return;
    if (id.startsWith("estaciones")) setSeleccion((o as Estacion).station_id);
    else if (id === "barrido") {
      const r = (o as { rango: number }).rango;
      if (r <= barrido.k_referencia) setSeleccion(`E${String(r).padStart(3, "0")}`);
    }
  };

  const tooltip = (info: PickingInfo) => descripcion(info, demo, capas.demanda, hora, tipoDia, franja, tema);

  const vistaInicial = () => {
    interaccion.current = { usuario: false, transicion: true };
    setVista(vistaDe(contexto, true));
  };

  return (
    <div className={`mapa3d tema-${nombreTema}${panelVisible ? "" : " sin-panel"}`} style={{ background: tema.fondo }}>
      <DeckGL
        viewState={vista}
        onViewStateChange={({ viewState, interactionState }) => {
          const i = interactionState ?? {};
          interaccion.current.transicion = Boolean(i.inTransition);
          if (i.isDragging || i.isPanning || i.isRotating || i.isZooming) interaccion.current.usuario = true;
          setVista(viewState as Vista);
        }}
        controller={{ inertia: true, touchRotate: true }}
        layers={[...base, ...datos, etiquetas]}
        effects={efectos}
        getTooltip={tooltip}
        onClick={alPulsar}
        onError={(e) => setErrorWebgl(e.message)}
        getCursor={({ isHovering, isDragging }) => (isDragging ? "grabbing" : isHovering ? "pointer" : "grab")}
      />

      {errorWebgl && (
        <div className="mapa-aviso" role="alert">
          El navegador no pudo dibujar el mapa 3D ({errorWebgl}). Las mismas cifras están en la{" "}
          <a href="#/fase1">web de resultados</a>.
        </div>
      )}

      <div className="mapa-barra-superior">
        <a className="mapa-volver" href="#/" title="Volver a la web de resultados">
          ← Web
        </a>
        <button type="button" className="boton-texto" onClick={() => setTema(nombreTema === "oscuro" ? "claro" : "oscuro")}>
          {nombreTema === "oscuro" ? "Tema claro" : "Tema oscuro"}
        </button>
        <button type="button" className="boton-texto" onClick={() => setPanelVisible((p) => !p)} title="Tecla H">
          {panelVisible ? "Ocultar panel" : "Mostrar panel"}
        </button>
        <button type="button" className="boton-texto" onClick={vistaInicial} title="Vuelve a la vista del capítulo">
          Centrar
        </button>
      </div>

      {panelVisible && (
        <section className="mapa-panel" aria-label="Relato del mapa">
          <div className="mapa-marca">
            <span>PIDS · Proyecto 3</span>
            <b>Estaciones de recarga en Roma</b>
          </div>
          <nav className="mapa-capitulos" aria-label="Capítulos">
            {CAPITULOS.map((c, i) => (
              <a key={c.id} href={`#/mapa/${c.id}`} aria-current={i === indice ? "step" : undefined}>
                <span>{i + 1}</span>
                {c.corto}
              </a>
            ))}
          </nav>
          <div className="mapa-capitulo" key={capitulo.id}>
            <div className="mapa-paso">
              {indice + 1} / {CAPITULOS.length}
            </div>
            <h1>{capitulo.titulo}</h1>
            <div className="mapa-cuerpo">{capitulo.cuerpo(contexto)}</div>

            {capitulo.controles.red && <SelectorRadio demo={demo} radio={radio} setRadio={setRadio} />}
            {capitulo.controles.k && (
              <div className="mapa-control">
                <CurvaCobertura barrido={barrido} k={k} alCambiar={setK} />
                <label className="deslizador">
                  <span>Estaciones: {k}</span>
                  <input
                    type="range"
                    min={1}
                    max={barrido.pct_viajes.length}
                    value={k}
                    onChange={(e) => setK(Number(e.target.value))}
                  />
                </label>
              </div>
            )}
            {capitulo.controles.franja && <SelectorFranja demo={demo} franja={franja} setFranja={setFranja} />}
            {capitulo.controles.tabla && <TablaRedes demo={demo} radio={radio} setRadio={setRadio} />}
            {capitulo.controles.capas && <SelectorCapas capas={capasLibres} setCapas={setCapasLibres} />}

            {capitulo.cifras(contexto).length > 0 && (
              <div className="mapa-cifras">
                {capitulo.cifras(contexto).map((c) => (
                  <div key={c.nombre}>
                    <div className="valor">{c.valor}</div>
                    <div className="nombre">{c.nombre}</div>
                  </div>
                ))}
              </div>
            )}
            {capitulo.decision && <div className="mapa-decision">{capitulo.decision(contexto)}</div>}
          </div>
          <div className="mapa-navegacion">
            <button type="button" onClick={() => ir(indice - 1)} disabled={indice === 0}>
              ← Anterior
            </button>
            <span className="mapa-atajos">← → para avanzar</span>
            <button type="button" onClick={() => ir(indice + 1)} disabled={indice === CAPITULOS.length - 1}>
              Siguiente →
            </button>
          </div>
        </section>
      )}

      {capitulo.controles.reloj && (
        <div className="mapa-reloj">
          <button
            type="button"
            className="boton-reproducir"
            onClick={() => setReproduciendo((r) => !r)}
            aria-label={reproduciendo ? "Pausar" : "Reproducir"}
            title="Barra espaciadora"
          >
            {reproduciendo ? "❚❚" : "▶"}
          </button>
          <div className="mapa-hora">
            <b>{capas.demanda === "hora" ? `${String(hora).padStart(2, "0")}:00` : horaReloj(t, demo.manifiesto.hora_reposicion)}</b>
            <span>
              {capas.demanda === "hora"
                ? `${tipoDia === "laborable" ? "laborable" : "fin de semana"} medio, ${hora}–${hora + 1} h`
                : `jornada del ${demo.dia.fecha.split("-").reverse().slice(0, 2).join("/")}`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={DIA_S - 60}
            step={60}
            value={Math.floor(t)}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label="Hora del día"
          />
          <div className="mapa-velocidad" role="group" aria-label="Velocidad">
            {VELOCIDADES.map((v) => (
              <button
                key={v.valor}
                type="button"
                aria-pressed={velocidad === v.valor}
                title={v.detalle}
                onClick={() => setVelocidad(v.valor)}
              >
                {v.nombre}
              </button>
            ))}
          </div>
          {capitulo.controles.tipoDia && (
            <div className="mapa-velocidad" role="group" aria-label="Tipo de día">
              {(["laborable", "fin_de_semana"] as TipoDia[]).map((d) => (
                <button key={d} type="button" aria-pressed={tipoDia === d} onClick={() => setTipoDia(d)}>
                  {d === "laborable" ? "Laborable" : "Fin de semana"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {capitulo.leyenda && (
        <Leyenda tipo={capitulo.leyenda} demo={demo} tema={tema} radio={radio} capas={capas} tipoDia={tipoDia} />
      )}

      {estacionElegida && (
        <Ficha
          demo={demo}
          red={red}
          estacion={estacionElegida}
          hora={capitulo.controles.reloj ? hora : undefined}
          tipoDia={tipoDia}
          alCerrar={() => setSeleccion(null)}
        />
      )}

      <div className="mapa-atribucion">
        {demo.base.atribucion.split(" (")[0]} · Viajes: Helbiz, Roma, febrero de 2021 · Red preliminar (voraz) · ejecución{" "}
        {demo.manifiesto.run_id}
      </div>
    </div>
  );
}

function SelectorRadio({ demo, radio, setRadio }: { demo: Demo; radio: number; setRadio: (r: number) => void }) {
  return (
    <div className="mapa-control">
      <div className="mapa-control-titulo">Radio de acceso a pie</div>
      <div className="mapa-segmentado" role="group" aria-label="Radio de acceso">
        {demo.manifiesto.networks.map((r) => (
          <button key={r.radio_m} type="button" aria-pressed={radio === r.radio_m} onClick={() => setRadio(r.radio_m)}>
            {r.radio_m} m<small>{r.estaciones} est.</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectorFranja({ demo, franja, setFranja }: { demo: Demo; franja: number; setFranja: (f: number) => void }) {
  const nombres: Record<string, string> = {
    madrugada: "Madrugada",
    punta_manana: "Punta mañana",
    mediodia: "Mediodía",
    punta_tarde: "Punta tarde",
    noche: "Noche",
  };
  return (
    <div className="mapa-control">
      <div className="mapa-control-titulo">Saldo por franja (patinetes/día en esa franja)</div>
      <div className="mapa-segmentado envolver" role="group" aria-label="Franja horaria">
        <button type="button" aria-pressed={franja === -1} onClick={() => setFranja(-1)}>
          Día completo
        </button>
        {demo.saldo.franjas.map((f, i) => (
          <button key={f} type="button" aria-pressed={franja === i} onClick={() => setFranja(i)}>
            {nombres[f] ?? f}
            <small>
              {demo.saldo.franjas_horas[i][0]}–{demo.saldo.franjas_horas[i][1]} h
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

function TablaRedes({ demo, radio, setRadio }: { demo: Demo; radio: number; setRadio: (r: number) => void }) {
  const redes = demo.manifiesto.networks;
  return (
    <div className="mapa-control">
      <table className="mapa-tabla">
        <caption>Redes de referencia: cada una atiende el 80 % de los viajes del ajuste</caption>
        <thead>
          <tr>
            <th scope="col">Radio</th>
            <th scope="col">Estaciones</th>
            <th scope="col">Patinetes</th>
            <th scope="col">Anclajes</th>
            <th scope="col">Rebal./noche</th>
            <th scope="col">A pie (med.)</th>
          </tr>
        </thead>
        <tbody>
          {redes.map((r) => (
            <tr key={r.radio_m} aria-selected={r.radio_m === radio} onClick={() => setRadio(r.radio_m)}>
              <th scope="row">{r.radio_m} m</th>
              <td>{num(r.estaciones)}</td>
              <td>{num(r.flota)}</td>
              <td>{num(r.anclajes)}</td>
              <td>{num(r.rebalanceo_noche_media)}</td>
              <td>{num((r.d_origen_mediana_m + r.d_destino_mediana_m) / 2)} m</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mapa-nota">
        «A pie»: mediana, en línea recta, de la distancia de cada origen y destino a su estación más cercana. Pulsa una fila
        para ver esa red.
      </p>
    </div>
  );
}

function SelectorCapas({ capas, setCapas }: { capas: Capas; setCapas: (c: Capas) => void }) {
  const cambiar = <K extends keyof Capas>(clave: K, valor: Capas[K]) => setCapas({ ...capas, [clave]: valor });
  return (
    <div className="mapa-control mapa-capas">
      <div className="mapa-control-titulo">Capas</div>
      <label>
        Estaciones
        <select value={capas.estaciones} onChange={(e) => cambiar("estaciones", e.target.value as Capas["estaciones"])}>
          <option value="no">Ocultas</option>
          <option value="puntos">Puntos</option>
          <option value="anclajes">Anclajes y stock</option>
          <option value="ocupacion">Ocupación a esta hora</option>
          <option value="energia">Energía al día</option>
        </select>
      </label>
      <label>
        Demanda
        <select value={capas.demanda} onChange={(e) => cambiar("demanda", e.target.value as Capas["demanda"])}>
          <option value="no">Oculta</option>
          <option value="total">Media diaria</option>
          <option value="hora">Por hora</option>
          <option value="plana">Plana</option>
        </select>
      </label>
      <label>
        Viajes del día
        <select value={capas.viajes} onChange={(e) => cambiar("viajes", e.target.value as Capas["viajes"])}>
          <option value="no">Ocultos</option>
          <option value="todos">Todos</option>
          <option value="atencion">Atendidos / fuera</option>
        </select>
      </label>
      <label className="casilla">
        <input type="checkbox" checked={capas.saldo} onChange={(e) => cambiar("saldo", e.target.checked)} /> Saldo por zona
      </label>
      <label className="casilla">
        <input type="checkbox" checked={capas.radios} onChange={(e) => cambiar("radios", e.target.checked)} /> Radios de acceso
      </label>
      <label className="casilla">
        <input type="checkbox" checked={capas.flujos} onChange={(e) => cambiar("flujos", e.target.checked)} /> Flujos entre
        estaciones
      </label>
    </div>
  );
}

function Degradado({ paradas, desde, hasta, titulo }: { paradas: string[]; desde: string; hasta: string; titulo: string }) {
  return (
    <div className="leyenda-degradado">
      <div className="leyenda-titulo">{titulo}</div>
      <div className="barra" style={{ background: `linear-gradient(90deg, ${paradas.join(", ")})` }} />
      <div className="extremos">
        <span>{desde}</span>
        <span>{hasta}</span>
      </div>
    </div>
  );
}

function Leyenda({
  tipo,
  demo,
  tema,
  radio,
  capas,
  tipoDia,
}: {
  tipo: NonNullable<(typeof CAPITULOS)[number]["leyenda"]>;
  demo: Demo;
  tema: Tema;
  radio: number;
  capas: Capas;
  tipoDia: TipoDia;
}) {
  const max = maximosDe(demo);
  const muestra = (color: string, forma: "linea" | "punto" | "barra" | "anillo" = "punto") => (
    <i className={`muestra ${forma}`} style={{ color }} />
  );
  const rampaCss = (paradas: Tema["demanda"], n = 6) =>
    Array.from({ length: n }, (_, i) => css(rampa(paradas, Math.sqrt(i / (n - 1)))));
  return (
    <div className="mapa-leyenda" aria-label="Leyenda">
      {tipo === "viajes" && (
        <div className="fila">
          {muestra(css(tema.demanda[tema.nombre === "oscuro" ? 4 : 3]), "linea")} Viajes de los últimos 20 minutos, de origen
          a destino (recta ilustrativa)
        </div>
      )}
      {tipo === "demanda" && (
        <Degradado
          titulo={capas.demanda === "hora" ? "Orígenes + destinos por hora (celda de 0,1 km²)" : "Orígenes + destinos por día (celda de 0,1 km²)"}
          paradas={rampaCss(tema.demanda)}
          desde="0"
          hasta={num(capas.demanda === "hora" ? max.demandaHora[tipoDia] : max.demandaTotal, 1)}
        />
      )}
      {tipo === "saldo" && (
        <>
          <Degradado
            titulo="Saldo orígenes − destinos (patinetes/día)"
            paradas={[...tema.receptora].reverse().concat(tema.emisora.slice(1)).map((c) => css(c))}
            desde="−4 recibe"
            hasta="+4 emite"
          />
          <div className="fila">{muestra(css(tema.neutro), "barra")} Menos de 30 extremos en el ajuste: sin clasificar</div>
        </>
      )}
      {tipo === "radios" && (
        <>
          <div className="fila">{muestra(css(tema.estacion))} Estación de la red de referencia</div>
          <div className="fila">{muestra(css(tema.estacion), "anillo")} Radio de {radio} m alrededor de cada estación</div>
        </>
      )}
      {tipo === "barrido" && (
        <>
          <div className="fila">{muestra(css(tema.estacion), "barra")} Estación; altura: extremos/día que aportó al entrar</div>
          <div className="fila">{muestra(css(tema.monumento), "barra")} La última añadida</div>
          <div className="fila">{muestra(css(tema.estacion), "anillo")} Radio de {radio} m</div>
        </>
      )}
      {tipo === "anclajes" && (
        <>
          <div className="fila">{muestra(`rgb(${tema.estacion.join(" ")} / 0.35)`, "barra")} Anclajes (1 anclaje ≈ 44 m de altura)</div>
          <div className="fila">{muestra(css(tema.estacion), "barra")} Stock inicial a las {demo.manifiesto.hora_reposicion}:00</div>
        </>
      )}
      {tipo === "ocupacion" && (
        <>
          <div className="fila">{muestra(css(tema.normal), "barra")} Con patinetes y con huecos</div>
          <div className="fila">{muestra(css(tema.vacia), "barra")} Vacía: no se puede salir</div>
          <div className="fila">{muestra(css(tema.llena), "barra")} Llena: no se puede devolver</div>
          <div className="fila">{muestra(css(tema.estacion), "linea")} Viaje atendido · {muestra("rgb(137 135 129)", "linea")} fuera de cobertura</div>
        </>
      )}
      {tipo === "energia" && (
        <Degradado
          titulo="Energía que llega a la estación (kWh/día)"
          paradas={tema.energia.map((c) => css(c))}
          desde="0"
          hasta={num(max.energia, 2)}
        />
      )}
      {tipo === "flujos" && (
        <div className="fila">
          {muestra(css(tema.flujo), "linea")} Viajes entre dos estaciones: más grueso, más viajes; tenue en la salida, intenso en
          la llegada
        </div>
      )}
      {tipo === "atencion" && (
        <div className="fila">
          {muestra(css(tema.estacion), "linea")} Atendido · {muestra("rgb(137 135 129)", "linea")} fuera de cobertura
        </div>
      )}
    </div>
  );
}

function descripcion(
  info: PickingInfo,
  demo: Demo,
  modoDemanda: Capas["demanda"],
  hora: number,
  tipoDia: TipoDia,
  franja: number,
  tema: Tema,
) {
  const o = info.object as unknown;
  const id = info.layer?.id ?? "";
  if (!o) return null;
  let html = "";
  if (id === "demanda") {
    const c = o as CeldaDemanda;
    const v = valorDemanda(c, demo, modoDemanda, hora, tipoDia);
    html =
      modoDemanda === "hora"
        ? `<b>${num(v, 1)}</b> orígenes + destinos de ${hora} a ${hora + 1} h<br><span>${tipoDia === "laborable" ? "laborable" : "fin de semana"} medio</span>`
        : `<b>${num(v, 1)}</b> orígenes + destinos al día<br><span>${num(c.extremos)} en el ajuste</span>`;
  } else if (id === "saldo") {
    const c = o as CeldaSaldo;
    const v = valorSaldo(c, franja);
    html = c.incluida
      ? `<b>${v > 0 ? "+" : ""}${num(v, 2)}</b> patinetes/día ${v > 0 ? "emite" : "recibe"}${franja >= 0 ? " en la franja" : ""}<br><span>${num(c.extremos)} extremos en el ajuste${c.significativa ? " · desequilibrio significativo" : ""}</span>`
      : `Celda con pocos extremos (${num(c.extremos)}): sin clasificar`;
  } else if (id === "barrido") {
    const b = o as { rango: number; ganancia: number };
    html = `<b>Estación ${b.rango}.ª</b> del barrido<br><span>aportó ${num(b.ganancia, 1)} extremos/día al entrar</span>`;
  } else if (id.startsWith("estaciones")) {
    const s = o as Estacion;
    html = `<b>${s.station_id}</b> · ${num(s.salidas_dia, 1)} salidas y ${num(s.llegadas_dia, 1)} llegadas al día<br><span>${s.anclajes} anclajes · stock ${s.stock_inicial} · ${num(s.energia_kwh_dia * 1000)} Wh/día · pulsa para ver la ficha</span>`;
  } else if (id === "flujos") {
    const p = o as { o: Estacion; d: Estacion; viajes: number };
    html = `<b>${p.o.station_id} → ${p.d.station_id}</b><br><span>${num(p.viajes)} viajes en el ajuste (${num(p.viajes / demo.manifiesto.periodo.dias, 1)} al día)</span>`;
  } else {
    return null;
  }
  const oscuro = tema.nombre === "oscuro";
  return {
    html,
    style: {
      background: oscuro ? "rgba(26,26,25,0.94)" : "rgba(255,255,255,0.96)",
      color: oscuro ? "#f0efec" : "#0b0b0b",
      font: '12.5px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif',
      padding: "8px 10px",
      borderRadius: "8px",
      boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
      maxWidth: "280px",
    },
  };
}

