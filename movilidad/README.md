# Movilidad (60 %)

## Qué hay que hacer

- Usar los viajes validados para construir matrices origen–destino por celdas H3, zonas administrativas y, una vez elegida la red, por estaciones. Analizar los flujos por franja horaria y tipo de día.
- Definir emplazamientos candidatos y comparar alternativas de localización. Medir cobertura y distancia de acceso tanto en el origen como en el destino y justificar el compromiso con el número de estaciones.
- Asignar los viajes a las estaciones elegidas y simular las salidas y llegadas para calcular el stock inicial, los anclajes por estación y la flota necesaria. Medir la utilización y el porcentaje de viajes atendidos según el tamaño de flota.

## Qué debe incluir

- Código para las matrices, la localización y la asignación a estaciones, la simulación de inventario y los indicadores de servicio.
- El código debe generar las matrices, el catálogo de estaciones con coordenadas y capacidades y la tabla de asignación por viaje. Esta última alimenta [consumo/](../consumo/README.md) y [estacion_recarga/](../estacion_recarga/README.md).
- Guardar las tablas intermedias en [datos/procesados/](../datos/procesados/README.md) y la comparación de redes, los indicadores finales y los mapas en [resultados/](../resultados/README.md).

## Matrices origen–destino

- [T20](T20_matrices_od.ipynb) construye la matriz H3 del periodo de ajuste.
- [T21](T21_matrices_od_administrativas.ipynb) genera las matrices de municipios y zonas urbanísticas de Roma del mes, del ajuste y de la semana reservada. Las tablas completas y su catálogo están en [resultados/tablas/movilidad/](../resultados/tablas/movilidad). La asignación por viaje se regenera en `datos/procesados/T21_viajes_zonificados.parquet`.
- [T22](T22_matrices_od_temporales.ipynb) segmenta las tres divisiones por hora local de salida y por tipo de día. El CSV de matrices es disperso. Cada fila representa un par con viajes.
- [T23](T23_indicadores_lineas_deseo.ipynb) usa esas matrices para calcular la concentración y la asimetría. El mapa muestra los pares H3 con más viajes entre celdas.

## Localización de estaciones

- [T24](T24_candidatos_estacion.ipynb) construye el [catálogo de candidatos](../resultados/tablas/movilidad/T24_candidatos.csv) con la demanda del ajuste y las comprobaciones cartográficas. `candidate_id` identifica la celda H3 y `incluido_barrido` indica si su posición entra en los modelos.
- [T25](T25_linea_base_localizacion.ipynb) compara K-medoids y K-means ajustado a candidatos. [El barrido](../resultados/tablas/movilidad/T25_barrido.csv) mide cobertura y distancias en los viajes de ajuste. [El catálogo de redes](../resultados/tablas/movilidad/T25_redes.csv) conserva las estaciones de cada `network_id` para reproducir la comparación.
- Los dos notebooks exportan los datos del [capítulo Localización](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/localizacion). T24 publica el contorno H3, coordenadas y avisos de cada posición. T25 exporta las salidas y llegadas de viajes con cobertura completa en el mismo orden de estaciones que la red de cada radio y presupuesto.

## Selección y validación

| Tarea | Resultado y comprobación | Vista |
|---|---|---|
| [T26](T26_cobertura_parcial.ipynb) | Minimiza estaciones con objetivo de viajes completos. La [auditoría](../resultados/tablas/movilidad/T26_certificados.csv) verifica la cota inferior y el margen sobre el objetivo en cada radio. | [Mínimo de estaciones](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t26) |
| [T27](T27_pmediana_mclp.ipynb) | Contrasta p-mediana, MCLP y voraz a presupuestos comunes. Publica cotas de MCLP y regenera los viajes excluidos por red en `datos/procesados/T27_viajes_excluidos.parquet`. | [Presupuesto fijo](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t27) |
| [T28](T28_pareto_eleccion.ipynb) | Genera el frente y fija [los emplazamientos de las finalistas](../resultados/tablas/movilidad/T28_estaciones.csv) antes de evaluar la reserva. | [Pareto y elección](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t28) |
| [T29](T29_rutas_peatonales.ipynb) | Mide rutas en dos sectores con barreras, separa pérdidas por extremo y ensaya varios umbrales sobre las mismas estaciones. | [Acceso por calles](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t29) · [Mapa](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/validacion) |
| [T30](T30_validacion_temporal.ipynb) | Evalúa la misma red en la reserva. Publica recuentos diarios, por franja y tipo de día, y descompone la variación en cambio de pesos y cambio dentro de cada grupo. | [Semana reservada](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t30) |

## Inventario

| Tarea | Resultado y comprobación | Vista |
|---|---|---|
| [T31](T31_asignacion_estaciones.ipynb) | Asigna cada viaje del ajuste a la estación más cercana de cada extremo y le añade el resultado de T32. Construye las matrices estación → estación de demanda asignable y de viajes atendidos, y [concilia](../resultados/tablas/movilidad/T31_conciliacion.csv) las cuentas con T32. La [matriz](../resultados/tablas/movilidad/T31_matriz_estaciones.csv) guarda la distancia y los viajes de cada par. La tabla por viaje se regenera en `datos/procesados/T31_asignacion.parquet` y es la entrada de consumo. | [Asignación](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t31) |
| [T32](T32_inventario.ipynb) | Simula el ajuste con patinetes y anclajes limitados, reserva de anclaje, desvío dentro del radio y rebalanceo nocturno. Da el [catálogo de estaciones](../resultados/tablas/movilidad/T32_estaciones.csv) con stock inicial, anclajes y utilización. El resultado de cada solicitud se regenera en `datos/procesados/T32_viajes_simulados.parquet`. | [Stock y anclajes](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t32) |
| [T34](T34_curva_flota.ipynb) | Barre el tamaño de la flota con los anclajes de T32 y 0, 100 y 220 recolocaciones por noche. Da la [curva de servicio y uso](../resultados/tablas/movilidad/T34_curva_flota.csv) y la flota mínima que cumple el objetivo, con su [contraste en la semana reservada](../resultados/tablas/movilidad/T34_comparacion.csv). | [Curva de flota](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t34) |

El simulador está en [inventario.py](inventario.py). `simular(demanda, red, stock, anclajes, rebalanceo_max)` sirve para T33 y T34. [test_inventario.py](test_inventario.py) comprueba sus reglas con casos pequeños (`python movilidad/test_inventario.py`).

## Cierre de movilidad

El [notebook T33–T39](T33_T39_cierre.ipynb) presenta y comprueba las salidas.
Ejecutar `python ejecutar_todo.py --desde consumo/modelo_a.py` para reproducir
el cierre con la zonificación, red y dimensionado archivados. T21 genera la
zonificación por viaje y T28 fija el catálogo de ubicaciones. El modelo T40
aporta los Wh por viaje.

| Tarea | Evidencia |
|---|---|
| T33 | [Políticas y límites](../resultados/tablas/movilidad/T33_politicas.csv), [registro nocturno](../resultados/tablas/movilidad/T33_noches.csv) |
| T35 | [Estado de carga y balance](../resultados/tablas/movilidad/T35_carga.csv) |
| T36 | [Cobertura y servicio por celda](../resultados/tablas/movilidad/T36_cobertura_operativa.csv), [flujos](../resultados/tablas/movilidad/T36_flujos_operativos.csv) y [mapa](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/validacion/ajuste/ambos/lscp_r300_k159/operacion) |
| T37 | [Cobertura por zona](../resultados/tablas/movilidad/T37_zonas.csv), [emplazamientos de la variante](../resultados/tablas/movilidad/T37_equidad.csv) |
| T38 | [Cierres y desvíos](../resultados/tablas/movilidad/T38_cierres.csv), [emplazamientos redundantes](../resultados/tablas/movilidad/T38_redundante.csv) |
| T39 | [Resultados por red](../resultados/tablas/movilidad/T39_redes.csv) y [estación](../resultados/tablas/movilidad/T39_estaciones.csv) |

Los criterios de adopción y las limitaciones están en las
[conclusiones de movilidad](../docs/conclusiones_eda.md#cierre-de-la-fase-1).
La regeneración deja también `datos/procesados/T39_llegadas_atendidas.parquet`
con el destino simulado, la hora de devolución y los Wh de cada viaje
atendido para la fase de recarga.

## Experimentos de capacidad

[capacidad.py](capacidad.py) y el [notebook T80–T81](T80_T81_capacidad.ipynb)
usan el mismo simulador con la red, el stock y los anclajes de T32.

| Tarea | Evidencia |
|---|---|
| T80 | [Servicio por estrategia](../resultados/tablas/movilidad/T80_anclajes.csv) y [traslados](../resultados/tablas/movilidad/T80_traslados.csv) |
| T81 | [Servicio por etapa](../resultados/tablas/movilidad/T81_etapas.csv), [ampliaciones](../resultados/tablas/movilidad/T81_ampliaciones.csv) y [capacidades por estación](../resultados/tablas/movilidad/T81_estaciones.csv) |

Los resultados están en las [conclusiones](../docs/conclusiones_eda.md#t80t81-reparto-de-anclajes-y-despliegue-por-etapas)
y en la [web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t80).

`python ejecutar_todo.py --desde movilidad/T26_cobertura_parcial.ipynb` regenera estas etapas desde los resultados de T24 y T25 y la cartografía archivada. Las soluciones bajo límite de tiempo registran su cota y procedencia. T30 verifica la huella de las estaciones congeladas antes de usar los resultados peatonales del ajuste. Para auditar cotas sobre las soluciones archivadas, ejecutar `python movilidad/certificados.py` desde la raíz.
