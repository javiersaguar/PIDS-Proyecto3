# Consumo de los patinetes (10 %)

## Qué hay que hacer

- Estimar la energía de cada viaje con el modelo base del enunciado. Multiplicar la distancia recorrida en kilómetros por 13,5 Wh/km.
- Implementar y contrastar el modelo físico previsto en el plan. Documentar los parámetros y los supuestos sobre velocidad, aceleración y pendiente que requiere un CSV con datos de origen y destino.
- Agregar la energía por patinete, día, flota y estación. Usar la estación de destino asignada por [movilidad/](../movilidad/README.md) para imputar la energía que se debe reponer y dejar constancia de ese supuesto.

## Qué debe incluir

- Código de los modelos, la calibración y la agregación del consumo, con los parámetros y las unidades documentados.
- Una tabla derivada con el identificador del viaje, el patinete, la hora de llegada, la estación de destino y la energía estimada en Wh. Es la entrada de [estacion_recarga/](../estacion_recarga/README.md) y se genera en [datos/procesados/](../datos/procesados/README.md).
- Tablas de consumo agregado y una comparación entre los modelos en [resultados/](../resultados/README.md).
