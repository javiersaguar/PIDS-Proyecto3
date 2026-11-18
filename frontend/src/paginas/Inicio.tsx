import { Cifras } from "../componentes/Cifras";
import { FASES } from "../fases";

export function Inicio() {
  return (
    <>
      <div className="migas">PIDS · Proyecto 3</div>
      <div className="encabezado">
        <div>
          <h1>Estaciones de recarga para patinetes compartidos en Roma</h1>
          <div className="detalles">
            <span className="chapa">Javier Saguar (líder)</span>
            <span className="chapa">Alejandro Cuevas</span>
          </div>
        </div>
        <div>
          <p>
            Estudiamos cómo cambiaría el servicio si los viajes observados con Helbiz en Roma tuvieran que empezar y
            terminar en estaciones fijas de recarga. Con los orígenes, destinos y horas de febrero de 2021 como
            demanda de referencia, proponemos una red de estaciones, estimamos el consumo de la flota y diseñamos una
            estación con paneles fotovoltaicos y baterías.
          </p>
          <p>
            Cada gráfica de esta web se dibuja con los datos que exportan los notebooks del repositorio, así que
            enseña exactamente las mismas cifras que las tablas de la memoria.
          </p>
        </div>
      </div>

      <section className="seccion">
        <Cifras
          cifras={[
            { valor: "25 186", nombre: "viajes en el CSV original", detalle: "1–28 de febrero de 2021" },
            { valor: "2 331", nombre: "patinetes distintos", detalle: "identificador idS" },
            { valor: "1–21/02", nombre: "periodo de ajuste", detalle: "fija parámetros y candidatos" },
            { valor: "22–28/02", nombre: "semana reservada", detalle: "solo para validar" },
          ]}
        />
        <div className="tarjetas">
          {FASES.map((f) => (
            <a key={f.id} className="tarjeta" href={`#/${f.id}`}>
              <div className="arriba">
                <span>
                  {f.pestana.split(" · ")[0]} · {f.fechas}
                </span>
                <span className={`chapa${f.estado === "en curso" ? " activa" : ""}`}>{f.estado}</span>
              </div>
              <h3>
                {f.titulo}
                {f.peso && <span style={{ color: "var(--tenue)", fontWeight: 400 }}> · {f.peso}</span>}
              </h3>
              <p>{f.descripcion}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
