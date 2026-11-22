import { useState } from "react";
import type { Data } from "plotly.js-dist-min";
import { Bloque } from "../../componentes/Bloque";
import { Cifras } from "../../componentes/Cifras";
import { Cargando, Segmentado } from "../../componentes/Controles";
import { Grafica } from "../../componentes/Grafica";
import { Seccion } from "../../componentes/Seccion";
import { useDatos } from "../../datos";
import { num, pc } from "../../formato";

type Periodo = "mes" | "ajuste" | "reservada";
type Totales = {
  periodo: Periodo;
  importe_elegible_eur: number;
  importe_elegible_dia_eur: number;
  pct_importe_excluido: number;
  precios_fuera_tolerancia: number;
};
type Dia = {
  fecha: string;
  periodo: Exclude<Periodo, "mes">;
  importe_desbloqueo_eur: number;
  importe_tiempo_eur: number;
};
type Datos = {
  tarifa: { desbloqueo_eur: number; minuto_eur: number };
  resumen: Totales[];
  diario: Dia[];
  inicio_reservada: string;
};

export function T18() {
  const { datos, error } = useDatos<Datos>("fase0/t18_tarifa");
  return (
    <Seccion id="t18" tarea="T18" responsable="Javier Saguar" titulo="Tarifa e importe de los viajes"
      notebook="exploracion/T18_tarifa_ingresos.ipynb"
      objetivo="Comprobar la tarifa por desbloqueo y tiempo. Calcular el importe nominal de los viajes elegibles."
      valor="Mide cuánto cambia la referencia económica al excluir registros con incidencias.">
      {datos ? <Importes datos={datos} /> : <Cargando error={error} />}
    </Seccion>
  );
}

function Importes({ datos }: { datos: Datos }) {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const resumen = datos.resumen.find((r) => r.periodo === periodo);
  const dias = datos.diario.filter((d) => periodo === "mes" || d.periodo === periodo);
  if (!resumen) return <Cargando error="El periodo seleccionado no está disponible." />;

  const traza = (nombre: string, color: string, clave: "importe_desbloqueo_eur" | "importe_tiempo_eur"): Data => ({
    type: "bar", name: nombre, x: dias.map((d) => d.fecha), y: dias.map((d) => d[clave]),
    marker: { color }, hovertemplate: "%{x|%d/%m}<br>%{y:.2f} €<extra>%{fullData.name}</extra>",
  });
  const { desbloqueo_eur: fijo, minuto_eur: minuto } = datos.tarifa;
  return (
    <Bloque titulo="Importe diario por componente"
      queMuestra={`La tarifa de ${num(fijo, 2)} € por desbloqueo y ${num(minuto, 2)} € por minuto, aplicada a los viajes elegibles.`}
      porQue="Las duraciones anómalas concentran parte del importe bruto del fichero."
      comoLeer="Cada barra suma desbloqueo y tiempo para las salidas de un día. Las cifras proceden de los precios registrados."
      conclusiones={[`${num(resumen.precios_fuera_tolerancia)} precios superan la tolerancia de la comprobación en el periodo seleccionado.`]}
      fuente="tablas/exploracion/T18_resumen.csv y T18_ingresos_diarios.csv">
      <div className="controles">
        <Segmentado etiqueta="Periodo del importe" valor={periodo} cambiar={setPeriodo} opciones={[
          { valor: "mes", texto: "Mes completo" }, { valor: "ajuste", texto: "Ajuste" },
          { valor: "reservada", texto: "Semana reservada" },
        ]} />
      </div>
      <Cifras cifras={[
        { valor: `${num(resumen.importe_elegible_eur, 2)} €`, nombre: "importe nominal elegible" },
        { valor: `${num(resumen.importe_elegible_dia_eur, 2)} €`, nombre: "importe nominal diario" },
        { valor: pc(resumen.pct_importe_excluido), nombre: "del importe bruto en registros excluidos" },
      ]} />
      <Grafica descripcion="Desbloqueo y tiempo de los viajes elegibles, por fecha"
        trazas={[traza("Desbloqueo", "#286db0", "importe_desbloqueo_eur"), traza("Tiempo", "#1b9189", "importe_tiempo_eur")]}
        capa={{
          barmode: "stack", xaxis: { type: "date", tickformat: "%d/%m", showgrid: false },
          yaxis: { title: { text: "Importe nominal (€)" }, rangemode: "tozero" },
          shapes: periodo === "mes" ? [{
            type: "line", xref: "x", yref: "paper",
            x0: `${datos.inicio_reservada}T00:00:00`, x1: `${datos.inicio_reservada}T00:00:00`,
            y0: 0, y1: 1, line: { dash: "dot", color: "#716657", width: 1 },
          }] : [],
        }} />
    </Bloque>
  );
}
