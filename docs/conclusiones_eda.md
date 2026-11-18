# Conclusiones de la exploración (fase 0)

Decisiones que fija la fase 0 para las fases siguientes. Cada valor sale de una tabla o
figura generada por `ejecutar_todo.py`. Las rutas son relativas a `resultados/`.
Las cifras que fijan parámetros se calculan sobre el periodo de ajuste (1–21/02); la
semana reservada (22–28/02) solo se describe para compararla. Los parámetros acordados
están en `config.yaml`.

Columnas de las tablas de decisiones: qué decide, valor propuesto, evidencia, periodo,
limitaciones y qué cambia en el [plan](PLAN.md).

## T10. Limpieza (Javier)

De 25 186 viajes quedan **23 292 elegibles (92,5 %)**: 16 710 en el periodo de ajuste
(92,8 %) y 6 582 en la semana reservada (91,7 %). Ningún viaje se borra; los demás
llevan sus marcas en `motivo`.

- **Datos estructuralmente limpios.** No hay nulos, duplicados ni solapes del mismo
  patinete. La duración, la velocidad y el precio cuadran en todos los viajes: el precio
  es exactamente `1 € + 0,15 €/min` y la velocidad `3,6 · dis / tt`. Ningún extremo cae
  fuera de Roma. Por eso solo se excluyen viajes por umbrales de comportamiento.
- **Embudo** (`tablas/exploracion/T10_embudo.csv`):
  - 122 viajes de más de 2 h;
  - 2 de más de 25 km/h;
  - 949 de menos de 60 s;
  - 596 más de menos de 100 m;
  - 225 más de menos de 2 km/h.
- **El pico de ~1 000 viajes a casi 0 km/h** del histograma son desbloqueos sin viaje.
  Ya los quitan las reglas de duración y distancia: de los 976 viajes por debajo de
  1 km/h, solo 82 pasan las demás reglas. Los 225 que añade la regla `vel_baja` tienen
  distancias normales (mediana de 533 m) pero duran mucho: mediana de 35,5 min. Más que un
  desplazamiento en patinete, parecen un patinete que no se cerró a tiempo o que se llevó
  a mano.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Duración mínima | 60 s | `figuras/exploracion/T10_umbrales`, `T10_sensibilidad_umbrales` | Ajuste | La curva sube sin codo; 60 s es el criterio natural de "menos de un minuto no es un viaje" y excluye por sí solo el 3,7 % | Ninguno |
| Distancia mínima | 100 m | Mismas figuras | Ajuste | Por debajo de 25 m está el salto principal (3,5 %); a partir de 100 m la curva es lineal | Ninguno |
| Velocidad mínima | 2 km/h (regla nueva `vel_baja`) | Histograma de velocidad: valle entre el pico de desbloqueos y la distribución principal | Ajuste | Sus orígenes y destinos son reales; se pierde el 1 % de la demanda | Se añade al contrato de limpieza |
| Velocidad máxima | 25 km/h | `T10_sensibilidad_umbrales` | Ajuste | Solo 2 viajes; límite del patinete | Ninguno |
| Duración máxima | 2 h | `T10_sensibilidad_umbrales` | Ajuste | La curva se aplana a partir de 2 h (0,29 % por encima) | Ninguno |
| ¿Dependen las conclusiones de los umbrales? | No: se usa la limpieza principal | `tablas/exploracion/T10_comparacion_limpiezas.csv` | Ajuste y reservada | La variante permisiva (30 s, 50 m, sin velocidad mínima, 30 km/h, 3 h) deja un 2,9 % más de viajes; las medianas cambian menos del 3 %, los km un 0,6 % y la concentración espacial (55,5 % de los extremos en el 20 % de celdas H3 de resolución 8) es la misma | Repetir esta comparación con los indicadores de la red elegida |

## T11. Solapes y recolocaciones (Javier)

Se encadenan los 25 186 viajes de cada patinete (22 855 pares consecutivos) y se mide el
salto entre el final de un viaje y el inicio del siguiente.

- **Distribución con dos grupos.** El ruido de GPS (mediana 16,9 m, P75 57,8 m) y las
  recolocaciones (mediana 3,67 km) están separados por un valle entre 100 y 250 m
  (`figuras/exploracion/T11_saltos`).
- **No son rebalanceos dentro del día.**
  - El patinete recolocado ha estado parado una mediana de **98,8 h**, frente a 5,8 h
    cuando no hay salto.
  - Solo el 0,9 % de las recolocaciones ocurre en menos de 6 h, y el 98,8 % incluye al
    menos una noche.
  - Encaja con recogidas para recarga o mantenimiento que devuelven el patinete días
    después a otro punto.
- **Volumen.**
  - 5 111 recolocaciones en el mes (22,4 % de los pares consecutivos; 182,5 al día de media).
  - Afectan a 2 094 de los 2 331 patinetes.
  - La cifra es estable con el umbral: de 5 269 a 100 m a 4 683 a 1 km (`tablas/exploracion/T11_saltos_sensibilidad.csv`).
- **Dónde.**
  - Se recogen por todo el área de servicio y reaparecen en muchos menos puntos: 628 celdas H3 de resolución 10, frente a 1 972 donde se recogen (`T11_resumen.csv`, `figuras/exploracion/T11_mapa_recolocaciones`).
  - El saldo neto por celda está en `tablas/exploracion/T11_celdas_res8.csv`: la celda que más recibe gana 90 patinetes netos en el mes.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Umbral de recolocación | 200 m | `T11_saltos`, `T11_saltos_sensibilidad.csv` | Mes completo | Son indicios: puede haber viajes fuera de la muestra o deriva de GPS | Ninguno |
| ¿Rebalanceaba el piloto? | Sí, pero con recogidas de varios días, no dentro del día | `T11_resumen.csv` | Mes completo | No hay registros del operador | El escenario de rebalanceo de la fase 1 se plantea nocturno; con estaciones de recarga desaparecen las recogidas para cargar |
| Saldo del operador por zona | Contrastar con el saldo de T14 | `T11_celdas_res8.csv` | Mes completo | Resolución 8 | Las celdas donde el operador entrega más son candidatas a más stock inicial |

## T12. Patrones temporales y viajes simultáneos (Javier)

- **Volumen.**
  - 795,7 viajes al día de media en el ajuste y 940,3 en la semana reservada (+18 %).
  - La tendencia en el ajuste es de +9,4 viajes al día por cada día (`tablas/exploracion/T12_resumen.csv`, `figuras/exploracion/T12_serie_diaria`).
  - El día con menos viajes es el domingo 07/02 (403), pendiente de la meteorología de T17.
- **Laborable frente a fin de semana.**
  - El volumen diario es el mismo (797,3 frente a 791,7), pero cambia la forma.
  - El laborable tiene una punta de mañana de 7 a 10 h (14,4 % de los viajes frente al 4,3 %) y su máximo a las 18 h.
  - El fin de semana concentra más en la punta de tarde (43,2 % frente a 38,0 %) y su máximo es a las 16 h.
  - Los dos perfiles difieren en un 12,1 % de los viajes (distancia de variación total) (`T12_perfil_horario`, `T12_calor_dia_hora`, `tablas/exploracion/T12_franjas.csv`).
- **Viajes simultáneos.**
  - Como mucho hay **41 viajes en curso a la vez** en el ajuste (06/02 a las 17:10) y 42 en la semana reservada.
  - El percentil 99 por minuto es 26 (`T12_simultaneos`).
  - Cada día se usan de media 486,7 patinetes distintos (máximo 632) de los 2 305 que aparecen en viajes elegibles.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Franjas horarias | Madrugada 0–7, punta de mañana 7–10, mediodía 10–16, punta de tarde 16–20, noche 20–24 | `T12_perfil_horario`, `T12_franjas.csv` | Ajuste | Las provisionales encajan con los cambios del perfil; se fijan como definitivas | Ninguno: ya están en `config.yaml` |
| Tipos de día | Separar laborable y fin de semana en las matrices OD y en el simulador | `T12_perfil_horario`, `T12_calor_dia_hora` | Ajuste | Solo hay 6 días de fin de semana en el ajuste | Ninguno |
| Cota inferior de la flota | 41 patinetes (máximo de viajes en curso) | `T12_simultaneos_diarios.csv` | Ajuste | Es una cota muy floja | El tamaño de flota lo decidirá dónde hacen falta patinetes, no cuántos se usan a la vez: la simulación de inventario por estación es la que manda |
| Comparabilidad de la semana reservada | Tiene un 18 % más de demanda | `T12_viajes_diarios.csv` | Ambos | Crecimiento de un mes de invierno | La validación temporal es más exigente que un simple reparto aleatorio; decirlo en la memoria |

## T13. Densidad de orígenes y destinos (Alejandro)

Pendiente.

## T14. Saldo neto por zona (Alejandro)

Pendiente.

## T15. Recorridos y radios de acceso (Alejandro)

Pendiente.

## T16. Energía de referencia por patinete y día (Alejandro)

Pendiente.

## T17. Meteorología y días anómalos (Alejandro)

Pendiente.

## Preguntas abiertas

- ¿Coincide el saldo de T14 con las entregas netas del operador de T11? Si es así, las
  recolocaciones compensan la acumulación de patinetes y el rebalanceo nocturno es
  imprescindible en la simulación.
- ¿Explica la meteorología el 07/02 y el crecimiento del mes (T17)?
