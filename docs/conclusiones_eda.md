# Conclusiones de la exploración (fase 0)

Decisiones que fija la fase 0 para las fases siguientes. Cada valor sale de una tabla o
figura generada por los notebooks de `exploracion/` (los ejecuta `ejecutar_todo.py`). Las
rutas son relativas a `resultados/`. Las mismas gráficas, interactivas, están en la
[web de resultados](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase0).
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
  a mano (`tablas/exploracion/T10_viajes_lentos.csv`).

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Duración mínima | 60 s | `figuras/exploracion/T10_umbrales`, `T10_sensibilidad_umbrales` | Ajuste | La curva sube sin codo; 60 s es el criterio natural de "menos de un minuto no es un viaje" y excluye por sí solo el 3,7 % | Ninguno |
| Distancia mínima | 100 m | Mismas figuras | Ajuste | Por debajo de 25 m está el salto principal (3,5 %); a partir de 100 m la curva es lineal | Ninguno |
| Velocidad mínima | 2 km/h (regla nueva `vel_baja`) | Histograma de velocidad: valle entre el pico de desbloqueos y la distribución principal | Ajuste | Sus orígenes y destinos son reales; se pierde el 1 % de la demanda | Se añade al contrato de limpieza |
| Velocidad máxima | 25 km/h | `T10_sensibilidad_umbrales` | Ajuste | Solo 2 viajes; límite del patinete | Ninguno |
| Duración máxima | 2 h | `T10_sensibilidad_umbrales` | Ajuste | La curva se aplana a partir de 2 h (0,29 % por encima) | Ninguno |
| ¿Dependen las conclusiones de los umbrales? | No: se usa la limpieza principal | `tablas/exploracion/T10_comparacion_limpiezas.csv`, `figuras/exploracion/T10_comparacion_limpiezas` | Ajuste y reservada | La variante permisiva (30 s, 50 m, sin velocidad mínima, 30 km/h, 3 h) deja un 2,9 % más de viajes; las medianas cambian menos del 3 %, los km un 0,6 % y la concentración espacial (56,9 % de los extremos en el 20 % de celdas H3 de resolución 8) es la misma | Repetir esta comparación con los indicadores de la red elegida |

## T11. Solapes y recolocaciones (Javier)

Se encadenan los 25 186 viajes de cada patinete (22 855 pares consecutivos) y se mide el
salto entre el final de un viaje y el inicio del siguiente.

- **Distribución con dos grupos.** El ruido de GPS (mediana 16,9 m, P75 57,8 m) y las
  recolocaciones (mediana 3,67 km) están separados por un valle casi vacío de unos 100 a
  500 m (`figuras/exploracion/T11_saltos`).
- **No son rebalanceos dentro del día.**
  - El patinete recolocado ha estado parado una mediana de **98,8 h**, frente a 5,8 h
    cuando no hay salto.
  - Solo el 0,9 % de las recolocaciones ocurre en menos de 6 h, y el 98,8 % incluye al
    menos una noche.
  - Encaja con recogidas para recarga o mantenimiento que devuelven el patinete días
    después a otro punto (`figuras/exploracion/T11_parado`).
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
| ¿Rebalanceaba el piloto? | Sí, pero con recogidas de varios días, no dentro del día | `T11_resumen.csv`, `T11_parado` | Mes completo | No hay registros del operador | El escenario de rebalanceo de la fase 1 se plantea nocturno; con estaciones de recarga desaparecen las recogidas para cargar |
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

Viajes elegibles del ajuste (16 710) con el origen y el destino en celdas H3
(`exploracion/T13_densidad.ipynb`).

| Resolución | Área media | Arista media | Celdas con demanda | Mediana de extremos por celda | Celdas para el 50 / 80 / 90 / 95 % de los extremos | Extremos en el 10 / 20 % de celdas más usadas |
|---|---|---|---|---|---|---|
| 8 | 0,74 km² | 531 m | 111 | 190 | 19 / 45 / 60 / 72 | 37,8 % / 56,9 % |
| 9 | 0,105 km² | 201 m | 600 | 32 | 94 / 226 / 312 / 381 | 37,2 % / 58,1 % |

Fuentes: `tablas/exploracion/T13_resoluciones_h3.csv`, `T13_concentracion.csv` y
`T13_densidad_celdas.csv`; figuras `figuras/exploracion/T13_densidad_res8` y `T13_concentracion`.

- **Estabilidad.** La correlación de Spearman entre las cuotas por celda del ajuste y de la
  semana reservada es 0,98 en resolución 8 y 0,92 en resolución 9. El 99,98 % y el 99,83 % de
  los extremos de la reservada caen en celdas que ya tenían demanda en el ajuste
  (`T13_estabilidad.csv`).
- **Puntos aislados.** Con el criterio de la tarea (celda de resolución 8 con 2 extremos o menos
  en el mes y a más de 1 km de una celda con 10 o más) sale un solo extremo, el destino del
  viaje `trip_id` 14376, que ya está excluido por `tt_largo` (`T13_puntos_aislados.csv`,
  `T13_puntos_aislados_resumen.csv`, figura `T13_puntos_aislados`).

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Resolución de los candidatos a estación | Resolución 9 (arista de 201 m, del orden del radio de acceso). La 8 se queda para mapas, saldos y matrices O-D | `T13_resoluciones_h3.csv` | Ajuste | La arista es un valor medio de H3 | Añade la resolución 9 para los candidatos de T24 |
| Rango de estaciones del barrido | Área de las celdas de resolución 9 que reúnen del 80 al 95 % de los extremos, cubierta con círculos de radio R en malla hexagonal: **230–387 estaciones con 200 m, 147–248 con 250 m, 102–172 con 300 m y 58–97 con 400 m** | `T13_estaciones_orden_magnitud.csv` | Ajuste | Es una cuenta de área, no una localización: supone demanda uniforme dentro de cada celda | Fija el rango de k de T25–T28 para cada radio |
| ¿Es estable la demanda en el espacio? | Sí | `T13_estabilidad.csv` | Ajuste y reservada | Una sola semana de validación | Los candidatos del ajuste sirven para validar en T30 |
| Marca `fuera_de_zona` | No hace falta otra regla: el único extremo aislado ya no es elegible | `T13_puntos_aislados.csv` | Mes, todos los viajes | Umbrales de la tarea, sin calibrar | Ninguno |

## T14. Saldo neto por zona (Alejandro)

Saldo O − D por celda de resolución 8 en el ajuste (`exploracion/T14_saldo.ipynb`). Solo cuentan
las celdas con al menos 30 extremos: 90 de 111, con el 99,34 % de los extremos. Si una celda
estuviera equilibrada, cada extremo sería origen o destino al 50 % y `saldo_rel` tendría una
desviación típica de 1/√n, que con n = 30 es 0,18; por debajo, el ruido domina.

- **Emisoras y receptoras.** 43 celdas emisoras, 45 receptoras y 2 equilibradas; 16 tienen un
  desequilibrio mayor que dos desviaciones típicas del caso equilibrado (`T14_resumen.csv`,
  `T14_saldo_celdas.csv`, figura `T14_saldo`).
- **Persistencia.** En las 10 celdas con más saldo absoluto, el saldo acumulado tiene el mismo
  signo que el total en el 81–100 % de los días (el 100 % en ocho de ellas): crece sin volver a
  cero (`T14_persistencia.csv`, figura `T14_saldo_acumulado`).
- **Cota inferior del rebalanceo** (suma de |saldo| de todas las celdas cada día, entre 2):
  - resolución 8: **101,5 patinetes/día de media y 136 como máximo** (12,8 % de los viajes);
  - resolución 9: 221,2 y 285,5 (28,1 %);
  - la parte estructural (saldo del periodo repartido por día) es de 42,8 y 100,3
    patinetes/día (`T14_resumen.csv`, `T14_rebalanceo_diario.csv`).
- **Franjas.** En la punta de mañana el flujo neto desplaza 29,7 patinetes/día, el 32,4 % de
  sus salidas; mediodía y punta de tarde desplazan 28,2 y 29,2, pero solo el 9,9 % y el 9,3 %
  de las suyas. El centro recibe patinetes por la mañana y los devuelve por la tarde
  (`T14_desequilibrio_franjas.csv`, figura `T14_saldo_franjas`).
- **Respuesta a la pregunta abierta sobre T11.** Sí coinciden. Con todos los viajes del mes, las entregas
  netas del operador por celda siguen al saldo O − D de los viajes: Spearman de 0,89 y
  pendiente de 0,75 en 115 celdas. Las recolocaciones compensan el 62,1 % del saldo
  (`T14_saldo_frente_operador.csv`, figura `T14_saldo_frente_operador`). La celda en la que el
  operador entrega más (`881e805089fffff`) es también la principal emisora de T14.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Hace falta rebalanceo? | **Sí.** El saldo es estructural y el piloto ya lo compensaba con las recogidas del operador | `T14_persistencia.csv`, `T14_saldo_frente_operador.csv` | Ajuste; mes para el contraste con T11 | El contraste con T11 usa todos los viajes del mes | El rebalanceo nocturno es parte del escenario base de T32–T33, no una ampliación |
| Orden de magnitud diario | **Unos 100 patinetes/día** en resolución 8 y unos 220 en resolución 9 (cota inferior) | `T14_resumen.csv` | Ajuste | Por celda, no por estación; no cuenta los desequilibrios dentro del día | Capacidad de traslado de T33 |
| Zonas con más anclajes (receptoras) | La principal es `881e8052adfffff` (41,905 N, 12,480 E; entre San Pedro y Termini, al norte del Coliseo), con −3,7 patinetes/día | `T14_saldo_celdas.csv`, figura `T14_saldo` | Ajuste | Celdas de 0,74 km² | Más anclajes libres que stock inicial en T32 |
| Zonas con más stock inicial (emisoras) | La principal es `881e805089fffff` (41,874 N, 12,522 E; al sureste del Coliseo), con +4,0 patinetes/día, y varias celdas del sur | ídem | Ajuste | ídem | Más stock inicial en T32 |
| Franjas del desequilibrio | Sobre todo la punta de mañana, en proporción a sus salidas; el desequilibrio se invierte por la tarde | `T14_desequilibrio_franjas.csv` | Ajuste | El saldo diario esconde la inversión | El simulador debe trabajar por franjas o en continuo |

## T15. Recorridos y radios de acceso (Alejandro)

Viajes elegibles del ajuste (`exploracion/T15_recorridos.ipynb`).

| Variable | P5 | P25 | Mediana | P75 | P95 | P99 |
|---|---|---|---|---|---|---|
| Distancia recorrida (m) | 348 | 894 | 1 619 | 2 794 | 5 186 | 7 450 |
| Duración (s) | 121 | 279 | 489 | 856 | 1 680 | 2 611 |
| Velocidad media (km/h) | 5,1 | 9,3 | 12,5 | 15,3 | 18,5 | 20,3 |
| Distancia en línea recta (m) | 107 | 497 | 949 | 1 710 | 3 308 | 4 803 |

Fuentes: `tablas/exploracion/T15_distribuciones.csv` y figura `figuras/exploracion/T15_distribuciones`.
Las medianas por franja y tipo de día están en `T15_medianas_franja_tipo_dia.csv`.

- **Rodeo** (`dis_m` / línea recta, viajes con línea recta de 200 m o más): mediana **1,328**,
  P25 1,185, P75 1,651 y P95 4,55, en 15 218 viajes (`T15_resumen.csv`, figura `T15_rodeo`).
- **Viajes circulares** (línea recta < 100 m y `dis_m` ≥ 500 m): 599, el **3,58 %**.
- **Radios de acceso.** Caso peor: R en cada extremo; caso medio: 2R/3 en cada extremo. Ambos
  por el rodeo y a 1,3 m/s (`T15_radios_acceso.csv`, figura `T15_radios_acceso`):

| R | Andar tarda más que el viaje, caso peor | Ídem, caso medio | `dis_m` ≤ 2R | Andar todo el trayecto es más rápido, caso medio |
|---|---|---|---|---|
| 150 m | 28,99 % | 15,19 % | 3,66 % | 29,40 % |
| 200 m | 41,42 % | 24,96 % | 6,64 % | 33,95 % |
| 250 m | 52,39 % | 33,50 % | 9,67 % | 38,42 % |
| 300 m | 60,62 % | 41,42 % | 13,14 % | 43,46 % |
| 400 m | 73,07 % | 55,32 % | 21,29 % | 52,12 % |
| 500 m | 81,52 % | 65,16 % | 28,99 % | 59,55 % |

Velocidad a pie: 1,3 m/s, dentro del rango de 1,24–1,43 m/s de velocidad normal de los adultos
de 20 a 69 años recogido por Bohannon, R. W. y Andrews, A. W. (2011), «Normal walking speed: a
descriptive meta-analysis», *Physiotherapy* 97(3), 182–189,
[doi:10.1016/j.physio.2010.12.004](https://doi.org/10.1016/j.physio.2010.12.004). Es una hipótesis.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Factor de rodeo | 1,328 como hipótesis para pasar de línea recta a distancia andando | `T15_resumen.csv`, figura `T15_rodeo` | Ajuste | Es el rodeo del patinete, no el del peatón; la cola larga son paseos. T29 lo contrastará con la red peatonal | Las distancias de acceso de T25–T28 pueden multiplicarse por este factor |
| Radios del barrido | **Mantener 200 y 300 m, añadir 250 m y dejar 400 m como sensibilidad.** Con 400 m, en el caso medio el 55,32 % de los viajes tardaría más andando a las estaciones que en el propio viaje, y el 21,29 % recorre menos de 2R | `T15_radios_acceso.csv` | Ajuste | Velocidad a pie como hipótesis; compara tiempos, no la utilidad de cada usuario | `movilidad.radios_acceso_m` pasaría a [200, 250, 300, 400] |
| Demanda que deja de tener sentido con estaciones | En el caso medio, el 24,96 % de los viajes con 200 m y el 41,42 % con 300 m; andar todo el trayecto sería más rápido en el 33,95 % y el 43,46 % | `T15_radios_acceso.csv` | Ajuste | Los paseos (rodeo alto) inflan el último indicador | Informar la cobertura junto con la demanda que seguiría usando el servicio |
| Viajes circulares | 3,58 % de los viajes empezarían y acabarían en la misma estación | `T15_resumen.csv` | Ajuste | Umbrales de la tarea | El simulador debe admitir origen y destino iguales |

## T16. Energía de referencia por patinete y día (Alejandro)

Modelo del enunciado: `energia_wh = 13,5 × dis_m / 1000`, con batería de 576 Wh
(`exploracion/T16_energia_referencia.ipynb`). Un viaje de 2 km da 27 Wh. La suma por viaje coincide
con la suma por patinete, por patinete y día, por día de la flota y por celda de destino, con
diferencia 0 Wh (`tablas/exploracion/T16_comprobacion.csv`).

| Indicador (ajuste) | Valor | Fuente |
|---|---|---|
| Energía por viaje: mediana, P95 y máximo | 21,9, 70,0 y 246,6 Wh (3,8 %, 12,2 % y 42,8 % de la batería) | `T16_viaje_distribucion.csv` |
| Viajes de más de 576 Wh | 0 | ídem |
| Energía por patinete y día con viajes: media, P95 y máximo | 45,3, 122,9 y 298,1 Wh | `T16_patinete_dia_resumen.csv` |
| Patinete-día por encima del 50 / 80 / 100 % de la batería | 0,01 % / 0 % / 0 % | ídem |
| Ciclos equivalentes por patinete: media y máximo | 0,377 y 1,405 | `T16_patinete_resumen.csv` |
| Patinetes que agotarían la batería sin recargar | 1,4 % | ídem |
| Autonomía (batería / Wh medios por día en servicio): P10, mediana y P90 | 22,8, 45,6 y 145 días | ídem, figura `T16_distribuciones` |
| Flota: media y máximo diarios | **22,1 y 29,5 kWh/día** (38,3 y 51,3 cargas completas) | `T16_resumen.csv`, `T16_flota_diaria.csv`, figura `T16_flota_diaria` |
| Celda de destino de resolución 8: máximo y mediana | **0,90 y 0,13 kWh/día** | `T16_resumen.csv`, `T16_energia_celdas_top20.csv`, figura `T16_energia_celdas` |
| Energía que llega de 10 a 16 h / de 16 a 24 h / el resto del día | **33,53 % / 55,45 % / 11,02 %** | `T16_resumen.csv`, `T16_perfil_horario.csv`, figura `T16_perfil_horario` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Frecuencia de recarga | **Cada varios días** con el uso observado: ningún patinete-día pasa del 80 % de la batería y la autonomía mediana es de 45,6 días | `T16_patinete_dia_resumen.csv`, `T16_patinete_resumen.csv` | Ajuste | Supone la batería entera utilizable y llena en el primer viaje del periodo. Con una flota simulada menor cada patinete hará más viajes | Recalcular con la flota de T34; el estado de carga de T35 solo limitará si la flota baja mucho |
| Energía por estación | **De décimas de kWh a 1 kWh al día**: la celda de resolución 8 que más recibe llega a 0,90 kWh/día | `T16_energia_celdas_top20.csv` | Ajuste | Supone que se recarga donde se deja el patinete; una estación cubrirá menos área que una celda de resolución 8 | Fija la escala de PVWatts y de la batería en T52–T55 |
| Energía en horas de sol | Un tercio llega de 10 a 16 h y más de la mitad de 16 a 24 h | `T16_perfil_horario.csv` | Ajuste | Hora de llegada, no de carga | Con carga inmediata, la batería de la estación debe guardar unos dos tercios de la energía; la carga inteligente de T56 es la alternativa |

## T17. Meteorología y días anómalos (Alejandro)

Lluvia, temperatura y viento de Roma centro según la API histórica de Open-Meteo (modelo
`best_match`: ECMWF IFS, ERA5 y ERA5-Land; licencia CC BY 4.0), guardados en
`datos/externos/meteorologia/` con sus metadatos (`exploracion/T17_meteorologia.ipynb`).

| Indicador | Valor | Fuente |
|---|---|---|
| Lluvia en el ajuste / en la reservada | 75,7 mm en 6 días con más de 1 mm / 0 mm | `tablas/exploracion/T17_resumen.csv` |
| Temperatura media en el ajuste / en la reservada | 9,3 / 10,9 °C | ídem |
| Spearman viajes diarios–lluvia (n = 28) | −0,56 (laborables −0,59 con n = 20; fin de semana −0,46 con n = 8) | `T17_correlaciones.csv`, figura `T17_dispersion` |
| Spearman viajes diarios–temperatura media (n = 28) | 0,04 | ídem |
| Viajes en horas con lluvia frente a la misma hora y tipo de día sin lluvia (± 7 días) | 0,69 (laborables 0,88; fin de semana 0,49), en 42 horas | `T17_lluvia_horaria_resumen.csv` |
| Días por debajo del 70 % de la mediana de su tipo de día | Solo el **07/02**: 403 viajes (46,8 % de la mediana), con 24,6 mm y 21 horas de lluvia | `T17_dias_anomalos.csv`, figura `T17_viajes_lluvia` |
| Pendiente de los viajes diarios en el ajuste | 9,4 viajes/día cada día (error típico 4,9), un 8,3 % de la media por semana | `T17_tendencia.csv` |
| Pendiente en el mes, con fin de semana / añadiendo lluvia y temperatura | 10,5 (e. t. 3,0) / 7,5 (e. t. 2,4) viajes/día cada día | ídem |
| Cociente reservada / ajuste por día de la semana | 1,12–1,25; 1,182 en la semana | `T17_cociente_semana.csv` |
| Viento máximo diario medio en el ajuste / en la reservada | 18,3 / 13,5 km/h; racha máxima de la reservada 34,2 km/h | `T17_resumen.csv` |
| Spearman viajes–viento máximo en fin de semana (n = 8): simple / descontando la lluvia / quitando un día | −0,88 / −0,86 / de −0,82 a −0,93; viento y lluvia solo se asocian en 0,38 | `T17_viento_diario.csv`, figura `T17_viento` |
| Efecto de +10 km/h de viento en los viajes por hora, con la lluvia en el mismo modelo | Fin de semana −14 % entre días (IC 95 %: −23 a −5) y −16 % dentro del día; laborables −7 % y −4 %, sin diferencia clara con cero | `T17_viento_horario.csv` |
| Horas secas con ≥ 20 km/h frente a horas secas en calma (< 10 km/h) | Fin de semana 0,76 en 22 horas, todas del 13 y el 14/02 | `T17_viento_horas_secas.csv` |

Con 28 días, las correlaciones son orientativas. La celda del reanálisis está a 6,1 km del punto
pedido (`T17_resumen.csv`).

**Viento frente a lluvia (apartado 6 del notebook).** La asociación del viento con menos
viajes de fin de semana se mantiene al controlar la lluvia, la temperatura y la tendencia.
El resultado depende del episodio frío y ventoso del 13–14/02. El 14/02 tuvo 717 viajes
sin lluvia, frente a 889–1 048 en los fines de semana secos y en calma. El simulador
conserva la demanda observada y marca ese episodio y el 07/02 como tiempo adverso.

**Respuesta a la pregunta abierta sobre el 07/02 y el crecimiento.** La lluvia explica el 07/02 y parte del crecimiento: al
añadir lluvia y temperatura, la pendiente del mes baja de 10,5 a 7,5 viajes/día cada día, pero
no desaparece.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Excluir algún día? | **No excluir ninguno** de la localización ni de las matrices. El 07/02 (lluvia) y el 13–14/02 (viento fuerte y frío) son demanda real de tiempo adverso: se marcan y no se usan como días de diseño ni como días tipo | `T17_dias_anomalos.csv`, `T17_viento_fines_de_semana.csv` | Mes | Solo el 07/02 baja del 70 % de la mediana; el 13 y el 14/02 se quedan en el 82–83 % | Marcarlos como días de tiempo adverso en el simulador |
| ¿Entra el viento en el simulador? | Se conserva la demanda observada. Los 10 km/h adicionales se asocian con un 14 % menos de viajes de fin de semana en el modelo que controla la lluvia. | `T17_viento_diario.csv`, `T17_viento_horario.csv`, `T17_viento_horas_secas.csv` | Mes | Un episodio. Los errores típicos suponen horas independientes. | Marcar los días adversos para elegir jornadas representativas. |
| ¿Es comparable la semana reservada? | **Con cautela.** Tiene un 18,2 % más de viajes, no llovió, fue más cálida (10,9 °C frente a 9,3 °C) y con menos viento. El tiempo explica parte de la diferencia, no toda | `T17_resumen.csv`, `T17_tendencia.csv`, `T17_cociente_semana.csv` | Mes | n = 28 con cuatro variables | La validación de T30 es más exigente que el ajuste; hay que decirlo al presentarla |
| Restricciones por COVID en Lacio | No se afirma nada: no hemos podido leer el texto oficial de las medidas de febrero de 2021 | — | — | — | Pregunta abierta |

## T18. Tarifa e importe nominal

La tarifa de **1 € por desbloqueo y 0,15 €/min**, calculada sobre los segundos
registrados, reproduce los **25 186 precios** dentro de la tolerancia de T10.
Los 23 292 viajes elegibles suman **62 040,68 €** de los 76 419,57 € registrados.
El **18,8 % del importe bruto** queda en registros excluidos. Los 122 registros
de más de dos horas suman 10 335,96 €, la mayor parte de esa diferencia.
En el ajuste el importe elegible es de **2 104,70 €/día** y en la semana reservada
de **2 548,86 €/día**. Para comparar escenarios, se sumará el precio nominal de los
viajes elegibles atendidos. Los cobros, descuentos y costes quedan fuera de este cálculo.
[Notebook](../exploracion/T18_tarifa_ingresos.ipynb) · [Resumen](../resultados/tablas/exploracion/T18_resumen.csv)

## T19. Cierre de la exploración

Conclusiones preparadas para el seguimiento del 23/11. La fase de diseño usa la
limpieza principal y las decisiones de ajuste fijadas del 1 al 21 de febrero.
La semana del 22 al 28 queda reservada para evaluar las redes elegidas con las
mismas reglas y comparar a la vez volumen y cuotas.

| Decisión para las siguientes fases | Evidencia de la exploración | Aplicación en el diseño |
|---|---|---|
| Ajustar sobre **16 710** viajes y reservar **6 582** | T10 deja 23 292 viajes elegibles de 25 186. La limpieza permisiva altera poco las medianas y la concentración. | Mantener la limpieza principal y repetir la sensibilidad con los indicadores de la red elegida. |
| Modelar cinco franjas y dos tipos de día | T12 muestra perfiles de salida distintos. El máximo simultáneo observado fue de 41 viajes. | Separar perfiles del simulador. Calcular el stock y los anclajes por estación con la secuencia de salidas y llegadas. |
| Usar H3 de resolución 9 para emplazamientos y 8 para diagnóstico espacial | T13 sitúa la arista media de resolución 9 cerca de 201 m. T15 compara radios de 200, 250 y 300 m y añade 400 m como sensibilidad. | Construir T24 sobre el ajuste. Barrer los rangos de T13 con margen del 20 % y medir acceso en cada extremo del viaje. |
| Simular rebalanceo nocturno de 100 patinetes por día | T11 detecta recolocaciones y T14 encuentra saldos zonales persistentes. | Comparar 0, 100 y 220 movimientos con la misma red y medir rechazos, distancia y déficit residual. |
| Conservar los días de tiempo adverso | T17 identifica el 07/02 por lluvia y el 13–14/02 por viento y frío. La semana reservada tuvo un 18,2 % más de viajes diarios. | Marcar esos días al elegir jornadas representativas y mantenerlos en los recuentos. Evaluar la semana reservada con su demanda observada. |
| Mantener referencias de energía e importe por viaje | T16 estima 22,1 kWh/día de tracción con la flota observada en el ajuste. T18 verifica el precio nominal por desbloqueo y tiempo. | Recalcular las dos magnitudes sobre los viajes atendidos y usar la energía por estación para dimensionar la recarga. |

Los radios describen acceso geométrico. La elección de red exige comprobar rutas
a pie donde haya barreras, además de simular inventario. La comparación de la
semana reservada se hará después de congelar la localización y los criterios de
evaluación. [Parámetros](../config.yaml) · [Plan de movilidad](PLAN.md#4-movilidad-y-flota)

## T20. Primera matriz O-D en H3 (Alejandro)

Viajes elegibles del ajuste agregados por celda de origen y de destino de resolución 8
(`movilidad/T20_matrices_od.ipynb`).

| Indicador | Valor | Fuente |
|---|---|---|
| Celdas de origen / de destino / pares con viajes | 103 / 111 / 2 154 | `tablas/movilidad/T20_resumen.csv`, `T20_od_res8.csv` |
| Viajes que empiezan y acaban en la misma celda | **21,4 %** | ídem |
| Viajes en los 20 pares más frecuentes | 14,8 % | ídem, `T20_pares_top20.csv`, `T20_pares_top20_entre_celdas.csv` |
| Viajes entre las 30 celdas con más extremos | 51,0 % | ídem, `T20_celdas_top30.csv`, figura `figuras/movilidad/T20_od_top30` |
| Asimetría de los pares entre celdas distintas (Σ\|M − Mᵀ\| / viajes entre celdas) | 0,224, frente a 0,204 esperable por azar (cociente 1,10) | ídem, `T20_asimetria_pares_top10.csv` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Hay corredores asimétricos? | No: cada par es casi simétrico (1,10 veces lo esperable por azar). El saldo de T14 es la suma de muchos pares pequeños | `T20_resumen.csv` | Ajuste | Resolución 8 | El rebalanceo se plantea por zonas, no por corredores |
| Viajes intrazonales | El 21,4 % no sale de su celda de resolución 8 | ídem | Ajuste | Depende de la resolución | Con radios de 300 m o más, parte de ellos empezarían y acabarían en la misma estación |

## T21. Matrices OD por municipios y zonas urbanísticas

En febrero, **23 268 de 23 292 viajes elegibles** tienen ambos extremos asignados
en las dos divisiones de Istat. Las matrices completas incluyen los otros
24 viajes en la categoría «Sin asignar».

| División | Viajes dentro de la misma unidad | Proporción sobre viajes asignados |
|---|---:|---:|
| Municipio | 17 120 | 73,6 % |
| Zona urbanística | 9 731 | 41,8 % |
| H3, resolución 8 | 4 933 | 21,2 % |

El mayor flujo entre municipios va del **VII al I (748 viajes)** y el regreso
registra 707. El porcentaje intrazonal depende de la escala, por lo que conviene
usar los municipios para resumir los intercambios y las zonas urbanísticas o H3
para describir los desplazamientos locales. La asignación usa la cartografía
de Istat del 31/12/2021. [Notebook de T21](../movilidad/T21_matrices_od_administrativas.ipynb) · [Tablas](../resultados/tablas/movilidad)

## T22. Matrices OD por franja y tipo de día

Se generaron 90 matrices al cruzar tres divisiones territoriales, tres periodos,
cinco franjas de salida y dos tipos de día. En las tres divisiones se recuperan
los mismos totales por corte, incluidos los extremos sin asignar de T21.
La franja de 7 a 10 h del ajuste tiene **114,6 viajes por laborable** y **34,3
por día de fin de semana**. Se conservan perfiles separados para el simulador.
[Notebook de T22](../movilidad/T22_matrices_od_temporales.ipynb) · [Resumen por franja](../resultados/tablas/movilidad/T22_segmentos.csv)

## T23. Indicadores OD y líneas de deseo

En el ajuste, los diez pares de celdas con más viajes en ambos sentidos
concentran **el 10,6 %** de los viajes entre celdas H3. La asimetría agregada
es del **22,4 %** frente al **20,4 %** esperado si los dos sentidos de cada
par fueran equiprobables. El simulador podrá usar los saldos por par y franja
para estimar dónde y cuándo hace falta rebalancear. El mapa conecta los
centros de celda y ajusta el grosor al volumen total de ida y vuelta.
[Notebook de T23](../movilidad/T23_indicadores_lineas_deseo.ipynb) · [Indicadores por corte](../resultados/tablas/movilidad/T23_indicadores.csv)

## T24. Catálogo de candidatos para localización

Los **33 420 extremos** del ajuste se reparten en **600 celdas H3 de resolución 9**.
Siete centros caen en agua cartografiada y se sustituyen por el extremo observado
en tierra más cercano al centro de la misma celda. Las 600 posiciones pasan al
barrido. Hay **65** con avisos cartográficos, entre cercanía al río (20) y cercanía
a vías con restricciones (47), con dos coincidencias. La separación mínima
entre posiciones es de 236 m. El catálogo conserva las coordenadas originales,
la corrección y el estado de revisión urbana.
[Catálogo](../resultados/tablas/movilidad/T24_candidatos.csv) · [Fuente cartográfica](../datos/externos/osm/osm_roma_2026-11-19.meta.json)

## T25. Líneas base comparables en el ajuste

Se calcularon **118 redes** de K-medoids y K-means ajustado a candidatos, que
dan **166** evaluaciones al cruzar tamaños y radios. A 300 m con 141 estaciones,
K-medoids cubre ambos extremos del **58,6 %** de los viajes y K-means del
**58,4 %**. Con 207 estaciones la mejor de las dos redes llega al **75,6 %**.
El umbral del 80 % se alcanza desde 350 estaciones ensayadas a 200 m y desde
280 a 250 m con ambos métodos. El número de estaciones estimado por área en
T13 sirve para acotar el barrido. La cobertura conjunta de un viaje se mide
directamente sobre sus dos extremos y será el objetivo de la comparación de T26–T28.
[Barrido](../resultados/tablas/movilidad/T25_barrido.csv) · [Resumen](../resultados/tablas/movilidad/T25_resumen.csv) · [Redes](../resultados/tablas/movilidad/T25_redes.csv)

## Preguntas de la exploración ya respondidas

- ¿Coincide el saldo de T14 con las entregas netas del operador de T11? **Sí** (T14):
  Spearman de 0,89 y pendiente de 0,75; las recolocaciones compensan el 62,1 % del saldo.
  El rebalanceo nocturno es imprescindible en la simulación.
- ¿Explica la meteorología el 07/02 y el crecimiento del mes? **El 07/02 sí y el
  crecimiento solo en parte** (T17): el 07/02 tuvo 24,6 mm y 21 horas de lluvia, y la
  pendiente del mes baja de 10,5 a 7,5 viajes/día por día al añadir lluvia y temperatura.

## Preguntas de Alejandro: respuestas de Javier

1. **Parámetros en `config.yaml`.** Sí para los que usan varias tareas o las fases siguientes:
   `movilidad.resolucion_mapas` (8), `resolucion_candidatos` (9), `radios_acceso_m`
   ([200, 250, 300, 400], con 400 m solo como sensibilidad), `velocidad_pie_ms` (1,3, con su
   referencia), `factor_rodeo` (1,328, copiado de T15) y el rebalanceo de la pregunta 3. T13,
   T14, T15 y T20 ya los leen de ahí. El mínimo de 30 extremos del saldo, el umbral de lluvia de
   0,1 mm/h y las horas de sol de 10 a 16 h se quedan en los `PARAMETROS` de su notebook: solo
   los usa esa tarea, y en la fase 3 la producción fotovoltaica sale de PVWatts hora a hora.
2. **Rango de estaciones.** Sí. T25–T28 barren k dentro del rango de
   `T13_estaciones_orden_magnitud.csv` para cada radio (cuotas del 80 al 95 %): 230–387 con
   200 m, 147–248 con 250 m, 102–172 con 300 m y 58–97 con 400 m. Se amplía un 20 % por cada lado
   para que el óptimo no quede en el borde; si queda, se amplía más.
3. **Rebalanceo.** Sí: rebalanceo nocturno de 100 patinetes/día en el escenario base
   (`movilidad.rebalanceo_base_patinetes_dia`), que es la cota inferior de T14 en resolución 8.
   T33 lo compara con 0 y con 220 (la cota en resolución 9, `rebalanceo_sensibilidad_patinetes_dia`).
4. **07/02.** De acuerdo: no se excluye y no es día de diseño. El análisis del viento añade el 13 y
   el 14/02 con el mismo trato (ver T17).
5. **Semana reservada.** Las dos cosas, para cosas distintas. La localización y las matrices se
   validan con cuotas (reparto de viajes entre estaciones, pares y franjas), que no dependen del
   volumen. El volumen se compara tal cual y la diferencia (+18,2 %, sin lluvia, más cálida y con
   menos viento) se presenta como resultado: la validación es más exigente que el ajuste.
6. **COVID en Lacio.** De acuerdo: sin fuente oficial leída no se dice nada. En la memoria va
   como limitación (no se ha podido controlar el contexto sanitario del mes).
7. **Energía con la flota simulada.** Sí, pero no se rehace T16: T16 se queda como referencia
   con la flota observada. La energía con la flota y la ocupación simuladas sale de T34 y T35
   y la calculan T44–T45 (fase 2) antes de dimensionar la estación en la fase 3.
8. **Concentración.** Se unifica con la definición de T13: el 20 % de celdas es el menor número
   entero de celdas que llega al 20 %, `ceil(0,2 · n)`. T10 ya la usa: 23 de 111 celdas y
   56,9 % de los extremos (56,94 % con la limpieza permisiva).
