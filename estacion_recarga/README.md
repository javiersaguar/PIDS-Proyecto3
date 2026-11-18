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
