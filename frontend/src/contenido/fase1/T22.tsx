import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { ESCALA_AZUL } from "../../graficas";

type Nivel = "h3" | "municipio" | "zona_urbanistica";
type Periodo = "mes" | "ajuste" | "reservada";
type Tipo = "laborable" | "fin_de_semana";
type Zona = { etiqueta: string; nombre: string };
type Segmento = {
  periodo: Periodo;
  tipo_dia: Tipo;
  franja: string;
  horas: string;
  dias: number;
  viajes: number;
  viajes_dia: number;
  cuota_pct: number;
};
type Datos = {
  franjas: string[];
  segmentos: Segmento[];
  niveles: Record<Nivel, { zonas: Zona[]; cortes: Record<Periodo, Record<Tipo, Record<string, number[][]>>> }>;
};

export function T22() {
  const { datos, error } = useDatos<Datos>("fase1/t22_od_temporal");
  return (
    <Seccion id="t22" tarea="T22" responsable="Javier Saguar" titulo="Matrices por franja horaria y tipo de día"
      notebook="movilidad/T22_matrices_od_temporales.ipynb"
      objetivo="Segmentar los viajes por su hora local de salida y distinguir laborables de fines de semana."
      valor="Permite comparar distribuciones espaciales y medir la demanda diaria que alimentará el simulador.">
      {datos ? <MatrizTemporal datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function MatrizTemporal({ datos }: { datos: Datos }) {
  const [nivel, setNivel] = useState<Nivel>("h3");
  const [periodo, setPeriodo] = useState<Periodo>("ajuste");
  const [tipo, setTipo] = useState<Tipo>("laborable");
  const [franja, setFranja] = useState(datos.franjas.includes("punta_tarde") ? "punta_tarde" : datos.franjas[0]);
  const resumenes = datos.segmentos.filter((s) => s.periodo === periodo && s.tipo_dia === tipo);
  const resumen = resumenes.find((s) => s.franja === franja);
  const { zonas, cortes } = datos.niveles[nivel];
  const matriz = cortes[periodo][tipo][franja];
  if (!resumen || !matriz) return <Cargando error="Este corte temporal no está disponible." />;
  const ejes = zonas.map((zona) => zona.etiqueta);
  const visibles = matriz.flat().reduce((a, b) => a + b, 0);
  const traza = {
    type: "heatmap", x: ejes, y: ejes, z: matriz,
    customdata: zonas.map((o) => zonas.map((d) => [o.nombre, d.nombre])),
    colorscale: ESCALA_AZUL, zmin: 0, xgap: 1, ygap: 1,
    colorbar: { title: { text: "Viajes" }, thickness: 12, outlinewidth: 0 },
    hovertemplate: "%{customdata[0]} → %{customdata[1]}<br>%{z} viajes<extra></extra>",
  } as unknown as Data;
  return (
    <Bloque titulo="Demanda origen–destino por corte temporal"
      queMuestra="Los 15 municipios o las 20 celdas o zonas con más extremos del ajuste."
      porQue="La media por día permite comparar periodos con distinto número de laborables y fines de semana."
      comoLeer="Las filas son orígenes y las columnas son destinos. Las zonas del mapa de calor mantienen su orden al cambiar de corte."
      conclusiones={[`El gráfico reúne ${num(visibles)} de los ${num(resumen.viajes)} viajes de la franja. La matriz completa está en el CSV.`]}
      fuente="tablas/movilidad/T22_matrices.csv y T22_segmentos.csv">
      <div className="controles">
        <Segmentado etiqueta="División" valor={nivel} cambiar={setNivel} opciones={[
          { valor: "h3", texto: "H3" }, { valor: "municipio", texto: "Municipios" },
          { valor: "zona_urbanistica", texto: "Zonas urbanísticas" },
        ]} />
        <Segmentado etiqueta="Periodo" valor={periodo} cambiar={setPeriodo} opciones={[
          { valor: "ajuste", texto: "Ajuste" }, { valor: "reservada", texto: "Semana reservada" },
          { valor: "mes", texto: "Mes completo" },
        ]} />
        <Segmentado etiqueta="Tipo de día" valor={tipo} cambiar={setTipo} opciones={[
          { valor: "laborable", texto: "Laborables" }, { valor: "fin_de_semana", texto: "Fin de semana" },
        ]} />
        <Segmentado etiqueta="Hora local de salida" valor={franja} cambiar={setFranja}
          opciones={resumenes.map((s) => ({ valor: s.franja, texto: `${s.horas} h` }))} />
      </div>
      <Cifras cifras={[
        { valor: num(resumen.viajes), nombre: "viajes en la franja" },
        { valor: num(resumen.viajes_dia, 1), nombre: "viajes por día", detalle: `${num(resumen.dias)} días` },
        { valor: pc(resumen.cuota_pct), nombre: "de las salidas del mismo tipo de día" },
      ]} />
      <Grafica descripcion="Matriz origen–destino de la franja seleccionada" trazas={[traza]} alto={455} capa={{
        margin: { t: 8 },
        xaxis: { type: "category", title: { text: "Destino" }, tickangle: -90, showgrid: false },
        yaxis: { type: "category", title: { text: "Origen" }, autorange: "reversed", showgrid: false },
      }} />
    </Bloque>
  );
}
