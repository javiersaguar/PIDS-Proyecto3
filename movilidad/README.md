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
