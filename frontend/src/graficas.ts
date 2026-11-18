import type { Config, Data, Layout } from "plotly.js-dist-min";

// Paleta categórica (validada para daltonismo en el orden azul, naranja, verde) y tintas.
export const COLOR = {
  serie1: "#2a78d6",
  serie2: "#eb6834",
  serie3: "#1baf7a",
  texto: "#233342",
  tenue: "#526576",
  rejilla: "#e8edf2",
  eje: "#c5ced8",
  zonaExcluida: "rgba(122, 138, 153, 0.13)",
  franja: "rgba(122, 138, 153, 0.08)",
};

// Rampa secuencial de un solo tono (azul) para los mapas de calor.
export const ESCALA_AZUL: [number, string][] = [
  [0, "#f4f8fd"],
  [0.15, "#cde2fb"],
  [0.35, "#86b6ef"],
  [0.55, "#3987e5"],
  [0.75, "#256abf"],
  [1, "#0d366b"],
];

const FUENTE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const EJE = {
  gridcolor: COLOR.rejilla,
  linecolor: COLOR.eje,
  tickcolor: COLOR.eje,
  ticks: "outside",
  ticklen: 4,
  zeroline: false,
  automargin: true,
  title: { font: { size: 12, color: COLOR.tenue } },
  tickfont: { size: 11, color: COLOR.tenue },
};

type Capa = Partial<Layout>;
type Objeto = Record<string, unknown>;

// Mezcla la capa común con la de cada gráfica (ejes, márgenes y leyenda se combinan).
export function capa(propia: Capa = {}): Capa {
  const p = propia as Objeto;
  const base: Objeto = {
    font: { family: FUENTE, size: 12, color: COLOR.texto },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    separators: ", ",
    hoverlabel: { bgcolor: "#ffffff", bordercolor: COLOR.eje, font: { family: FUENTE, color: COLOR.texto, size: 12 } },
    barcornerradius: 3,
  };
  const resultado: Objeto = { ...base, ...p };
  for (const clave of new Set(["xaxis", "yaxis", ...Object.keys(p).filter((k) => /^[xy]axis\d+$/.test(k))])) {
    const propio = (p[clave] ?? {}) as Objeto;
    resultado[clave] = { ...EJE, ...propio, title: { ...EJE.title, ...((propio.title as Objeto) ?? {}) } };
  }
  resultado.margin = { l: 8, r: 12, t: 12, b: 8, ...((p.margin as Objeto) ?? {}) };
  resultado.legend = { orientation: "h", x: 0, y: 1.02, yanchor: "bottom", font: { size: 12 }, ...((p.legend as Objeto) ?? {}) };
  return resultado as Capa;
}

const ES = {
  dictionary: {
    Zoom: "Zoom",
    Pan: "Desplazar",
    "Zoom in": "Acercar",
    "Zoom out": "Alejar",
    "Reset axes": "Restablecer ejes",
    "Reset view": "Restablecer vista",
    "Download plot as a PNG": "Descargar como PNG",
    "Download plot as a png": "Descargar como PNG",
    "Double-click to zoom back out": "Doble clic para volver a la vista completa",
  },
  format: {
    days: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    shortDays: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    months: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
    shortMonths: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
    date: "%d/%m/%Y",
    decimal: ",",
    thousands: " ",
  },
};

export const CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d", "toggleSpikelines", "hoverClosestCartesian", "hoverCompareCartesian"],
  locales: { es: ES },
  locale: "es",
  toImageButtonOptions: { format: "png", scale: 2 },
} as unknown as Partial<Config>;

export function rgba(hex: string, alfa: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

// Histograma ya calculado en Python (bordes y cuentas) dibujado como escalón relleno.
// Funciona igual en ejes lineales y logarítmicos; customdata guarda el intervalo de cada barra.
export function trazaEscalon(o: {
  bordes: number[];
  cuentas: number[];
  nombre: string;
  color: string;
  plantilla: string;
  relleno?: number;
}): Data {
  const { bordes, cuentas, nombre, color, plantilla, relleno = 0.35 } = o;
  return {
    type: "scatter",
    mode: "lines",
    name: nombre,
    x: bordes,
    y: [...cuentas, cuentas[cuentas.length - 1]],
    customdata: bordes.map((b, i) => [b, bordes[Math.min(i + 1, bordes.length - 1)]]),
    line: { shape: "hv", color, width: 2 },
    fill: "tozeroy",
    fillcolor: rgba(color, relleno),
    hovertemplate: plantilla,
  } as Data;
}

// Umbral: línea vertical discontinua hasta `alto` y su etiqueta encima. Se dibujan como trazas
// (no como formas) para que usen coordenadas de datos también en ejes logarítmicos.
export function trazasUmbral(x: number, alto: number, texto: string, lado: "left" | "right" = "right"): Data[] {
  return [
    {
      type: "scatter",
      mode: "lines",
      x: [x, x],
      y: [0, alto],
      line: { color: COLOR.texto, width: 1.3, dash: "dash" },
      hoverinfo: "skip",
      showlegend: false,
    },
    {
      type: "scatter",
      mode: "text",
      x: [x],
      y: [alto],
      text: [texto],
      textposition: `top ${lado}`,
      textfont: { size: 11, color: COLOR.texto },
      hoverinfo: "skip",
      showlegend: false,
      cliponaxis: false,
    },
  ] as Data[];
}

// Zona sombreada entre x0 y x1 (por ejemplo, los viajes que deja fuera un umbral).
export function trazaZona(x0: number, x1: number, alto: number): Data {
  return {
    type: "scatter",
    mode: "none",
    x: [x0, x0, x1, x1, x0],
    y: [0, alto, alto, 0, 0],
    fill: "toself",
    fillcolor: COLOR.zonaExcluida,
    hoverinfo: "skip",
    showlegend: false,
  } as Data;
}

// Etiqueta de texto suelta en coordenadas de datos.
export function trazaTexto(x: number | string, y: number, texto: string, posicion = "top center"): Data {
  return {
    type: "scatter",
    mode: "text",
    x: [x],
    y: [y],
    text: [texto],
    textposition: posicion,
    textfont: { size: 12, color: COLOR.texto },
    hoverinfo: "skip",
    showlegend: false,
    cliponaxis: false,
  } as Data;
}

// Escala divergente para saldos: azul (negativo), gris neutro en 0 y rojo (positivo).
export const ESCALA_DIVERGENTE: [number, string][] = [
  [0, "#1c5cab"],
  [0.25, "#86b6ef"],
  [0.5, "#f0efec"],
  [0.75, "#f0a09a"],
  [1, "#c23b3a"],
];

// Celda H3 con su contorno exportado por el notebook ([lon, lat] de cada vértice).
export type Celda = { h3: string; contorno: [number, number][] };

function geojsonCeldas(celdas: Celda[]) {
  return {
    type: "FeatureCollection",
    features: celdas.map((c) => ({
      type: "Feature",
      id: c.h3,
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...c.contorno, c.contorno[0]]] },
    })),
  };
}

// Celdas H3 coloreadas por un valor sobre el mapa base.
export function trazaCeldas(o: {
  celdas: Celda[];
  z: number[];
  escala: [number, string][];
  zmin: number;
  zmax: number;
  plantilla: string;
  customdata?: unknown[];
  titulo?: string;
  nombre?: string;
  opacidad?: number;
  conEscala?: boolean;
  enLeyenda?: boolean;
}): Data {
  return {
    type: "choroplethmap",
    geojson: geojsonCeldas(o.celdas),
    featureidkey: "id",
    locations: o.celdas.map((c) => c.h3),
    z: o.z,
    zmin: o.zmin,
    zmax: o.zmax,
    colorscale: o.escala,
    customdata: o.customdata,
    marker: { opacity: o.opacidad ?? 0.82, line: { color: "#ffffff", width: 0.8 } },
    showscale: o.conEscala ?? true,
    showlegend: o.enLeyenda ?? false,
    colorbar: {
      title: { text: o.titulo ?? "", side: "right", font: { size: 12, color: COLOR.tenue } },
      thickness: 12,
      len: 0.8,
      outlinewidth: 0,
      tickfont: { size: 11, color: COLOR.tenue },
    },
    name: o.nombre,
    hovertemplate: o.plantilla,
  } as unknown as Data;
}

// Celdas de un solo color (para categorías: con leyenda y sin escala).
export function trazaCeldasColor(celdas: Celda[], color: string, nombre: string, plantilla: string, customdata?: unknown[]): Data {
  return trazaCeldas({
    celdas,
    z: celdas.map(() => 1),
    escala: [
      [0, color],
      [1, color],
    ],
    zmin: 0,
    zmax: 1,
    plantilla,
    customdata,
    nombre,
    conEscala: false,
    enLeyenda: true,
  });
}

// Lugares de referencia (Termini, Coliseo, San Pedro) para orientarse en los mapas.
export function trazaReferencias(ref: Record<string, [number, number]>): Data {
  const nombres = Object.keys(ref);
  return {
    type: "scattermap",
    mode: "markers+text",
    lat: nombres.map((n) => ref[n][0]),
    lon: nombres.map((n) => ref[n][1]),
    text: nombres,
    textposition: "top center",
    textfont: { size: 12, color: COLOR.texto },
    marker: { size: 7, color: COLOR.texto },
    hovertemplate: "%{text}<extra></extra>",
    showlegend: false,
  } as Data;
}

export const REFERENCIAS_ROMA: Record<string, [number, number]> = {
  Termini: [41.9009, 12.5019],
  Coliseo: [41.8903, 12.4922],
  "San Pedro": [41.9022, 12.4536],
};

// Encuadre por defecto: todas las celdas con demanda (41,81–41,96 N y 12,43–12,54 E).
export function capaMapa(zoom = 10.6, lat = 41.884): Partial<Layout> {
  return {
    margin: { l: 0, r: 0, t: 0, b: 0 },
    legend: { x: 0.01, y: 0.99, yanchor: "top", bgcolor: "rgba(255,255,255,0.85)" },
    map: { style: "carto-positron", center: { lat, lon: 12.484 }, zoom },
  } as Partial<Layout>;
}
