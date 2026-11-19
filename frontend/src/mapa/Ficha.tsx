// Ficha de una estación: por qué está ahí, cuánto se usa, qué capacidad pide y cuánta energía recibe.
import { num, pc } from "../formato";
import type { TipoDia } from "./capitulos";
import { referenciaCercana, type Demo, type Estacion, type Red } from "./datos";
import { PerfilHorario } from "./Graficas";

export function Ficha({
  demo,
  red,
  estacion: s,
  hora,
  tipoDia,
  alCerrar,
}: {
  demo: Demo;
  red: Red;
  estacion: Estacion;
  hora?: number;
  tipoDia: TipoDia;
  alCerrar: () => void;
}) {
  const dias = demo.manifiesto.periodo.dias;
  const ref = referenciaCercana(demo.base.etiquetas, [s.lon, s.lat]);
  const perfil = red.perfiles.get(s.station_id)!;
  const diasTipo = demo.demanda.dias[tipoDia];
  const fds = tipoDia === "fin_de_semana";
  const salidas = (fds ? perfil.salidas_fds : perfil.salidas).map((v) => v / diasTipo);
  const llegadas = (fds ? perfil.llegadas_fds : perfil.llegadas).map((v) => v / diasTipo);
  const energia = perfil.energia_wh.map((v) => v / dias);
  const saldo = s.saldo_dia;
  const bateria = demo.manifiesto.cifras.bateria_wh;
  return (
    <aside className="ficha" aria-label={`Ficha de la estación ${s.station_id}`}>
      <header>
        <div>
          <div className="ficha-id">Estación {s.station_id}</div>
          <div className="ficha-lugar">
            a {num(Math.round(ref.metros / 10) * 10)} m de {ref.nombre}
          </div>
        </div>
        <button type="button" className="boton-icono" onClick={alCerrar} aria-label="Cerrar ficha">
          ×
        </button>
      </header>
      <p className="ficha-porque">
        Entró en el puesto <b>{s.rango}</b> de {red.resumen.estaciones} del barrido con {red.resumen.radio_m} m: cubría{" "}
        <b>{num(s.ganancia_extremos / dias, 1)} orígenes o destinos al día</b> que aún no tenían estación cerca.
      </p>
      <dl className="ficha-datos">
        <div>
          <dt>Salidas / llegadas al día</dt>
          <dd>
            {num(s.salidas_dia, 1)} / {num(s.llegadas_dia, 1)}
          </dd>
        </div>
        <div>
          <dt>Saldo al día</dt>
          <dd>
            {saldo > 0 ? "+" : ""}
            {num(saldo, 2)} <small>{saldo > 0 ? "se vacía" : saldo < 0 ? "se llena" : "equilibrada"}</small>
          </dd>
        </div>
        <div>
          <dt>Stock inicial · anclajes</dt>
          <dd>
            {s.stock_inicial} · {s.anclajes}
          </dd>
        </div>
        <div>
          <dt>Salidas por anclaje y día</dt>
          <dd>{num(s.rotacion_dia, 2)}</dd>
        </div>
        <div>
          <dt>Energía a reponer</dt>
          <dd>
            {num(s.energia_kwh_dia * 1000)} Wh/día <small>{pc((100 * s.energia_kwh_dia * 1000) / bateria, 0)} de una batería</small>
          </dd>
        </div>
      </dl>
      <PerfilHorario
        titulo={`Salidas y llegadas por hora · ${fds ? "fin de semana" : "laborable"} medio`}
        unidad="al día"
        horaActual={hora}
        series={[
          { nombre: "Salidas", clase: "serie-1", valores: salidas },
          { nombre: "Llegadas", clase: "serie-2", valores: llegadas },
        ]}
      />
      <PerfilHorario
        titulo="Energía que llega por hora · media diaria"
        unidad="Wh"
        barras
        decimales={0}
        horaActual={hora}
        series={[{ nombre: "Energía", clase: "serie-energia", valores: energia }]}
      />
    </aside>
  );
}
