import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado, TablaDesplegable } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";
import { ESCALA_AZUL } from "../../graficas";

type Nivel = "municipio" | "zona_urbanistica";
type Periodo = "mes" | "ajuste" | "reservada";
type Zona = { codigo: string; nombre: string; etiqueta: string };
type Par = { nombre_origen: string; nombre_destino: string; viajes: number };
type MatrizPeriodo = {
  resumen: {
    viajes: number;
    asignados: number;
    sin_asignar: number;
    pct_intrazonales: number | null;
    pct_intrazonales_h3: number | null;
  };
  matriz: number[][];
  viajes_visibles: number;
  pares: Par[];
};
type DatosT21 = Record<Nivel, { zonas: Zona[]; periodos: Record<Periodo, MatrizPeriodo> }>;

export function T21() {
  const { datos, error } = useDatos<DatosT21>("fase1/t21_od_administrativas");
  return (
    <Seccion
      id="t21"
      tarea="T21"
      responsable="Javier Saguar"
      titulo="Matrices origen–destino por zonas administrativas"
      notebook="movilidad/T21_matrices_od_administrativas.ipynb"
      objetivo="Contar los viajes entre los municipios y las zonas urbanísticas de Roma con los límites subcomunales de Istat de 2021."
      valor="Permite comparar el intercambio a escala de municipio con los desplazamientos entre zonas urbanísticas e identificar cuánto cambia la proporción de viajes intrazonales al cambiar de división."
    >
      {datos ? <MatrizAdministrativa datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

const porcentaje = (valor: number | null) => valor === null ? "—" : pc(valor);

function MatrizAdministrativa({ datos }: { datos: DatosT21 }) {
  const [nivel, setNivel] = useState<Nivel>("municipio");
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [diagonal, setDiagonal] = useState<"con" | "sin">("con");
  const { zonas, periodos } = datos[nivel];
  const { resumen, matriz, viajes_visibles, pares } = periodos[periodo];
  const etiquetas = zonas.map((zona) => zona.etiqueta);
  const traza = {
    type: "heatmap",
    x: etiquetas,
    y: etiquetas,
    z: matriz.map((fila, o) => fila.map((viajes, d) => diagonal === "sin" && o === d ? null : viajes)),
    customdata: zonas.map((origen) => zonas.map((destino) => [origen.nombre, destino.nombre])),
    colorscale: ESCALA_AZUL,
    zmin: 0,
    xgap: 1,
    ygap: 1,
    colorbar: { title: { text: "Viajes" }, thickness: 12, outlinewidth: 0 },
    hovertemplate: "%{customdata[0]} → %{customdata[1]}<br>%{z} viajes<extra></extra>",
  } as unknown as Data;

  return (
    <Bloque
      titulo="Viajes entre zonas de Roma"
      queMuestra="La matriz de los 15 municipios o de las 20 zonas urbanísticas con más extremos en el ajuste. Los indicadores abarcan toda la división territorial seleccionada."
      porQue="Un cambio en los límites o en la escala agrupa viajes distintos dentro de la diagonal."
      comoLeer="Cada fila es un origen y cada columna es un destino. Pasa el cursor por una celda para ver los nombres completos y el número de viajes."
      conclusiones={[
        `La selección del gráfico reúne ${num(viajes_visibles)} de ${num(resumen.asignados)} viajes con ambos extremos asignados, incluida la diagonal.`,
        `La categoría sin asignar conserva ${num(resumen.sin_asignar)} viajes con al menos un extremo sin código. Está disponible en los CSV completos.`,
      ]}
      fuente="Istat, áreas subcomunales 2021 (CC BY 4.0) · tablas/movilidad/T21_resumen.csv"
    >
      <div className="controles">
        <Segmentado etiqueta="División" valor={nivel} cambiar={setNivel} opciones={[
          { valor: "municipio", texto: "Municipios" },
          { valor: "zona_urbanistica", texto: "Zonas urbanísticas" },
        ]} />
        <Segmentado etiqueta="Periodo" valor={periodo} cambiar={setPeriodo} opciones={[
          { valor: "mes", texto: "Mes completo" },
          { valor: "ajuste", texto: "Ajuste" },
          { valor: "reservada", texto: "Semana reservada" },
        ]} />
        <Segmentado etiqueta="Diagonal" valor={diagonal} cambiar={setDiagonal} opciones={[
          { valor: "con", texto: "Con diagonal" },
          { valor: "sin", texto: "Sin diagonal" },
        ]} />
      </div>
      <Cifras cifras={[
        { valor: num(resumen.viajes), nombre: "viajes elegibles" },
        { valor: num(resumen.asignados), nombre: "ambos extremos asignados" },
        { valor: porcentaje(resumen.pct_intrazonales), nombre: "intrazonales en esta división" },
        { valor: porcentaje(resumen.pct_intrazonales_h3), nombre: "intrazonales en H3", detalle: "Misma muestra" },
      ]} />
      <Grafica descripcion="Mapa de calor origen–destino de las zonas seleccionadas" trazas={[traza]} alto={470} capa={{
        margin: { t: 8 },
        xaxis: { title: { text: "Zona de destino" }, type: "category", tickangle: -90, showgrid: false },
        yaxis: { title: { text: "Zona de origen" }, type: "category", autorange: "reversed", showgrid: false },
      }} />
      <TablaDesplegable
        titulo="Ver los principales pares entre zonas distintas"
        cabeceras={["Origen", "Destino", "Viajes"]}
        numericas={[2]}
        filas={pares.map((par) => [par.nombre_origen, par.nombre_destino, num(par.viajes)])}
      />
    </Bloque>
  );
}
