# Exploración de los datos (fase 0)

## Qué hay que hacer

- Generar `datos/procesados/viajes_limpios.parquet` desde el CSV original, con las marcas de calidad en `motivo`, la columna `elegible` y la tabla de embudo. El esquema está en los [contratos entre fases](../docs/PLAN.md#contratos-entre-fases).
- Responder con tablas y figuras a las preguntas de la [exploración orientada a decisiones](../docs/PLAN.md#exploración-orientada-a-decisiones). Cada pregunta alimenta una decisión de las fases siguientes.
- Calcular las cifras que fijan parámetros sobre el periodo de ajuste (1–21 de febrero). La semana reservada (22–28 de febrero) solo se describe para compararla.

## Qué debe incluir

- Un script por tema que se ejecute de principio a fin sin pasos manuales, por ejemplo `limpieza.py`, `recolocaciones.py`, `temporal.py`, `espacial.py`, `recorridos.py`, `energia_referencia.py` y `meteorologia.py`.
- Tablas en `resultados/tablas/exploracion/` y figuras en `resultados/figuras/exploracion/`, con nombres que permitan citarlas desde `docs/conclusiones_eda.md`.
- Las respuestas de fuentes externas, como la meteorología, se guardan en `datos/externos/` con su fuente, fecha y parámetros de consulta.
