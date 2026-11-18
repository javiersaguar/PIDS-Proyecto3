export type Fase = {
  id: string;
  pestana: string;
  titulo: string;
  descripcion: string;
  fechas: string;
  peso?: string;
  estado: "en curso" | "pendiente" | "cerrada";
  tareas: string;
  previsto: string[];
};

export const FASES: Fase[] = [
  {
    id: "fase0",
    pestana: "Fase 0 · Datos",
    titulo: "Datos: limpieza y exploración",
    descripcion:
      "Deja los viajes limpios y fija los parámetros que usan las demás fases. Cada análisis responde a una pregunta y alimenta una decisión: umbrales de limpieza, franjas horarias, tipos de día, rebalanceo y cota de flota.",
    fechas: "18–23/11",
    estado: "en curso",
    tareas: "T10–T19",
    previsto: [],
  },
  {
    id: "fase1",
    pestana: "Fase 1 · Movilidad",
    titulo: "Movilidad y flota",
    descripcion:
      "Matrices origen–destino, redes candidatas de estaciones y la recomendación de cuántas estaciones, dónde, con cuántos anclajes y con qué flota. Muestra cuánto acceso se gana con cada incremento de infraestructura.",
    fechas: "23/11–4/12",
    peso: "60 %",
    estado: "pendiente",
    tareas: "T20–T38",
    previsto: [
      "Matrices origen–destino por celda H3, franja horaria y tipo de día, con mapa de líneas de deseo.",
      "Frente de Pareto entre número de estaciones y demanda cubierta para las redes candidatas.",
      "Mapa de la red elegida con su cobertura y validación con la semana reservada.",
      "Curva de flota frente a nivel de servicio a partir de la simulación de inventario.",
    ],
  },
  {
    id: "fase2",
    pestana: "Fase 2 · Consumo",
    titulo: "Consumo de la flota",
    descripcion:
      "Energía por viaje, por patinete, por estación de destino y de la flota completa. Contrasta los 13,5 Wh/km del enunciado con un modelo físico sencillo y su sensibilidad.",
    fechas: "25/11–2/12",
    peso: "10 %",
    estado: "pendiente",
    tareas: "T40–T46",
    previsto: [
      "Energía diaria de la flota y por patinete con el modelo de referencia.",
      "Comparación del modelo de 13,5 Wh/km con el modelo físico y sensibilidad a velocidad y pendiente.",
      "Energía que llega a cada estación de destino.",
    ],
  },
  {
    id: "fase3",
    pestana: "Fase 3 · Estación",
    titulo: "Estación de recarga",
    descripcion:
      "Curvas de potencia demandada en todas las estaciones y diseño de una estación concreta con paneles fotovoltaicos y baterías, con su balance energético hora a hora.",
    fechas: "30/11–9/12",
    peso: "20 %",
    estado: "pendiente",
    tareas: "T50–T59",
    previsto: [
      "Curvas de demanda cada 15 minutos por estación.",
      "Jornada tipo de la estación elegida: generación solar, consumo, batería y red.",
      "Tabla de diseños alternativos de paneles y batería con su autonomía.",
    ],
  },
  {
    id: "fase4",
    pestana: "Fase 4 · Conclusiones",
    titulo: "Conclusiones",
    descripcion:
      "Respuestas a las preguntas iniciales con cifras, límites del estudio y experimentos integrados de movilidad y recarga.",
    fechas: "9–16/12",
    peso: "10 %",
    estado: "pendiente",
    tareas: "T60–T66",
    previsto: [
      "Resumen de la red recomendada: estaciones, anclajes, patinetes, cobertura y energía.",
      "Indisponibilidad de una estación y derivación de viajes.",
      "Qué puede cambiar por falta de trayectorias, un único mes de datos o el cambio de comportamiento con estaciones.",
    ],
  },
];
