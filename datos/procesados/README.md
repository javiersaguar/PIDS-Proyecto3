# Datos procesados

## Qué hay que hacer

- Interpretar las fechas en la zona horaria de Roma (`Europe/Rome`) y comprobar la coherencia de duraciones, distancias, velocidades y coordenadas.
- Marcar los registros sospechosos con la columna `motivo`, documentar los umbrales aplicados y generar una tabla con los recuentos antes y después de cada filtro.
- Generar las tablas derivadas desde el código para que movilidad, consumo y recarga trabajen con los mismos viajes y puedan enlazar sus resultados.

## Qué debe incluir

- `viajes_limpios.parquet`, previsto en el plan, con los datos normalizados y las marcas de calidad.
- La tabla de recuentos de la limpieza y, conforme se generen, los datos intermedios reutilizables, como la asignación de viajes a estaciones o la energía calculada por viaje.
- Los criterios de calidad y las unidades se documentan en [docs/datos.md](../../docs/datos.md). Las figuras y tablas finales se publican en [resultados/](../../resultados/README.md).
