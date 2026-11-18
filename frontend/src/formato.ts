// Números con coma decimal y espacio fino para los miles, como en la memoria.
export function num(x: number, decimales = 0): string {
  const [entero, fraccion] = Math.abs(x).toFixed(decimales).split(".");
  const conMiles = entero.length > 4 ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : entero;
  return (x < 0 ? "−" : "") + conMiles + (fraccion ? "," + fraccion : "");
}

export function pc(x: number, decimales = 1): string {
  return `${num(x, decimales)} %`;
}

export function fecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Franjas horarias fijadas en T12.
export const FRANJAS: Record<string, string> = {
  madrugada: "Madrugada (0–7 h)",
  punta_manana: "Punta de mañana (7–10 h)",
  mediodia: "Mediodía (10–16 h)",
  punta_tarde: "Punta de tarde (16–20 h)",
  noche: "Noche (20–24 h)",
};

export const TIPO_DIA: Record<string, string> = {
  laborable: "Laborable",
  fin_de_semana: "Fin de semana",
};

// Indicadores exportados como lista {indicador, valor} → objeto.
export function indicadores(filas: { indicador: string; valor: number | string }[]): Record<string, number> {
  return Object.fromEntries(filas.map((f) => [f.indicador, Number(f.valor)]));
}

// Nombre de la franja en dos líneas, para los ejes de las gráficas.
export const franjaEje = (f: string) => FRANJAS[f].replace(" (", "<br>(");
