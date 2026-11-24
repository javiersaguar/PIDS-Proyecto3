import { Cifras } from "../componentes/Cifras";
import { FASES } from "../fases";
import { BLOQUES, estadoDe, hechas, TODAS, tareasDe, type EstadoTarea } from "../tareas";

const LISTA = "https://github.com/javiersaguar/PIDS-Proyecto3/blob/main/docs/TAREAS.md";
const CLASE: Record<EstadoTarea, string> = {
  hecha: "hecha",
  "en curso": "curso",
  revisión: "curso",
  pendiente: "pendiente",
};

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
            { valor: "25 186", nombre: "viajes en el CSV original", detalle: "1–28 de febrero de 2021" },
            { valor: "2 331", nombre: "patinetes distintos", detalle: "identificador idS" },
            { valor: "1–21/02", nombre: "periodo de ajuste", detalle: "fija parámetros y candidatos" },
            { valor: "22–28/02", nombre: "semana reservada", detalle: "solo para validar" },
          ]}
        />
        <div className="tarjetas">
          {FASES.map((f) => {
            const tareas = tareasDe(f.tareas);
            const estado = estadoDe(tareas);
            return (
              <a key={f.id} className="tarjeta" href={`#/${f.id}`}>
                <div className="arriba">
                  <span>
                    {f.pestana.split(" · ")[0]} · {f.fechas}
                  </span>
                  <span className={`chapa${estado === "en curso" ? " activa" : ""}`}>{estado}</span>
                </div>
                <h3>
                  {f.titulo}
                  {f.peso && <span style={{ color: "var(--tenue)", fontWeight: 400 }}> · {f.peso}</span>}
                </h3>
                <p>{f.descripcion}</p>
                <p className="tarjeta-avance">
                  {f.tareas} · {hechas(tareas)} de {tareas.length} tareas hechas
                </p>
              </a>
            );
          })}
        </div>
      </section>

      <Seguimiento />
    </>
  );
}

function Seguimiento() {
  const total = TODAS.length;
  const requisitos = TODAS.filter((t) => t.tipo === "R");
  const enMarcha = TODAS.filter((t) => t.estado === "en curso" || t.estado === "revisión").length;
  return (
    <section id="seguimiento" className="seccion">
      <header>
        <div>
          <div className="etiqueta">Seguimiento</div>
          <h2>Avance por bloques</h2>
        </div>
        <div>
          <p>
            Cada bloque reúne las tareas de una parte del trabajo y su responsable. El estado se lee de la{" "}
            <a href={LISTA}>lista de tareas</a> cada vez que se publica la web, así que coincide con el repositorio.
            Pasa el ratón por una tarea o abre el bloque para ver su título, quién la hace y en qué estado está.
          </p>
        </div>
      </header>
      <Cifras
        cifras={[
          { valor: `${hechas(TODAS)} de ${total}`, nombre: "tareas hechas", detalle: "requisitos y extras" },
          {
            valor: `${hechas(requisitos)} de ${requisitos.length}`,
            nombre: "requisitos del enunciado",
            detalle: "tareas de tipo R",
          },
          { valor: String(enMarcha), nombre: "en curso o en revisión" },
          { valor: String(TODAS.filter((t) => t.estado === "pendiente").length), nombre: "pendientes" },
        ]}
      />
      <ul className="leyenda-tareas" aria-label="Leyenda de estados">
        <li>
          <span className="tarea-id hecha">✓ T00</span> hecha
        </li>
        <li>
          <span className="tarea-id curso">T00</span> en curso o en revisión
        </li>
        <li>
          <span className="tarea-id pendiente">T00</span> pendiente
        </li>
      </ul>
      <div className="bloques-avance">
        {BLOQUES.map((b) => {
          const n = hechas(b.tareas);
          const pct = (100 * n) / b.tareas.length;
          return (
            <details key={b.nombre} className="bloque-avance">
              <summary>
                <span className="ba-nombre">
                  <strong>{b.nombre}</strong>
                  <span>{b.responsable}</span>
                </span>
                <span className="ba-progreso">
                  <span className="ba-barra" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="ba-cuenta">
                    {n}/{b.tareas.length}
                  </span>
                </span>
                <span className="ba-tareas">
                  {b.tareas.map((t) => (
                    <span key={t.id} className={`tarea-id ${CLASE[t.estado]}`} title={`${t.id} · ${t.titulo} · ${t.estado}`}>
                      {t.estado === "hecha" && "✓ "}
                      {t.id}
                    </span>
                  ))}
                </span>
              </summary>
              <div className="tabla-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tarea</th>
                      <th>Tipo</th>
                      <th>Responsable</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.tareas.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <td>{t.titulo}</td>
                        <td>{t.tipo === "R" ? "Requisito" : "Extra"}</td>
                        <td>{t.responsable || "Sin asignar"}</td>
                        <td>{t.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
