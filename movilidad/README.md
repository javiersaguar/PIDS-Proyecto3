# Movilidad (60 %)

## Qué hay que hacer

- Usar los viajes validados para construir matrices origen–destino por celdas H3, zonas administrativas y, una vez elegida la red, por estaciones. Analizar los flujos por franja horaria y tipo de día.
- Definir emplazamientos candidatos y comparar alternativas de localización. Medir cobertura y distancia de acceso tanto en el origen como en el destino y justificar el compromiso con el número de estaciones.
- Asignar los viajes a las estaciones elegidas y simular las salidas y llegadas para calcular el stock inicial, los anclajes por estación y la flota necesaria. Medir la utilización y el porcentaje de viajes atendidos según el tamaño de flota.

## Qué debe incluir

- Código para las matrices, la localización y la asignación a estaciones, la simulación de inventario y los indicadores de servicio.
- El código debe generar las matrices, el catálogo de estaciones con coordenadas y capacidades y la tabla de asignación por viaje. Esta última alimenta [consumo/](../consumo/README.md) y [estacion_recarga/](../estacion_recarga/README.md).
- Guardar las tablas intermedias en [datos/procesados/](../datos/procesados/README.md) y la comparación de redes, los indicadores finales y los mapas en [resultados/](../resultados/README.md).
