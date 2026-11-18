# PIDS · Proyecto 3: micro-movilidad eléctrica

Planificación y optimización de un sistema de patinetes eléctricos compartidos con
estaciones de recarga fotovoltaicas, a partir de los viajes de Helbiz en Roma
(febrero de 2021).

Grupo: Javier Saguar (líder del proyecto 3) y Alejandro Cuevas.

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

Todos los parámetros están en `config.yaml`. Los viajes limpios se cargan con
`from comun.datos import cargar_viajes`, que regenera
`datos/procesados/viajes_limpios.parquet` si falta o si cambian los parámetros de limpieza.

## Estructura

| Carpeta | Contenido |
|---|---|
| `datos/brutos/` | Datos de partida sin modificar |
| `datos/externos/` | Respuestas guardadas de fuentes externas |
| `datos/procesados/` | Datos limpios y derivados (generados por código) |
| `exploracion/` | Limpieza y exploración de los datos (fase 0) |
| `comun/` | Configuración, carga de viajes, distancias y estilo de figuras |
| `movilidad/` | Matrices origen-destino, estaciones y flota (60 %) |
| `consumo/` | Consumo de la flota, por patinete y por estación (10 %) |
| `estacion_recarga/` | Demanda, paneles fotovoltaicos y baterías (20 %) |
| `resultados/figuras/` | Figuras generadas |
| `memoria/` | Memoria y conclusiones (10 %) |
| `presentacion/` | Presentación final |
| `docs/` | Documentación de trabajo |
