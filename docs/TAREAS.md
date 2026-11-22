# Tareas

Lista viva de lo que hay que ir haciendo. El detalle de cada fase está en
[PLAN.md](PLAN.md). Al empezar una tarea se pone el responsable y el estado; al
terminarla, el enlace al commit o a la PR.

Estados: `pendiente`, `en curso`, `revisión`, `hecha`. Tipo: `R` requisito del
enunciado, `E` extra.

Las fases 1 a 4 coinciden con los apartados del enunciado. La fase 0 deja los datos
limpios y fija los parámetros que usan las demás. Líder del proyecto 3: Javier Saguar.

## Fase 0. Datos: puesta en marcha, limpieza y exploración (hasta el 23/11)

Detalle en [PLAN.md, sección 3](PLAN.md#3-datos-y-exploración). Cada tarea de exploración
responde a una pregunta y deja una tabla o figura que se cita en `docs/conclusiones_eda.md`.

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T01 | Entorno Python con dependencias fijadas | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/a6cc17b7d749d21379e503a619b487a25fc2da83) |
| T02 | Paquete `comun/` (carga de viajes) y `config.yaml` con todos los parámetros | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/a6cc17b7d749d21379e503a619b487a25fc2da83) |
| T03 | Script maestro que regenere resultados desde el CSV | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/a6cc17b7d749d21379e503a619b487a25fc2da83) |
| T04 | `.gitignore` y carpeta `datos/externos/` | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/a6cc17b7d749d21379e503a619b487a25fc2da83) |
| T05 | Elegir líder del proyecto 3 | R | Los dos | hecha | Javier Saguar |
| T06 | Documentar el trabajo y el contenido de cada carpeta | E | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/6d3792bed4354859f778948b0baaab96a7993a2b) |
| T07 | Ampliar el plan de análisis, simulación y demo 3D | E | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/bb6054ed01008b6fbb8b2d6d10854c597a06d5ca) |
| T08 | Análisis en notebooks: una celda por análisis, con objetivo antes y conclusiones después | E | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/3fb407a73b3cbbf773290c64d3bf06e34df2b9a4) |
| T09 | Web de resultados en GitHub Pages: gráficas interactivas, explicación y conclusiones por fase | E | Javier | hecha | [Web](https://javiersaguar.github.io/PIDS-Proyecto3/) · [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/0e8ecce68a0ba4d9a3288a80734ddc9a42bb26b7) |
| T10 | Limpieza: `viajes_limpios.parquet`, marcas en `motivo`, umbrales justificados y tabla de embudo | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/81e54e25872b346e51243c4f6962adfdf5c89c14) |
| T11 | Solapes por patinete y recolocaciones del operador | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/81e54e25872b346e51243c4f6962adfdf5c89c14) |
| T12 | Patrones temporales y viajes simultáneos | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/81e54e25872b346e51243c4f6962adfdf5c89c14) |
| T13 | Densidad de orígenes y destinos en H3 y concentración de la demanda | R | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/604599cbc4a0aceb28ce65dc9ccbebab1cfaf571) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T14 | Saldo neto orígenes − destinos por celda, franja y día | R | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/158a9b5ef0d22a86f4d21924d2c544381111e35b) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T15 | Recorridos: distancia, duración, velocidad, rodeo y radios de acceso | R | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/3b8f594b3f47a6516ec7ab12da9af5ae1a3ba174) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T16 | Kilómetros y energía de referencia por patinete y día | R | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/dbb1b7911b64e8a4b35a72d83bf8bbde93495cd7) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T17 | Meteorología frente a demanda y días anómalos | E | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/aba574d0bcaf45023cb66aaa73f23ed4b0b08dec) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T18 | Modelo de tarifa e ingresos | E | | pendiente | |
| T19 | Conclusiones de la exploración (`docs/conclusiones_eda.md`) y seguimiento del 23/11 | R | Los dos | en curso | [Parte de Alejandro](https://github.com/javiersaguar/PIDS-Proyecto3/commit/582fcba0ad9bd11fe2898c06c4ce125d093c77e8) |

## Fase 1. Movilidad (60 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T20 | Matrices O-D en rejilla H3 | R | Alejandro | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/2086566aff82beb1c2812f94f73c90a4f43f08cc) · [Notebook](https://github.com/javiersaguar/PIDS-Proyecto3/commit/19ffdcb1bd5233d38151985db2b5918cb5909fe5) |
| T21 | Matrices O-D por zonas administrativas | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/c7b3d4065c8c24026abfe129cdc68223b95a1c39) · [Notebook](../movilidad/T21_matrices_od_administrativas.ipynb) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t21) |
| T22 | Matrices por franja horaria y laborable/fin de semana | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/7a0b270582a792ba146f5bbacc253f9ea56a7a97) · [Notebook](../movilidad/T22_matrices_od_temporales.ipynb) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t22) |
| T23 | Indicadores O-D y mapa de líneas de deseo | R | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/7a0b270582a792ba146f5bbacc253f9ea56a7a97) · [Notebook](../movilidad/T23_indicadores_lineas_deseo.ipynb) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t23) |
| T24 | Candidatos a estación | R | | pendiente | |
| T25 | Línea base K-medoids / K-means con barrido de k | R | | pendiente | |
| T26 | Cobertura de conjuntos (LSCP) con MILP | R | | pendiente | |
| T27 | p-mediana y cobertura máxima de viajes completos con ambos extremos cubiertos | R | | pendiente | |
| T28 | Frente de Pareto y elección de la red | R | | pendiente | |
| T29 | Contrastar la cobertura geométrica con rutas a pie en dos sectores con barreras | E | | pendiente | |
| T30 | Validación temporal (semanas 1–3 frente a 4) | E | | pendiente | |
| T31 | Asignación de viajes a estaciones y matriz estación → estación | R | | pendiente | |
| T32 | Simulación de inventario: stock inicial y anclajes por estación | R | | pendiente | |
| T33 | Rebalanceo nocturno con 0, 100 y 220 movimientos, km y déficit residual | E | | pendiente | |
| T34 | Curva flota frente a nivel de servicio e indicadores de uso | R | | pendiente | |
| T35 | Simulación con estado de carga (movilidad + consumo) | E | | pendiente | |
| T36 | Capas de cobertura y flujos OD para el mapa de la demo | E | Alejandro | en curso | [Notebook](../movilidad/T36_capas_mapa.ipynb) (red preliminar voraz hasta que T25–T28 elijan la red) |
| T37 | Medir acceso en las zonas peor cubiertas y comparar una red alternativa | E | | pendiente | |
| T38 | Comparar la red habitual y una redundante en cinco cierres críticos con derivación de viajes | E | | pendiente | |
| T39 | Comparar redes finalistas con indicadores de movilidad y recarga | E | | pendiente | |

## Fase 2. Consumo (10 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T40 | Modelo A: 13,5 Wh/km por viaje | R | | pendiente | |
| T41 | Modelo B físico con parámetros referenciados | R | | pendiente | |
| T42 | Desnivel origen-destino con modelo de elevaciones | E | | pendiente | |
| T43 | Calibración del modelo B frente a 13,5 Wh/km | R | | pendiente | |
| T44 | Consumo por viaje, patinete, flota y estación | R | | pendiente | |
| T45 | Estado de carga por patinete a lo largo del mes | E | | pendiente | |
| T46 | Sensibilidad (tornado) | E | | pendiente | |

## Fase 3. Estación de recarga (20 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T50 | Curvas de potencia y energía de todas las estaciones | R | | pendiente | |
| T51 | Comparar tres emplazamientos por acceso, superficie y sombra y elegir una estación | R | | pendiente | |
| T52 | Producción FV con PVWatts (API, guardada) | R | | pendiente | |
| T53 | Contraste con PVGIS de febrero de 2021 y pvlib | E | | pendiente | |
| T54 | Balance horario FV + batería + red | R | | pendiente | |
| T55 | Comparar paneles y 0, 4, 8 y 12 kWh de batería con producción de referencia y baja | R | | pendiente | |
| T56 | Comparar carga inmediata y solar con reserva de patinetes listos y conciliar la carga final | E | | pendiente | |
| T57 | Previsión de demanda horaria | E | | pendiente | |
| T58 | Extrapolación anual | E | | pendiente | |
| T59 | Valoración económica y CO₂ | E | | pendiente | |

## Fase 4. Conclusiones y entrega (10 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T60 | Probar el diseño con días difíciles, demanda punta adicional y producción solar baja | E | | pendiente | |
| T61 | Conclusiones y limitaciones | R | | pendiente | |
| T62 | Memoria `G02-P3.pdf` (LaTeX en `memoria/`) | R | Javier | en curso | |
| T63 | Presentación en PDF | R | | pendiente | |
| T64 | Reproducción en limpio | R | | pendiente | |
| T65 | Script de empaquetado `G02-P3.zip` | R | | pendiente | |
| T66 | Ensayo de la defensa | R | | pendiente | |

## Demo 3D para la defensa

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T70 | Definir el esquema y exportar los escenarios y series desde Python | E | Alejandro | en curso | `manifest.json` y `networks/` del plan en `frontend/public/demo/`; faltan los escenarios simulados |
| T71 | Integrar el mapa inclinado, el reloj y la ficha de estación con T36 y T70 | E | Alejandro | en curso | Web, `#/mapa` |
| T72 | Crear la maqueta 3D de la estación con anclajes, paneles, batería y balance horario | E | | pendiente | |
| T73 | Mostrar operación normal, cierre y red mejorada con el mismo cierre y cotejar los indicadores | E | | pendiente | |
| T74 | Probar teclado, legibilidad, rendimiento, versión sin red y vista sin WebGL | E | | pendiente | |
| T75 | Ensayar el guion de tres minutos y preparar el vídeo de respaldo | E | | pendiente | |

## Experimentos integrados

Las doce mejoras acordadas, sus dependencias y los criterios de cierre están en [PLAN.md, sección 7](PLAN.md#7-experimentos-integrados).

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T80 | Redistribuir diez anclajes con flota y capacidad total fijas y medir viajes recuperados | E | | pendiente | |
| T81 | Simular el despliegue en dos etapas con ampliación modular por saturación | E | | pendiente | |
| T82 | Incorporar al plan las doce mejoras acordadas | E | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/e394d6286eebefa7b77ce32c1e5faf5a4a4276c7) |
