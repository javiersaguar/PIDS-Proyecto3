# Exploración de los datos (fase 0)

## Qué hay que hacer

- Generar `datos/procesados/viajes_limpios.parquet` desde el CSV original, con las marcas de calidad en `motivo`, la columna `elegible` y la tabla de embudo. El esquema está en los [contratos entre fases](../docs/PLAN.md#contratos-entre-fases).
- Responder con tablas y figuras a las preguntas de la [exploración orientada a decisiones](../docs/PLAN.md#exploración-orientada-a-decisiones). Cada pregunta alimenta una decisión de las fases siguientes.
- Calcular las cifras que fijan parámetros sobre el periodo de ajuste (1–21 de febrero). La semana reservada (22–28 de febrero) solo se describe para compararla.

## Notebooks

| Notebook | Tarea | Responsable |
|---|---|---|
| `T10_limpieza.ipynb` | Limpieza, umbrales y comparación con una limpieza permisiva | Javier |
| `T11_recolocaciones.ipynb` | Solapes por patinete y recolocaciones del operador | Javier |
| `T12_temporal.ipynb` | Patrones temporales y viajes simultáneos | Javier |
| `T13_densidad.ipynb` | Densidad de orígenes y destinos en H3 y concentración | Alejandro |
| `T14_saldo.ipynb` | Saldo neto orígenes − destinos por celda, franja y día | Alejandro |
| `T15_recorridos.ipynb` | Recorridos, rodeo y radios de acceso | Alejandro |
| `T16_energia_referencia.ipynb` | Kilómetros y energía de referencia | Alejandro |
| `T17_meteorologia.ipynb` | Meteorología frente a demanda y días anómalos | Alejandro |
| `T18_tarifa_ingresos.ipynb` | Verificación de la tarifa e importe nominal por día y periodo | Javier |

Las [conclusiones de T19](../docs/conclusiones_eda.md#t19-cierre-de-la-exploración) reúnen las decisiones que pasan a las siguientes fases.

Todos siguen la misma estructura:

1. **Cabecera** (markdown): `# Txx. Título`, **Objetivo** y **Valor para el proyecto**.
2. **Preparación** (código): importaciones, `TEMA = "exploracion"`, `FASE = "fase0"` y los parámetros propios.
3. Por cada análisis, tres celdas:
   - markdown con `## n. Título`, **Qué queremos ver** y **Por qué importa**;
   - código que calcula, guarda la tabla en `resultados/tablas/exploracion/`, la figura con `guardar_figura` y los datos de la gráfica de la web con `exportar(FASE, "txx_nombre", datos)`;
   - markdown con **Conclusiones**: cifras que salen de la tabla de la celda anterior.
4. **Decisiones** (markdown): tabla con lo que fija el notebook.

Se ejecutan de principio a fin sin pasos manuales y dan lo mismo si se ejecutan dos veces.
`python ejecutar_todo.py` los ejecuta en orden y los guarda con sus salidas, que se suben
al repositorio para poder leerlos en GitHub sin ejecutarlos.

## Salidas

- Tablas en `resultados/tablas/exploracion/` y figuras (PDF y PNG) en `resultados/figuras/exploracion/`, con el prefijo de la tarea (`T13_concentracion_res8.csv`) para citarlas desde `docs/conclusiones_eda.md`.
- Datos de la web en `frontend/public/datos/fase0/`, un JSON por gráfica. La web solo dibuja lo que hay en esos ficheros.
- Las respuestas de fuentes externas, como la meteorología, se guardan en `datos/externos/` con su fuente, fecha y parámetros de consulta.
