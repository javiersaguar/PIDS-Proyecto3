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
