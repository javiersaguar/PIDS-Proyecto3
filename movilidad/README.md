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

- [T26](T26_cobertura_parcial.ipynb) resuelve la cobertura parcial de viajes completos y deja el número de estaciones factible y su cota.
- [T27](T27_pmediana_mclp.ipynb) compara p-mediana, MCLP y el voraz por extremos a presupuestos comunes. Regenera la lista de viajes excluidos por red MCLP en `datos/procesados/T27_viajes_excluidos.parquet`.
- [T28](T28_pareto_eleccion.ipynb) genera el frente y fija [los emplazamientos de las finalistas](../resultados/tablas/movilidad/T28_estaciones.csv).
- [T29](T29_rutas_peatonales.ipynb) mide rutas en dos sectores con barreras. [T30](T30_validacion_temporal.ipynb) evalúa las mismas redes en la semana reservada y genera el [capítulo Validación](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/validacion).

`python ejecutar_todo.py --desde movilidad/T26_cobertura_parcial.ipynb` regenera estas etapas desde los resultados de T24 y T25 y la cartografía archivada. Las soluciones bajo límite de tiempo registran su cota y procedencia. T30 verifica la huella de las estaciones congeladas antes de usar los resultados peatonales del ajuste.
