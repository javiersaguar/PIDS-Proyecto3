import { useSyncExternalStore } from "react";

// Rutas con almohadilla (#/fase0/t11) para que GitHub Pages sirva siempre index.html.
function suscribir(aviso: () => void) {
  window.addEventListener("hashchange", aviso);
  return () => window.removeEventListener("hashchange", aviso);
}

export function useRuta(): string[] {
  const hash = useSyncExternalStore(suscribir, () => window.location.hash);
  return hash.replace(/^#\/?/, "").split("/").filter(Boolean);
}
