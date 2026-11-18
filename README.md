# PIDS · Proyecto 3: micro-movilidad eléctrica

Planificación y optimización de un sistema de patinetes eléctricos compartidos con
estaciones de recarga fotovoltaicas, a partir de los viajes de Helbiz en Roma
(febrero de 2021).

Grupo: Javier Saguar (líder del proyecto 3) y Alejandro Cuevas.

**Web de resultados:** https://javiersaguar.github.io/PIDS-Proyecto3/ — gráficas
interactivas de cada fase, con su explicación y las conclusiones que sacamos.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/enunciado.md](docs/enunciado.md) | Resumen del enunciado, requisitos, especificaciones y entrega |
| [docs/datos.md](docs/datos.md) | Diccionario de datos y primer análisis de calidad |
| [docs/PLAN.md](docs/PLAN.md) | Plan del proyecto por fases, extras y calendario |
| [docs/TAREAS.md](docs/TAREAS.md) | Lista de tareas con responsable y estado |
| [AGENTS.md](AGENTS.md) | Normas del repositorio |

## Cómo ejecutar

Python 3.12. Desde la raíz del repositorio:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python ejecutar_todo.py
```

`ejecutar_todo.py` ejecuta los notebooks de análisis en orden, los guarda con sus
salidas y regenera las tablas, las figuras y los datos de la web. Para trabajar en un
notebook, ábrelo en VS Code o Jupyter con el kernel de `.venv`.

Todos los parámetros están en `config.yaml`. Los viajes limpios se cargan con
`from comun.datos import cargar_viajes`, que regenera
`datos/procesados/viajes_limpios.parquet` si falta o si cambian los parámetros de limpieza.

### Notebooks

Cada análisis es un notebook (`exploracion/T10_limpieza.ipynb`, …) con la misma estructura:

1. Título, objetivo y valor para el proyecto.
2. Por cada análisis: una celda de texto con el título, **qué queremos ver** y **por qué
   importa**; la celda de código; y una celda de texto con las **conclusiones**.
3. Una tabla final con las decisiones que salen del notebook.

Las tablas van a `resultados/tablas/`, las figuras a `resultados/figuras/` y los datos de
cada gráfica de la web a `frontend/public/datos/<fase>/` con `comun.web.exportar`.

### Web

La web está en `frontend/` (React, TypeScript, Vite y Plotly). Para verla en local:

```powershell
cd frontend
npm ci
npm run dev
```

Al hacer push a `main`, el flujo `.github/workflows/pages.yml` la compila y la publica
en GitHub Pages.

## Estructura

| Carpeta | Contenido |
|---|---|
| `datos/brutos/` | Datos de partida sin modificar |
| `datos/externos/` | Respuestas guardadas de fuentes externas |
| `datos/procesados/` | Datos limpios y derivados (generados por código) |
| `exploracion/` | Limpieza y exploración de los datos (fase 0) |
| `comun/` | Configuración, carga de viajes, distancias, estilo de figuras y exportación para la web |
| `movilidad/` | Matrices origen-destino, estaciones y flota (60 %) |
| `consumo/` | Consumo de la flota, por patinete y por estación (10 %) |
| `estacion_recarga/` | Demanda, paneles fotovoltaicos y baterías (20 %) |
| `resultados/` | Tablas y figuras generadas |
| `frontend/` | Web de resultados con gráficas interactivas (GitHub Pages) |
| `memoria/` | Memoria y conclusiones (10 %) |
| `presentacion/` | Presentación final |
| `docs/` | Documentación de trabajo |
