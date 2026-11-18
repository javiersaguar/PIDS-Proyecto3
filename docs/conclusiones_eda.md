# Conclusiones de la exploración (fase 0)

Cada decisión indica el parámetro o la pregunta del [plan](PLAN.md#exploración-orientada-a-decisiones)
que resuelve, el valor propuesto, la tabla o figura que lo justifica, el periodo usado,
sus limitaciones y lo que cambia en el plan. Las cifras se copian redondeadas de las
tablas de `resultados/tablas/` y se regeneran con `python ejecutar_todo.py`.

Periodos: **ajuste** = viajes elegibles con salida del 1 al 21/02/2021 (16 859 viajes);
**reservada** = del 22 al 28/02, solo descriptiva; **mes** = los dos juntos.

## Exploración espacial, recorridos, energía y meteorología (T13–T17, T20)

Scripts: `exploracion/espacial.py` (T13 y T14), `exploracion/recorridos.py` (T15),
`exploracion/energia_referencia.py` (T16), `exploracion/meteorologia.py` (T17) y
`movilidad/matrices_od.py` (T20). Las franjas horarias son las provisionales de
`config.yaml` hasta que T12 las fije; los scripts las leen de ahí.

### T13. Densidad H3 y concentración de la demanda

| Resolución | Área media | Arista media | Celdas con demanda | Mediana de extremos por celda | Celdas para el 50 / 80 / 90 / 95 % | Demanda en el 10 / 20 % de celdas más usadas |
|---|---|---|---|---|---|---|
| 8 | 0,74 km² | 531 m | 111 | 191 | 19 / 45 / 60 / 72 | 37,8 % / 56,9 % |
| 9 | 0,105 km² | 201 m | 600 | 32 | 94 / 226 / 312 / 381 | 37,3 % / 58,1 % |

Fuentes: `T13_resoluciones_h3.csv`, `T13_concentracion.csv`, figuras `T13_densidad_res8` y
`T13_concentracion`.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Resolución de la rejilla de candidatos a estación | **Resolución 9** para candidatos (arista de 201 m, del orden del radio de acceso). Resolución 8 para mapas, saldo y matrices O-D (111 celdas, mediana de 191 extremos por celda) | `T13_resoluciones_h3.csv` | Ajuste | La arista H3 es un valor medio; las celdas varían algo de tamaño | Confirma la resolución 8 como punto de partida y añade la 9 para candidatos |
| Rango de número de estaciones del barrido | Orden de magnitud con cobertura hexagonal sin huecos del área que reúne el 80–95 % de los extremos: **230–387 estaciones con R = 200 m, 102–172 con R = 300 m y 58–97 con R = 400 m** | `T13_estaciones_orden_magnitud.csv`, `T13_concentracion.csv` | Ajuste | Cuenta de área, no una localización: ignora que la demanda dentro de cada celda no es uniforme y que el 5–20 % restante puede quedar sin cubrir | Fija el rango del barrido de k en T25–T28 según el radio |
| ¿La demanda es estable en el espacio? | Sí. Spearman de las cuotas por celda ajuste–reservada: **0,98 (res. 8) y 0,92 (res. 9)**. El 99,96 % (res. 8) y el 99,81 % (res. 9) de los extremos de la semana reservada caen en celdas con demanda en el ajuste | `T13_estabilidad.csv` | Ajuste frente a reservada | Solo una semana de validación | La validación temporal de T30 es viable con los candidatos del ajuste |
| Puntos aislados para la marca `fuera_de_zona` | Con el criterio pedido (celda de res. 8 con ≤ 2 extremos en el mes y a más de 1 km de una celda con ≥ 10), **1 extremo**: destino del viaje `trip_id` 14376, que ya no es elegible por `tt_largo` | `T13_puntos_aislados.csv` (con su `motivo`), `T13_puntos_aislados_resumen.csv`, figura `T13_puntos_aislados` | Mes, todos los viajes del CSV | Umbrales de la tarea, sin calibrar | La regla no cambia ningún viaje elegible; Javier decide si se añade igualmente |

### T14. Saldo neto orígenes − destinos

Celdas de resolución 8 con al menos 30 extremos (O + D) en el periodo: 90 de 111, que
reúnen el 99,35 % de los extremos. Con una celda equilibrada, cada extremo sería origen o
destino al 50 % y `saldo_rel` tendría una desviación típica de 1/√n; con n = 30 es 0,18,
así que por debajo de 30 extremos el ruido domina.

| Indicador | Valor | Fuente |
|---|---|---|
| Celdas emisoras / receptoras / equilibradas | 42 / 46 / 2 | `T14_resumen.csv` |
| Celdas con desequilibrio mayor que 2σ del caso equilibrado | 15 | `T14_resumen.csv` |
| Cota inferior del rebalanceo, res. 8: media y máximo diarios | **101,5 y 137 patinetes/día** (12,7 % de los viajes del día) | `T14_resumen.csv`, `T14_rebalanceo_diario.csv` |
| Cota inferior del rebalanceo, res. 9: media y máximo diarios | 221,7 y 286,5 patinetes/día (27,9 %) | ídem |
| Parte estructural (saldo del periodo entre días), res. 8 / res. 9 | 43,0 / 100,7 patinetes/día | ídem |
| Las 10 celdas con mayor saldo absoluto: días con el acumulado del mismo signo que el total | 81–100 % (ocho de ellas el 100 %) | `T14_persistencia.csv`, figura `T14_saldo_acumulado` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Hace falta rebalanceo? | **Sí.** En las celdas con más saldo el acumulado crece durante todo el periodo sin volver a cero: la acumulación es estructural | Figura `T14_saldo_acumulado`, `T14_persistencia.csv` | Ajuste | Los datos ya incluyen las recolocaciones del operador (T11), que pueden ocultar parte del desequilibrio | El escenario sin traslados de T32 servirá de referencia; el rebalanceo de T33 deja de ser opcional en la práctica |
| Orden de magnitud del rebalanceo diario | **≈ 100 patinetes/día** con zonas de res. 8 y ≈ 220 con res. 9 (cota inferior, sin contar los desequilibrios dentro del día) | `T14_resumen.csv` | Ajuste | Cota por celda, no por estación; depende de la resolución. Pendiente de comparar con las recolocaciones de T11 | Dimensiona la capacidad de los traslados nocturnos de T33 |
| Zonas que piden más anclajes (receptoras) | Receptora principal `881e8052adfffff` (41,905 N, 12,480 E: entre San Pedro y Termini, al norte del Coliseo), −3,7 patinetes/día | `T14_saldo_celdas.csv`, `T14_persistencia.csv`, figura `T14_saldo` | Ajuste | Saldo por celda de 0,74 km² | Estas celdas necesitarán más anclajes libres que stock inicial en T32 |
| Zonas que piden más stock inicial (emisoras) | Emisora principal `881e805089fffff` (41,874 N, 12,522 E, al sureste del Coliseo), +4,0 patinetes/día, y varias celdas del sur | ídem | Ajuste | ídem | Más stock inicial en T32 |
| Franjas con desequilibrio | **Punta de mañana (7–10 h):** el flujo neto desplaza 29,9 patinetes/día, el 32,4 % de sus salidas; mediodía y punta de tarde desplazan 28,5 y 29,1, pero solo el 9–10 % de sus salidas. El centro recibe por la mañana y emite por la tarde | `T14_desequilibrio_franjas.csv`, figura `T14_saldo_franjas` | Ajuste | Franjas provisionales hasta T12 | El simulador debe trabajar por franjas o en continuo; el saldo diario esconde la inversión mañana–tarde |

### T15. Recorridos y radios de acceso

| Variable | P5 | P25 | Mediana | P75 | P95 | P99 |
|---|---|---|---|---|---|---|
| Distancia recorrida `dis_m` (m) | 338 | 883 | 1 607 | 2 785 | 5 176 | 7 446 |
| Duración `tt_s` (s) | 121 | 279 | 490 | 869 | 1 710 | 3 160 |
| Velocidad `vel_kmh` (km/h) | 4,7 | 9,2 | 12,4 | 15,3 | 18,5 | 20,3 |
| Distancia en línea recta (m) | 102 | 492 | 940 | 1 699 | 3 304 | 4 783 |

Fuentes: `T15_distribuciones.csv`, figura `T15_distribuciones`. Las medianas por franja y tipo
de día están en `T15_medianas_franja_tipo_dia.csv`.

| R | Andar > ir en patinete, caso peor (R + R) | Caso medio (2R/3 + 2R/3) | `dis_m` ≤ 2R | Andar todo el trayecto es más rápido, caso medio |
|---|---|---|---|---|
| 150 m | 28,7 % | 15,1 % | 3,9 % | 30,0 % |
| 200 m | 41,1 % | 24,7 % | 6,9 % | 34,5 % |
| 250 m | 52,3 % | 33,3 % | 10,0 % | 38,9 % |
| 300 m | 60,2 % | 41,1 % | 13,5 % | 43,9 % |
| 400 m | 72,7 % | 55,0 % | 21,7 % | 52,5 % |
| 500 m | 81,1 % | 64,8 % | 29,4 % | 59,9 % |

Fuente: `T15_radios_acceso.csv`, figura `T15_radios_acceso`.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Factor de rodeo (hipótesis para pasar de línea recta a distancia andando) | **1,33** (mediana; P25 1,19, P75 1,66) en los 15 303 viajes con línea recta ≥ 200 m | `T15_resumen.csv`, figura `T15_rodeo` | Ajuste | Es el rodeo del patinete, no del peatón; la cola larga (P95 4,5) son paseos. T29 lo contrastará con la red peatonal | Las distancias de acceso de T25–T28 se pueden multiplicar por 1,33 como aproximación |
| Viajes circulares | **3,6 %** (609 viajes: recta < 100 m y `dis_m` ≥ 500 m) | `T15_resumen.csv` | Ajuste | Umbrales de la tarea | Con estaciones empezarían y acabarían en la misma; la simulación debe admitir viajes con origen y destino iguales |
| Radios del barrido | **Confirmar 200 y 300 m y añadir 250 m; 400 m solo como sensibilidad.** Con 400 m, en el caso medio más de la mitad de los viajes (55,0 %) tardarían más andando hasta y desde la estación que en patinete, y el 21,7 % recorren menos de 2R | `T15_radios_acceso.csv` | Ajuste | Velocidad a pie de 1,3 m/s como hipótesis; el criterio compara el tiempo a pie con el del viaje, no la utilidad del usuario | Cambiar `movilidad.radios_acceso_m` a [200, 250, 300, 400] |
| Fracción de la demanda que pierde sentido con estaciones | Caso medio: **25 % con 200 m, 41 % con 300 m** de viajes en los que andar cuesta más que el propio viaje; andar todo el trayecto sería más rápido en el 34,5 % y el 43,9 % | ídem | Ajuste | Los viajes de paseo (rodeo alto) inflan el último indicador | Conviene informar la cobertura junto a la demanda que seguiría usando el servicio |

Velocidad a pie: 1,3 m/s, dentro del rango de 1,24–1,43 m/s de velocidad normal de adultos de
20 a 69 años que recoge Bohannon, R. W. y Andrews, A. W. (2011), «Normal walking speed: a
descriptive meta-analysis», *Physiotherapy* 97(3), 182–189,
[doi:10.1016/j.physio.2010.12.004](https://doi.org/10.1016/j.physio.2010.12.004). Se trata
como hipótesis.

### T16. Energía de referencia (13,5 Wh/km, batería de 576 Wh)

Control: un viaje de 2 km da 27 Wh. La suma por viaje coincide con la suma por patinete,
por patinete y día, por día de la flota y por celda de destino (diferencia 0 Wh,
`T16_comprobacion.csv`).

| Indicador | Valor | Fuente |
|---|---|---|
| Energía por viaje: mediana, P95 y máximo | 21,7 Wh, 69,9 Wh y 246,6 Wh (3,8 %, 12,1 % y 42,8 % de la batería) | `T16_viaje_distribucion.csv` |
| Viajes de más de 576 Wh | 0 | ídem |
| Energía por patinete y día activo: media, P95 y máximo | 45,2 Wh, 122,8 Wh y 298,1 Wh | `T16_patinete_dia_resumen.csv` |
| Patinete-día por encima del 50 / 80 / 100 % de la batería | 0,01 % / 0 % / 0 % | ídem |
| Ciclos equivalentes por patinete en el ajuste: media y máximo | 0,38 y 1,41 | `T16_patinete_resumen.csv` |
| Patinetes que agotarían la batería sin recargar en el ajuste | 1,4 % | ídem |
| Autonomía estimada por patinete (batería / Wh medios por día en servicio): P10, mediana y P90 | 22,8, 45,4 y 146 días | ídem, figura `T16_distribuciones` |
| Flota: media y máximo diarios | **22,1 y 29,6 kWh/día** (38,4 y 51,4 cargas completas) | `T16_resumen.csv`, `T16_flota_diaria.csv`, figura `T16_flota_diaria` |
| Celda de destino de res. 8: máximo y mediana | **0,90 y 0,13 kWh/día** | `T16_resumen.csv`, `T16_energia_celdas_top20.csv`, figura `T16_energia_celdas` |
| Energía que llega de 10 a 16 h / de 16 a 24 h / resto | **33,5 % / 55,5 % / 11,0 %** | `T16_resumen.csv`, `T16_perfil_horario.csv`, figura `T16_perfil_horario` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Frecuencia de recarga | **Cada varios días** con el uso observado: ningún patinete-día supera el 80 % de la batería y la mediana de autonomía es de 45 días | `T16_patinete_dia_resumen.csv`, `T16_patinete_resumen.csv` | Ajuste | Se supone batería completa utilizable y llena en el primer viaje del periodo. Con una flota simulada menor, cada patinete hará más viajes y la autonomía bajará | Recalcular con la flota de T34; el estado de carga de T35 solo será limitante si la flota se reduce mucho |
| Orden de magnitud de la energía por estación | **Décimas de kWh a 1 kWh al día** (la celda de res. 8 más cargada recibe 0,90 kWh/día) | `T16_energia_celdas_top20.csv` | Ajuste | Supone recarga donde se deja el patinete; una estación cubrirá menos área que una celda de res. 8 | Fija la escala de PVWatts y de la batería de T52–T55 |
| Energía en horas de sol | **Un tercio** llega entre las 10 y las 16 h y más de la mitad entre las 16 y las 24 h | `T16_perfil_horario.csv` | Ajuste | Hora de llegada, no de carga: la carga de un viaje medio dura minutos a 82 W | Con carga inmediata, la batería de la estación debe desplazar unos dos tercios de la energía; la carga inteligente de T56 es la alternativa |

### T17. Meteorología y días anómalos

Datos de Open-Meteo (API histórica, `best_match`: ECMWF IFS, ERA5 y ERA5-Land; CC BY 4.0)
guardados en `datos/externos/meteorologia/` con sus metadatos.

| Indicador | Valor | Fuente |
|---|---|---|
| Lluvia en el ajuste / en la reservada | 75,7 mm en 6 días con más de 1 mm / 0 mm | `T17_resumen.csv` |
| Temperatura media en el ajuste / en la reservada | 9,3 °C / 10,9 °C | ídem |
| Spearman viajes diarios–lluvia (n = 28) | −0,57 (laborables −0,59, n = 20; fin de semana −0,46, n = 8) | `T17_correlaciones.csv`, figura `T17_dispersion` |
| Spearman viajes diarios–temperatura media (n = 28) | 0,02 | ídem |
| Viajes en horas con lluvia frente a la misma hora y tipo de día sin lluvia (±7 días) | 0,69 (laborables 0,88; fin de semana 0,48), 42 horas | `T17_lluvia_horaria_resumen.csv` |
| Días por debajo del 70 % de la mediana de su tipo de día | 1: el **07/02** (domingo), 406 viajes, 46,7 % de la mediana; 24,6 mm y 21 horas con lluvia | `T17_dias_anomalos.csv`, figura `T17_viajes_lluvia` |
| Pendiente de los viajes diarios en el ajuste | 9,4 viajes/día cada día (EE 4,9), un 8,2 % de la media por semana | `T17_tendencia.csv` |
| Pendiente en el mes con fin de semana / añadiendo lluvia y temperatura | 10,7 (EE 3,0) / 7,7 (EE 2,5) viajes/día cada día | ídem |
| Cociente reservada / ajuste por día de la semana | 1,13–1,25; 1,185 en la semana | `T17_cociente_semana.csv` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Excluir algún día? | **No excluir el 07/02** de la localización ni de las matrices: la lluvia lo explica y es demanda real. No usarlo como día de diseño ni como día tipo | `T17_dias_anomalos.csv` | Mes | Un solo día anómalo con el umbral del 70 % | Marcarlo como día de lluvia en el simulador |
| ¿La semana reservada es comparable con el ajuste? | **Con cautela:** tiene un 18,5 % más de viajes (cociente 1,185), no llovió y fue más cálida (10,9 °C de media frente a 9,3 °C). Al añadir lluvia y temperatura al modelo, la pendiente baja de 10,7 a 7,7 viajes/día cada día pero no desaparece: el tiempo explica parte del crecimiento, no todo | `T17_resumen.csv`, `T17_tendencia.csv`, `T17_cociente_semana.csv` | Mes | n = 28 y cuatro variables; la celda de reanálisis está a 6,1 km de Roma centro | La validación temporal de T30 es más exigente que el ajuste y hay que decirlo al presentarla |
| Restricciones por COVID en Lacio | Sin afirmación: no hemos podido leer el texto oficial de las medidas de febrero de 2021 | — | — | — | Pregunta abierta |

### T20. Primera matriz O-D en H3 (resolución 8)

| Indicador | Valor | Fuente |
|---|---|---|
| Celdas de origen / de destino / pares con viajes | 103 / 111 / 2 156 | `resultados/tablas/movilidad/T20_resumen.csv` |
| Viajes que empiezan y acaban en la misma celda | **21,8 %** | ídem |
| Viajes en los 20 pares más frecuentes (incluidos los intrazonales) | 14,9 % | ídem, `T20_pares_top20.csv` |
| Viajes entre las 30 celdas con más extremos | 51,0 % | ídem, `T20_celdas_top30.csv` |
| Asimetría de los pares entre celdas distintas (Σ\|M − Mᵀ\| / viajes entre celdas) | 0,223, frente a 0,204 esperable por azar (cociente 1,10) | ídem, `T20_asimetria_pares_top10.csv` |

Mapa de calor de esas 30 celdas, con el mismo orden en filas y columnas:
figura `resultados/figuras/movilidad/T20_od_top30`.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Dónde está la asimetría? | Los pares son casi simétricos (1,10 veces lo esperable por azar): el desequilibrio de T14 es la suma de muchos pares pequeños, no de unos pocos corredores | `T20_resumen.csv` | Ajuste | Resolución 8; con zonas más finas aumentaría | El rebalanceo debe plantearse por zonas, no por corredores |
| Viajes intrazonales | El 21,8 % de los viajes no sale de su celda de res. 8 | ídem | Ajuste | Depende de la resolución | Con estaciones de radio ≥ 300 m una parte de ellos podría empezar y acabar en la misma estación |

### Preguntas abiertas para Javier

1. **Franjas horarias.** Todo usa las provisionales de `config.yaml`. Cuando T12 las fije,
   basta con volver a ejecutar los scripts. ¿Mantenemos la punta de mañana en 7–10 h? Es la
   franja con más desequilibrio relativo.
2. **Recolocaciones (T11).** La cota inferior del rebalanceo es de unos 100 patinetes/día en
   res. 8. ¿Cuántas recolocaciones diarias sale en T11? Si son del mismo orden, el piloto ya
   compensaba el desequilibrio.
3. **`fuera_de_zona`.** Con el criterio pedido solo sale un extremo aislado (`trip_id` 14376),
   y ese viaje ya está excluido por `tt_largo`. ¿Se añade la regla a la limpieza o basta con
   el rectángulo actual?
4. **Parámetros para `config.yaml`** (ahora en `PARAMETROS` de cada script):
   `movilidad.radios_acceso_m: [200, 250, 300, 400]`, resolución de candidatos 9, velocidad a
   pie 1,3 m/s, factor de rodeo 1,33, mínimo de 30 extremos para el saldo, umbral de lluvia de
   0,1 mm/h y horas de sol de referencia 10–16 h.
5. **Rango de estaciones.** ¿Barremos k con los órdenes de magnitud de
   `T13_estaciones_orden_magnitud.csv` (por ejemplo, 102–172 estaciones con R = 300 m)?
6. **Día 07/02.** Propongo no excluirlo y no usarlo como día de diseño. ¿De acuerdo?
7. **Semana reservada.** Tiene un 18,5 % más de demanda y no llovió. ¿Lo contamos así en la
   validación o normalizamos la demanda antes de comparar?
8. **COVID en Lacio.** No he podido leer el texto oficial de las medidas de febrero de 2021.
   ¿Tienes una fuente oficial? Si no, no decimos nada.
9. **Energía por patinete.** Con la flota observada la batería no limita (autonomía mediana
   de 45 días). ¿Recalculamos T16 con la flota simulada de T34 antes de la fase 3?
