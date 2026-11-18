# Tareas

Lista viva de lo que hay que ir haciendo. El detalle de cada fase está en
[PLAN.md](PLAN.md). Al empezar una tarea se pone el responsable y el estado; al
terminarla, el enlace al commit o a la PR.

Estados: `pendiente`, `en curso`, `revisión`, `hecha`. Tipo: `R` requisito del
enunciado, `E` extra.

## Fase 0. Puesta en marcha

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T01 | Entorno Python con dependencias fijadas | R | | pendiente | |
| T02 | Paquete `comun/` y `config.yaml` con todos los parámetros | R | | pendiente | |
| T03 | Script maestro que regenere resultados desde el CSV | R | | pendiente | |
| T04 | `.gitignore` y carpeta `datos/externos/` | R | | pendiente | |
| T05 | Elegir líder del proyecto 3 | R | | pendiente | |
| T06 | Documentar el trabajo y el contenido de cada carpeta | E | Javier | hecha | [Commit](https://github.com/javiersaguar/PIDS-Proyecto3/commit/6d3792bed4354859f778948b0baaab96a7993a2b) |

## Fase 1. Limpieza y exploración

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T10 | Limpieza con columna `motivo` y tabla de embudo | R | | pendiente | |
| T11 | Patrones temporales (hora × día, serie diaria) | R | | pendiente | |
| T12 | Densidad espacial de orígenes y destinos (H3) | R | | pendiente | |
| T13 | Recolocaciones del operador | E | | pendiente | |
| T14 | Meteorología frente a demanda | E | | pendiente | |
| T15 | Modelo de tarifa e ingresos | E | | pendiente | |

## Fase 2. Movilidad (60 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T20 | Matrices O-D en rejilla H3 | R | | pendiente | |
| T21 | Matrices O-D por zonas administrativas | R | | pendiente | |
| T22 | Matrices por franja horaria y laborable/fin de semana | R | | pendiente | |
| T23 | Indicadores O-D y mapa de líneas de deseo | R | | pendiente | |
| T24 | Candidatos a estación | R | | pendiente | |
| T25 | Línea base K-medoids / K-means con barrido de k | R | | pendiente | |
| T26 | Cobertura de conjuntos (LSCP) con MILP | R | | pendiente | |
| T27 | p-mediana y cobertura máxima (MCLP) | R | | pendiente | |
| T28 | Frente de Pareto y elección de la red | R | | pendiente | |
| T29 | Distancias a pie por red peatonal OSM | E | | pendiente | |
| T30 | Validación temporal (semanas 1–3 frente a 4) | E | | pendiente | |
| T31 | Asignación de viajes a estaciones y matriz estación → estación | R | | pendiente | |
| T32 | Simulación de inventario: stock inicial y anclajes por estación | R | | pendiente | |
| T33 | Escenarios de rebalanceo | E | | pendiente | |
| T34 | Curva flota frente a nivel de servicio e indicadores de uso | R | | pendiente | |
| T35 | Simulación con estado de carga (movilidad + consumo) | E | | pendiente | |
| T36 | Mapa interactivo | E | | pendiente | |

## Fase 3. Consumo (10 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T40 | Modelo A: 13,5 Wh/km por viaje | R | | pendiente | |
| T41 | Modelo B físico con parámetros referenciados | R | | pendiente | |
| T42 | Desnivel origen-destino con modelo de elevaciones | E | | pendiente | |
| T43 | Calibración del modelo B frente a 13,5 Wh/km | R | | pendiente | |
| T44 | Consumo por viaje, patinete, flota y estación | R | | pendiente | |
| T45 | Estado de carga por patinete a lo largo del mes | E | | pendiente | |
| T46 | Sensibilidad (tornado) | E | | pendiente | |

## Fase 4. Estación de recarga (20 %)

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T50 | Curvas de potencia y energía de todas las estaciones | R | | pendiente | |
| T51 | Elección de la estación concreta | R | | pendiente | |
| T52 | Producción FV con PVWatts (API, guardada) | R | | pendiente | |
| T53 | Contraste con PVGIS de febrero de 2021 y pvlib | E | | pendiente | |
| T54 | Balance horario FV + batería + red | R | | pendiente | |
| T55 | Barrido paneles × batería y elección | R | | pendiente | |
| T56 | Carga inteligente frente a carga inmediata | E | | pendiente | |
| T57 | Previsión de demanda horaria | E | | pendiente | |
| T58 | Extrapolación anual | E | | pendiente | |
| T59 | Valoración económica y CO₂ | E | | pendiente | |

## Fase 5 y 6. Cierre

| ID | Tarea | Tipo | Responsable | Estado | Entrega |
|---|---|---|---|---|---|
| T60 | Sensibilidad global del diseño | E | | pendiente | |
| T61 | Conclusiones y limitaciones | R | | pendiente | |
| T62 | Memoria `GZZ-P3.pdf` | R | | pendiente | |
| T63 | Presentación en PDF | R | | pendiente | |
| T64 | Reproducción en limpio | R | | pendiente | |
| T65 | Script de empaquetado `GZZ-P3.zip` | R | | pendiente | |
| T66 | Ensayo de la defensa | R | | pendiente | |
