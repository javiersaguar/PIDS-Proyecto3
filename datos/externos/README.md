# Datos externos

## Qué hay que hacer

- Guardar aquí las respuestas de las fuentes externas (PVWatts, PVGIS, meteorología, elevaciones, OpenStreetMap, límites administrativos) para que el análisis se pueda repetir sin conexión.
- Una subcarpeta por fuente, por ejemplo `meteorologia/` o `pvwatts/`. El nombre de cada fichero lleva la fuente, el periodo y la fecha de descarga.
- Junto a cada respuesta, un `.meta.json` con la URL, los parámetros de la consulta (sin claves de API), la fecha de descarga, la fuente, las unidades y la licencia.
- Los scripts solo descargan si falta el fichero o si se les pide explícitamente; el resto del tiempo leen lo guardado.

## Qué debe incluir

- Las respuestas tal como llegaron de cada fuente y sus metadatos. No se editan a mano.
