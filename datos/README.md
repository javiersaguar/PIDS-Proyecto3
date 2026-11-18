# Datos del proyecto

## Qué hay que hacer

- Conservar los viajes de partida tal como se recibieron y generar los datos de trabajo a partir de ellos mediante código.
- Registrar la fuente, el periodo, las unidades y las transformaciones de cada conjunto de datos.
- Cuando se incorporen fuentes externas, guardar en `datos/externos/` los archivos o respuestas necesarios para repetir el análisis, junto con la fuente, la fecha y los parámetros de consulta.

## Qué debe incluir

- [brutos/](brutos/README.md) contiene el CSV original de viajes de Helbiz en Roma.
- [procesados/](procesados/README.md) recibe los viajes validados y las tablas derivadas que usan los análisis.
- Las fuentes externas previstas y el diccionario de las columnas se describen en [docs/datos.md](../docs/datos.md).
