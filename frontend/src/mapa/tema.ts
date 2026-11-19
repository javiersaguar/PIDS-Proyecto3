// Paleta del mapa en tema oscuro y claro. Los colores de datos son los de la web
// (azul, naranja, aqua y amarillo de la paleta categórica, y los de estado), cada uno
// con un solo papel:
//   azul      → demanda (rampa secuencial) y receptoras en el saldo (polo frío)
//   rojo      → emisoras en el saldo (polo cálido); gris neutro en el centro
//   naranja   → estaciones propuestas y viajes que atenderían
//   amarillo  → energía (rampa secuencial)
//   aqua      → flujos entre estaciones
//   estado    → vacía (crítico), llena (aviso) y con patinetes y huecos (bien)
export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export type Tema = {
  nombre: "oscuro" | "claro";
  fondo: string;
  calles: RGBA;
  secundarias: RGBA;
  principales: RGBA;
  viasRapidas: RGBA;
  tren: RGBA;
  murallas: RGBA;
  rio: RGBA;
  agua: RGBA;
  verde: RGBA;
  monumento: RGBA;
  barrio: RGBA;
  halo: RGBA;
  demanda: RGB[];
  receptora: RGB[];
  emisora: RGB[];
  neutro: RGB;
  estacion: RGB;
  estacionClara: RGB;
  noAtendido: RGBA;
  energia: RGB[];
  flujo: RGB;
  vacia: RGB;
  llena: RGB;
  normal: RGB;
  hueco: RGBA;
  luz: number;
};

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export const TEMAS: Record<Tema["nombre"], Tema> = {
  oscuro: {
    nombre: "oscuro",
    fondo: "#111110",
    calles: [255, 255, 255, 16],
    secundarias: [255, 255, 255, 34],
    principales: [255, 255, 255, 52],
    viasRapidas: [255, 255, 255, 66],
    tren: [144, 133, 233, 46],
    murallas: [201, 166, 107, 150],
    rio: [57, 135, 229, 190],
    agua: [57, 135, 229, 70],
    verde: [12, 163, 12, 20],
    monumento: [240, 239, 236, 230],
    barrio: [195, 194, 183, 150],
    halo: [17, 17, 16, 255],
    demanda: ["#104281", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"].map(hex),
    receptora: ["#383835", "#256abf", "#3987e5", "#86b6ef"].map(hex),
    emisora: ["#383835", "#a8413f", "#e66767", "#f2a3a3"].map(hex),
    neutro: hex("#383835"),
    estacion: hex("#eb6834"),
    estacionClara: hex("#f4a27e"),
    noAtendido: [137, 135, 129, 110],
    energia: ["#5c4300", "#c98500", "#eda100", "#fab219", "#ffe08a"].map(hex),
    flujo: hex("#1baf7a"),
    vacia: hex("#d03b3b"),
    llena: hex("#fab219"),
    normal: hex("#0ca30c"),
    hueco: [240, 239, 236, 26],
    luz: 1.0,
  },
  claro: {
    nombre: "claro",
    fondo: "#f6f5f1",
    calles: [11, 11, 11, 20],
    secundarias: [11, 11, 11, 40],
    principales: [11, 11, 11, 66],
    viasRapidas: [11, 11, 11, 84],
    tren: [98, 80, 214, 46],
    murallas: [150, 108, 46, 170],
    rio: [42, 120, 214, 170],
    agua: [42, 120, 214, 60],
    verde: [0, 131, 0, 30],
    monumento: [11, 11, 11, 230],
    barrio: [82, 81, 78, 170],
    halo: [246, 245, 241, 255],
    demanda: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#0d366b"].map(hex),
    receptora: ["#d9d8d3", "#9ec5f4", "#3987e5", "#184f95"].map(hex),
    emisora: ["#d9d8d3", "#f2a3a3", "#e34948", "#9c2b2a"].map(hex),
    neutro: hex("#d9d8d3"),
    estacion: hex("#eb6834"),
    estacionClara: hex("#b8471c"),
    noAtendido: [82, 81, 78, 90],
    energia: ["#fde7b0", "#f7c95a", "#eda100", "#c98500", "#8a5b00"].map(hex),
    flujo: hex("#148a60"),
    vacia: hex("#d03b3b"),
    llena: hex("#eda100"),
    normal: hex("#0ca30c"),
    hueco: [11, 11, 11, 22],
    luz: 1.15,
  },
};

// Color de una rampa en t ∈ [0, 1] (interpolación lineal entre paradas).
export function rampa(paradas: RGB[], t: number, alfa = 255): RGBA {
  const x = Math.min(1, Math.max(0, t)) * (paradas.length - 1);
  const i = Math.min(paradas.length - 2, Math.floor(x));
  const f = x - i;
  const a = paradas[i];
  const b = paradas[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, alfa];
}

export const conAlfa = (c: RGB | RGBA, alfa: number): RGBA => [c[0], c[1], c[2], alfa];

export const css = (c: RGB | RGBA): string => `rgb(${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])})`;
