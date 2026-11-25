# Estaciones de recarga (20 %)

## Qué hay que hacer

- Convertir la energía estimada por viaje y su hora de llegada en perfiles de potencia y energía para todas las estaciones. Documentar la política de carga y el rendimiento del cargador.
- Elegir una estación concreta y justificar la elección. Estimar su perfil de generación fotovoltaica con PVWatts a partir de su ubicación y los parámetros de la instalación.
- Simular el balance horario entre demanda, generación solar, batería de apoyo y red. Comparar números de paneles y capacidades de batería, incluidas las opciones de 4, 8 y 12 kWh del enunciado y sus límites de potencia.
- Justificar el diseño propuesto con el porcentaje de horas en autonomía, la energía de recarga cubierta y la energía tomada de la red.

## Qué debe incluir

- Código para obtener los perfiles de carga, procesar la salida de PVWatts, simular la batería y comparar los diseños. Usar los datos de llegada y energía de [consumo/](../consumo/README.md).
- Parámetros de la estación y del dimensionado, referenciados desde la configuración del proyecto. Conservar la respuesta solar empleada en la carpeta prevista para datos externos.
- Series de demanda y generación, curvas de batería y tabla comparativa de diseños en [resultados/](../resultados/README.md).

## T50 · Demanda por estación

[T50](T50_demanda_estaciones.ipynb) parte de `T44_entrada_recarga.parquet` (red habitual)
y convierte cada llegada atendida en una sesión que repone la energía del viaje a
576 Wh / 7 h en batería. La energía y la potencia vistas desde la red se dividen por el
rendimiento del cargador. El [módulo de demanda](demanda.py) calcula:

- el perfil ideal (carga al llegar) y el viable con un cargador por anclaje, o con la
  mitad o la cuarta parte, atendiendo las sesiones por orden de llegada;
- la energía pedida, servida, aplazada y pendiente al cierre de cada periodo;
- el pico y el P95 de potencia en 15 minutos, la carga simultánea, las horas con cola y
  la energía que llega con el sol por debajo de 10°;
- las candidatas del ajuste por energía, pico y energía sin sol, la estación elegida y
  una alternativa.

Las hipótesis están en la [configuración de la fase](config.yaml). Salidas en
[resultados/tablas/estacion_recarga/](../resultados/tablas/estacion_recarga/):
`T50_estaciones.csv` (por estación, periodo, modelo y caso), `T50_resumen.csv`,
`T50_candidatas.csv` y `T50_perfil_hora.csv.gz`, que es la serie horaria en kWh AC del caso
base para el balance de T54 (solo horas con demanda; las que faltan valen cero).

Ejecutar `python ejecutar_todo.py --desde estacion_recarga/T50_demanda_estaciones.ipynb`
cuando ya existan los derivados de consumo. Las [pruebas](test_demanda.py) comprueban la
cola, el reparto por solape, la altura solar y que el perfil ideal en batería coincide
con T44.
