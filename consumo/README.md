# Consumo de los patinetes (10 %)

## Qué hay que hacer

- Estimar la energía de cada viaje con el modelo base del enunciado. Multiplicar la distancia recorrida en kilómetros por 13,5 Wh/km.
- Implementar y contrastar el modelo físico previsto en el plan. Documentar los parámetros y los supuestos sobre velocidad, aceleración y pendiente que requiere un CSV con datos de origen y destino.
- Agregar la energía por patinete, día, flota y estación. Usar la estación de destino asignada por [movilidad/](../movilidad/README.md) para imputar la energía que se debe reponer y dejar constancia de ese supuesto.

## Qué debe incluir

- Código de los modelos, la calibración y la agregación del consumo, con los parámetros y las unidades documentados.
- Una tabla derivada con el identificador del viaje, el patinete, la hora de llegada, la estación de destino y la energía estimada en Wh. Es la entrada de [estacion_recarga/](../estacion_recarga/README.md) y se genera en [datos/procesados/](../datos/procesados/README.md).
- Tablas de consumo agregado y una comparación entre los modelos en [resultados/](../resultados/README.md).

El [Modelo A (T40)](modelo_a.py) genera [energía por viaje](../resultados/tablas/consumo/T40_energia_viaje.csv)
con 13,5 Wh por kilómetro de distancia registrada. Desde la raíz, ejecutar
`python consumo/modelo_a.py`. La tabla incluye el porcentaje de batería
nominal y marca los viajes que exceden una carga. Es la entrada de T35 y T39.

## T41–T45 y reproducción

- [T41–T43](T41_T43_modelo_b.ipynb) verifica T40, calcula la física por viaje,
  incorpora el archivo GLO-30 y calibra un único factor con el ajuste.
- [T44–T45](T44_T45_agregados.ipynb) concilia observaciones y asignaciones,
  publica energía y potencia de reposición por estación y simula el estado
  de carga. Los perfiles de 15 y 60 minutos se guardan como CSV comprimidos.
  Las filas omitidas en el intervalo publicado corresponden a potencia cero.
- [Configuración de consumo](config.yaml) documenta los supuestos. La masa,
  la batería y el coeficiente de referencia proceden de la configuración común.

Ejecutar `python ejecutar_todo.py --desde consumo/T41_T43_modelo_b.ipynb`
cuando ya existan los derivados de T31 y T39. Los notebooks usan los externos
archivados. `python consumo/fuentes.py` permite actualizarlos explícitamente
a partir de GLO-30 y la consulta de Open-Meteo. El análisis verifica su huella.
La [entrada para recarga](../datos/procesados/README.md#entrega-de-consumo-a-recarga)
se regenera con T44. [Conclusiones](../docs/conclusiones_eda.md#cierre-de-consumo-t40t45)
