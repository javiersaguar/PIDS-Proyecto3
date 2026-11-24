# Datos procesados

## Qué hay que hacer

- Interpretar las fechas en la zona horaria de Roma (`Europe/Rome`) y comprobar la coherencia de duraciones, distancias, velocidades y coordenadas.
- Marcar los registros sospechosos con la columna `motivo`, documentar los umbrales aplicados y generar una tabla con los recuentos antes y después de cada filtro.
- Generar las tablas derivadas desde el código para que movilidad, consumo y recarga trabajen con los mismos viajes y puedan enlazar sus resultados.

## Qué debe incluir

- `viajes_limpios.parquet`, previsto en el plan, con los datos normalizados y las marcas de calidad.
- La tabla de recuentos de la limpieza y, conforme se generen, los datos intermedios reutilizables, como la asignación de viajes a estaciones o la energía calculada por viaje.
- Los criterios de calidad y las unidades se documentan en [docs/datos.md](../../docs/datos.md). Las figuras y tablas finales se publican en [resultados/](../../resultados/README.md).

## Entrega de consumo a recarga

El [notebook T41–T43](../../consumo/T41_T43_modelo_b.ipynb) genera
`T43_energia_viaje.parquet` con los dos consumos, desnivel y variables de
contraste de cada viaje elegible. El [notebook T44–T45](../../consumo/T44_T45_agregados.ipynb)
genera `T44_entrada_recarga.parquet` a partir de las devoluciones atendidas de T39.

| Campo | Significado |
|---|---|
| `trip_id`, `idS` | Identificador del viaje y del patinete observado |
| `red`, `periodo` | Red ensayada y corte del periodo por salida |
| `tsD` | Hora de devolución en `Europe/Rome` |
| `estacion_destino` | Estación de devolución asignada en la simulación |
| `energia_wh_a`, `energia_wh_b` | Energía a reponer en batería en Wh con el Modelo A y B calibrado |

La clave es `(red, trip_id)`. La fase 3 selecciona `red == "habitual"`
y mantiene ajuste y reserva separados. El caso base usa A y B se usa como
sensibilidad por estación.
