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

De 25 186 viajes quedan **23 370 elegibles (92,8 %)**: 16 756 en el periodo de ajuste
(93,1 %) y 6 614 en la semana reservada (92,1 %). Ningún viaje se borra; los demás
llevan sus marcas en `motivo`.

- **Datos estructuralmente limpios.** No hay nulos, duplicados ni solapes del mismo
  patinete. La duración, la velocidad y el precio cuadran en todos los viajes: el precio
  es exactamente `1 € + 0,15 €/min` y la velocidad `3,6 · dis / tt`. Ningún extremo cae
  fuera de Roma. Por eso solo se excluyen viajes por umbrales de comportamiento.
- **Embudo** (`tablas/exploracion/T10_embudo.csv`):
  - 112 viajes de más de 2 h;
  - 2 de más de 25 km/h;
  - 949 de menos de 60 s;
  - 596 más de menos de 100 m;
  - 157 más de menos de 2 km/h.
- **El pico de ~1 000 viajes a casi 0 km/h** del histograma son desbloqueos sin viaje.
  Ya los quitan las reglas de duración y distancia: de los 976 viajes por debajo de
  1 km/h, 894 caen por ellas y 22 son viajes con paradas (punto siguiente). Los 157 que
  añade la regla `vel_baja` recorren poco (mediana de 318 m) y duran mucho para esa
  distancia: mediana de 19,7 min. Más que un desplazamiento en patinete, parecen un
  patinete que no se cerró a tiempo o que se llevó a mano
  (`tablas/exploracion/T10_viajes_lentos.csv`).
- **Viajes con paradas** (apartado 4 del notebook, `tablas/exploracion/T10_viajes_con_paradas.csv`,
  `figuras/exploracion/T10_viajes_con_paradas`). Al revisar los excluidos por `vel_baja`
  y `tt_largo` aparecen desplazamientos reales en los que el usuario mantiene la reserva
  mientras para (una tienda, un monumento). Un viaje de **al menos 1 km** puede
  incumplir **una** de las dos reglas, no las dos: si es lento, debe durar como mucho
  2 h; si es largo, ir a 2 km/h o más y durar como mucho 2,5 h
  (`limpieza.viaje_con_paradas` en `config.yaml`). Recupera **78 viajes** (+0,3 %):
  - 68 lentos que recorren lo mismo que un viaje normal (mediana de 1 636 m frente a
    1 634 m) y acaban a 782 m en línea recta del origen (el 62 % a más de 500 m), pero
    duran 91 min en vez de 8 y dan más rodeo (2,0 frente a 1,4);
  - 10 largos de 2 h 0 min a 2 h 7 min, con 4,1 a 12,6 km a entre 2 y 6 km/h.

  Los 52 viajes de al menos 1 km que son a la vez largos y lentos siguen fuera: duran
  4 h 27 min de mediana (hasta 143 h) a 0,6 km/h y la mitad acaba a menos de 500 m del
  origen. Sin trayectorias no se ven las paradas; la excepción se apoya en la distancia
  recorrida y en el desplazamiento entre origen y destino.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Duración mínima | 60 s | `figuras/exploracion/T10_umbrales`, `T10_sensibilidad_umbrales` | Ajuste | La curva sube sin codo; 60 s es el criterio natural de "menos de un minuto no es un viaje" y excluye por sí solo el 3,7 % | Ninguno |
| Distancia mínima | 100 m | Mismas figuras | Ajuste | Por debajo de 25 m está el salto principal (3,5 %); a partir de 100 m la curva es lineal | Ninguno |
| Velocidad mínima | 2 km/h (regla nueva `vel_baja`) | Histograma de velocidad: valle entre el pico de desbloqueos y la distribución principal | Ajuste | Sus orígenes y destinos son reales; se pierde el 0,7 % de la demanda | Se añade al contrato de limpieza |
| Excepción para viajes con paradas | Con al menos 1 km, un viaje puede incumplir 2 km/h o 2 h (hasta 2,5 h), no las dos: 78 viajes vuelven a ser elegibles | `tablas/exploracion/T10_viajes_con_paradas.csv`, `figuras/exploracion/T10_viajes_con_paradas` | Mes completo | 1 km es un criterio prudente, no un corte natural; con 500 m entrarían 49 viajes lentos más (+0,2 %). Sin trayectorias no se ven las paradas | Entra en el contrato de limpieza; todas las fases parten de 23 370 viajes |
| Velocidad máxima | 25 km/h | `T10_sensibilidad_umbrales` | Ajuste | Solo 2 viajes; límite del patinete | Ninguno |
| Duración máxima | 2 h | `T10_sensibilidad_umbrales` | Ajuste | La curva se aplana a partir de 2 h (0,29 % por encima) | Ninguno |
| ¿Dependen las conclusiones de los umbrales? | No: se usa la limpieza principal | `tablas/exploracion/T10_comparacion_limpiezas.csv`, `figuras/exploracion/T10_comparacion_limpiezas` | Ajuste y reservada | La variante permisiva (30 s, 50 m, sin velocidad mínima, 30 km/h, 3 h) deja un 2,5 % más de viajes en el ajuste; las medianas cambian menos del 3 %, los km un 0,3 % y la concentración espacial (56,9 % de los extremos en el 20 % de celdas H3 de resolución 8) es la misma | Repetir esta comparación con los indicadores de la red elegida |

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
  - Medido con cuotas en resolución 9, las 20 celdas con más entregas reciben el 25,4 % de ellas. Las 20 principales de las recogidas reúnen el 13,9 % y las de los orígenes elegibles, el 18,0 % (`T11_concentracion_res9.csv`, figura `T11_concentracion`). El 90,3 % de las entregas cae a menos de 300 m de la red principal (T30).
- **Viajes encadenados** (apartado 6). Son pares de viajes elegibles del mismo patinete en los que el segundo sale a menos de 50 m y como mucho 5 min después: hay 1 045, el 4,47 % de los elegibles.
  - No parecen trayectos partidos. El segundo sigue la dirección del primero en el 28,7 % de los pares y vuelve en el 47,3 %, frente a 20,3 % y 55,5 % en pares separados de 1 a 6 h. Uno de cada cinco es una ida y vuelta.
  - Las pausas dan un salto a los 20 min (145 pares de 20 a 21 min frente a 37–47 por minuto antes), seguramente por una regla de la aplicación.
  - Unirlos cambia la cobertura de la red en 0,2 puntos (T30) (`T11_encadenados.csv`, figura `T11_encadenados`).

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Umbral de recolocación | 200 m | `T11_saltos`, `T11_saltos_sensibilidad.csv` | Mes completo | Son indicios: puede haber viajes fuera de la muestra o deriva de GPS | Ninguno |
| ¿Rebalanceaba el piloto? | Sí, pero con recogidas de varios días, no dentro del día | `T11_resumen.csv`, `T11_parado` | Mes completo | No hay registros del operador | El escenario de rebalanceo de la fase 1 se plantea nocturno; con estaciones de recarga desaparecen las recogidas para cargar |
| Saldo del operador por zona | Contrastar con el saldo de T14 | `T11_celdas_res8.csv` | Mes completo | Resolución 8 | Las celdas donde el operador entrega más son candidatas a más stock inicial |
| Viajes encadenados (≤ 50 m, ≤ 5 min) | Se mantienen como viajes separados | `T11_encadenados.csv`, `T30_robustez_encadenados.csv` | Mes completo | Sin identificador de usuario no se sabe si es la misma persona | Ninguno: la cobertura de la red cambia 0,2 puntos si se unen |

## T12. Patrones temporales y viajes simultáneos (Javier)

- **Volumen.**
  - 797,9 viajes al día de media en el ajuste y 944,9 en la semana reservada (+18 %).
  - La tendencia en el ajuste es de +9,4 viajes al día por cada día (`tablas/exploracion/T12_resumen.csv`, `figuras/exploracion/T12_serie_diaria`).
  - El día con menos viajes es el domingo 07/02 (403), pendiente de la meteorología de T17.
- **Laborable frente a fin de semana.**
  - El volumen diario es el mismo (799,7 frente a 793,5), pero cambia la forma.
  - El laborable tiene una punta de mañana de 7 a 10 h (14,3 % de los viajes frente al 4,3 %) y su máximo a las 18 h.
  - El fin de semana concentra más en la punta de tarde (43,2 % frente a 38,0 %) y su máximo es a las 16 h.
  - Los dos perfiles difieren en un 12,0 % de los viajes (distancia de variación total) (`T12_perfil_horario`, `T12_calor_dia_hora`, `tablas/exploracion/T12_franjas.csv`).
- **Viajes simultáneos.**
  - Como mucho hay **41 viajes en curso a la vez** en el ajuste (06/02 a las 17:10) y 44 en la semana reservada.
  - El percentil 99 por minuto es 26 (`T12_simultaneos`).
  - Cada día se usan de media 487,8 patinetes distintos (máximo 633) de los 2 305 que aparecen en viajes elegibles.
- **Noche y toque de queda** (apartado 5). En febrero de 2021 rigió en toda Italia un toque de queda de 22 a 5 h. Solo se podía salir por trabajo, necesidad o salud: DPCM de 14/01/2021, art. 1, apartado 3 (GU Serie Generale n.º 11 de 15/01/2021, supl. ord. n.º 2).
  - Solo el 2,47 % de las salidas es de 22 a 5 h.
  - De 21 a 22 h las salidas caen un 60,0 % (de 985 a 394), frente al 30,1 % de 20 a 21 h. 172 viajes empiezan antes de las 22 h y acaban después (`T12_noche.csv`, figura `T12_noche`).

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Franjas horarias | Madrugada 0–7, punta de mañana 7–10, mediodía 10–16, punta de tarde 16–20, noche 20–24 | `T12_perfil_horario`, `T12_franjas.csv` | Ajuste | Las provisionales encajan con los cambios del perfil; se fijan como definitivas | Ninguno: ya están en `config.yaml` |
| Tipos de día | Separar laborable y fin de semana en las matrices OD y en el simulador | `T12_perfil_horario`, `T12_calor_dia_hora` | Ajuste | Solo hay 6 días de fin de semana en el ajuste | Ninguno |
| Cota inferior de la flota | 41 patinetes (máximo de viajes en curso) | `T12_simultaneos_diarios.csv` | Ajuste | Es una cota muy floja | El tamaño de flota lo decidirá dónde hacen falta patinetes, no cuántos se usan a la vez: la simulación de inventario por estación es la que manda |
| Comparabilidad de la semana reservada | Tiene un 18 % más de demanda | `T12_viajes_diarios.csv` | Ambos | Crecimiento de un mes de invierno | La validación temporal es más exigente que un simple reparto aleatorio; decirlo en la memoria |
| Demanda nocturna | Es la de un mes con toque de queda de 22 a 5 h: no se extrapola | `T12_noche.csv`, DPCM 14/01/2021 | Mes completo | No hay un mes sin restricciones para comparar | Limitación en la memoria; la estación nocturna recibe poca energía en este escenario |

## T13. Densidad de orígenes y destinos (Alejandro)

Viajes elegibles del ajuste (16 756) con el origen y el destino en celdas H3
(`exploracion/T13_densidad.ipynb`).

| Resolución | Área media | Arista media | Celdas con demanda | Mediana de extremos por celda | Celdas para el 50 / 80 / 90 / 95 % de los extremos | Extremos en el 10 / 20 % de celdas más usadas |
|---|---|---|---|---|---|---|
| 8 | 0,74 km² | 531 m | 111 | 191 | 19 / 45 / 60 / 72 | 37,8 % / 56,9 % |
| 9 | 0,105 km² | 201 m | 600 | 32 | 94 / 226 / 312 / 381 | 37,2 % / 58,1 % |

Fuentes: `tablas/exploracion/T13_resoluciones_h3.csv`, `T13_concentracion.csv` y
`T13_densidad_celdas.csv`; figuras `figuras/exploracion/T13_densidad_res8` y `T13_concentracion`.

- **Estabilidad.** La correlación de Spearman entre las cuotas por celda del ajuste y de la
  semana reservada es 0,98 en resolución 8 y 0,92 en resolución 9. El 99,98 % y el 99,80 % de
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
| ¿Está la demanda limitada por la oferta? | **No en las celdas con más salidas.** En las 30 principales de resolución 9, la mediana del tiempo sin ningún patinete esperando es del 5,7 % de 8 a 21 h (máximo 26,5 %). Las celdas con más salidas se vacían menos (Spearman −0,44). La flota está en viaje el 0,27 % del tiempo, con 1,64 viajes por patinete activo y día | `T13_oferta_celdas.csv`, figura `T13_oferta` | Ajuste | Cota superior: no cuenta los patinetes recién entregados. 20 de las 100 celdas analizadas pasan más del 25 % del tiempo vacías | La demanda observada es la de diseño; en las celdas periféricas puede estar recortada (limitación) |

## T14. Saldo neto por zona (Alejandro)

Saldo O − D por celda de resolución 8 en el ajuste (`exploracion/T14_saldo.ipynb`). Solo cuentan
las celdas con al menos 30 extremos: 90 de 111, con el 99,34 % de los extremos. Si una celda
estuviera equilibrada, cada extremo sería origen o destino al 50 % y `saldo_rel` tendría una
desviación típica de 1/√n, que con n = 30 es 0,18; por debajo, el ruido domina.

- **Emisoras y receptoras.** 42 celdas emisoras, 45 receptoras y 3 equilibradas; 14 tienen un
  desequilibrio mayor que dos desviaciones típicas del caso equilibrado (`T14_resumen.csv`,
  `T14_saldo_celdas.csv`, figura `T14_saldo`).
- **Persistencia.** En las 10 celdas con más saldo absoluto, el saldo acumulado tiene el mismo
  signo que el total en el 81–100 % de los días (el 100 % en ocho de ellas): crece sin volver a
  cero (`T14_persistencia.csv`, figura `T14_saldo_acumulado`).
- **Cota inferior del rebalanceo** (suma de |saldo| de todas las celdas cada día, entre 2):
  - resolución 8: **101,5 patinetes/día de media y 138 como máximo** (12,8 % de los viajes);
  - resolución 9: 221,6 y 285,5 (28,1 %);
  - la parte estructural (saldo del periodo repartido por día) es de 42,9 y 100,5
    patinetes/día (`T14_resumen.csv`, `T14_rebalanceo_diario.csv`).
- **Franjas.** En la punta de mañana el flujo neto desplaza 29,8 patinetes/día, el 32,4 % de
  sus salidas; mediodía y punta de tarde desplazan 28,3 y 29,1, pero solo el 9,9 % y el 9,2 %
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
| Zonas con más anclajes (receptoras) | La principal es `881e8052adfffff` (41,905 N, 12,480 E; entre San Pedro y Termini, al norte del Coliseo), con −3,6 patinetes/día | `T14_saldo_celdas.csv`, figura `T14_saldo` | Ajuste | Celdas de 0,74 km² | Más anclajes libres que stock inicial en T32 |
| Zonas con más stock inicial (emisoras) | La principal es `881e805089fffff` (41,874 N, 12,522 E; al sureste del Coliseo), con +3,9 patinetes/día, y varias celdas del sur | ídem | Ajuste | ídem | Más stock inicial en T32 |
| Franjas del desequilibrio | Sobre todo la punta de mañana, en proporción a sus salidas; el desequilibrio se invierte por la tarde | `T14_desequilibrio_franjas.csv` | Ajuste | El saldo diario esconde la inversión | El simulador debe trabajar por franjas o en continuo |

## T15. Recorridos y radios de acceso (Alejandro)

Viajes elegibles del ajuste (`exploracion/T15_recorridos.ipynb`).

| Variable | P5 | P25 | Mediana | P75 | P95 | P99 |
|---|---|---|---|---|---|---|
| Distancia recorrida (m) | 349 | 896 | 1 619 | 2 794 | 5 187 | 7 467 |
| Duración (s) | 121 | 279 | 490 | 860 | 1 699 | 2 979 |
| Velocidad media (km/h) | 5,0 | 9,3 | 12,5 | 15,3 | 18,5 | 20,3 |
| Distancia en línea recta (m) | 107 | 497 | 947 | 1 708 | 3 307 | 4 806 |

Fuentes: `tablas/exploracion/T15_distribuciones.csv` y figura `figuras/exploracion/T15_distribuciones`.
Las medianas por franja y tipo de día están en `T15_medianas_franja_tipo_dia.csv`.

- **Rodeo** (`dis_m` / línea recta, viajes con línea recta de 200 m o más): mediana **1,329**,
  P25 1,185, P75 1,654 y P95 4,57, en 15 258 viajes (`T15_resumen.csv`, figura `T15_rodeo`).
- **Viajes circulares** (línea recta < 100 m y `dis_m` ≥ 500 m): 602, el **3,59 %**.
- **Radios de acceso.** Caso peor: R en cada extremo; caso medio: 2R/3 en cada extremo. Ambos
  por el rodeo y a 1,3 m/s (`T15_radios_acceso.csv`, figura `T15_radios_acceso`):

| R | Andar tarda más que el viaje, caso peor | Ídem, caso medio | `dis_m` ≤ 2R | Andar todo el trayecto es más rápido, caso medio |
|---|---|---|---|---|
| 150 m | 28,91 % | 15,15 % | 3,65 % | 29,57 % |
| 200 m | 41,31 % | 24,89 % | 6,62 % | 34,12 % |
| 250 m | 52,46 % | 33,41 % | 9,64 % | 38,57 % |
| 300 m | 60,45 % | 41,31 % | 13,11 % | 43,57 % |
| 400 m | 72,87 % | 55,17 % | 21,23 % | 52,25 % |
| 500 m | 81,30 % | 64,98 % | 28,91 % | 59,63 % |

Velocidad a pie: 1,3 m/s, dentro del rango de 1,24–1,43 m/s de velocidad normal de los adultos
de 20 a 69 años recogido por Bohannon, R. W. y Andrews, A. W. (2011), «Normal walking speed: a
descriptive meta-analysis», *Physiotherapy* 97(3), 182–189,
[doi:10.1016/j.physio.2010.12.004](https://doi.org/10.1016/j.physio.2010.12.004). Es una hipótesis.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Factor de rodeo | 1,329 como hipótesis para pasar de línea recta a distancia andando | `T15_resumen.csv`, figura `T15_rodeo` | Ajuste | Es el rodeo del patinete, no el del peatón; la cola larga son paseos. T29 lo contrastará con la red peatonal | Las distancias de acceso de T25–T28 pueden multiplicarse por este factor |
| Radios del barrido | **Mantener 200 y 300 m, añadir 250 m y dejar 400 m como sensibilidad.** Con 400 m, en el caso medio el 55,17 % de los viajes tardaría más andando a las estaciones que en el propio viaje, y el 21,23 % recorre menos de 2R | `T15_radios_acceso.csv` | Ajuste | Velocidad a pie como hipótesis; compara tiempos, no la utilidad de cada usuario | `movilidad.radios_acceso_m` pasaría a [200, 250, 300, 400] |
| Demanda que deja de tener sentido con estaciones | En el caso medio, el 24,89 % de los viajes con 200 m y el 41,31 % con 300 m; andar todo el trayecto sería más rápido en el 34,12 % y el 43,57 % | `T15_radios_acceso.csv` | Ajuste | Los paseos (rodeo alto) inflan el último indicador | Informar la cobertura junto con la demanda que seguiría usando el servicio |
| Viajes circulares | 3,59 % de los viajes empezarían y acabarían en la misma estación | `T15_resumen.csv` | Ajuste | Umbrales de la tarea | El simulador debe admitir origen y destino iguales |

## T16. Energía de referencia por patinete y día (Alejandro)

Modelo del enunciado: `energia_wh = 13,5 × dis_m / 1000`, con batería de 576 Wh
(`exploracion/T16_energia_referencia.ipynb`). Un viaje de 2 km da 27 Wh. La suma por viaje coincide
con la suma por patinete, por patinete y día, por día de la flota y por celda de destino, con
diferencia 0 Wh (`tablas/exploracion/T16_comprobacion.csv`).

| Indicador (ajuste) | Valor | Fuente |
|---|---|---|
| Energía por viaje: mediana, P95 y máximo | 21,9, 70,0 y 246,6 Wh (3,8 %, 12,2 % y 42,8 % de la batería) | `T16_viaje_distribucion.csv` |
| Viajes de más de 576 Wh | 0 | ídem |
| Energía por patinete y día con viajes: media, P95 y máximo | 45,4, 123,4 y 298,1 Wh | `T16_patinete_dia_resumen.csv` |
| Patinete-día por encima del 50 / 80 / 100 % de la batería | 0,01 % / 0 % / 0 % | ídem |
| Ciclos equivalentes por patinete: media y máximo | 0,378 y 1,405 | `T16_patinete_resumen.csv` |
| Patinetes que agotarían la batería sin recargar | 1,4 % | ídem |
| Autonomía (batería / Wh medios por día en servicio): P10, mediana y P90 | 22,8, 45,3 y 145 días | ídem, figura `T16_distribuciones` |
| Flota: media y máximo diarios | **22,1 y 29,6 kWh/día** (38,4 y 51,4 cargas completas) | `T16_resumen.csv`, `T16_flota_diaria.csv`, figura `T16_flota_diaria` |
| Celda de destino de resolución 8: máximo y mediana | **0,90 y 0,13 kWh/día** | `T16_resumen.csv`, `T16_energia_celdas_top20.csv`, figura `T16_energia_celdas` |
| Energía que llega de 10 a 16 h / de 16 a 24 h / el resto del día | **33,53 % / 55,47 % / 11,00 %** | `T16_resumen.csv`, `T16_perfil_horario.csv`, figura `T16_perfil_horario` |
| Modelo físico en llano y sin aceleraciones (97,5 kg; rodadura 0,010–0,020; área·Cd 0,40–0,70 m²) | 4,7–11,8 Wh/km; caso central 7,0 Wh/km a la velocidad media de cada viaje y 9,0 Wh/km a 20 km/h | `T16_modelo_fisico.csv`, figura `T16_modelo_fisico` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Frecuencia de recarga | **Cada varios días** con el uso observado: ningún patinete-día pasa del 80 % de la batería y la autonomía mediana es de 45,3 días | `T16_patinete_dia_resumen.csv`, `T16_patinete_resumen.csv` | Ajuste | Supone la batería entera utilizable y llena en el primer viaje del periodo. Con una flota simulada menor cada patinete hará más viajes | Recalcular con la flota de T34; el estado de carga de T35 solo limitará si la flota baja mucho |
| Energía por estación | **De décimas de kWh a 1 kWh al día**: la celda de resolución 8 que más recibe llega a 0,90 kWh/día | `T16_energia_celdas_top20.csv` | Ajuste | Supone que se recarga donde se deja el patinete; una estación cubrirá menos área que una celda de resolución 8 | Fija la escala de PVWatts y de la batería en T52–T55 |
| Energía en horas de sol | Un tercio llega de 10 a 16 h y más de la mitad de 16 a 24 h | `T16_perfil_horario.csv` | Ajuste | Hora de llegada, no de carga | Con carga inmediata, la batería de la estación debe guardar unos dos tercios de la energía; la carga inteligente de T56 es la alternativa |
| Consumo de referencia | **Se mantienen 13,5 Wh/km**, por encima de todos los casos del modelo físico en llano: es conservador | `T16_modelo_fisico.csv` | Ajuste | Parámetros supuestos; sin pendientes ni aceleraciones | El modelo completo es el de T41–T43 |

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
| Viajes en horas con lluvia frente a la misma hora y tipo de día sin lluvia (± 7 días) | 0,69 (laborables 0,88; fin de semana 0,48), en 42 horas | `T17_lluvia_horaria_resumen.csv` |
| Días por debajo del 70 % de la mediana de su tipo de día | Solo el **07/02**: 403 viajes (46,6 % de la mediana), con 24,6 mm y 21 horas de lluvia | `T17_dias_anomalos.csv`, figura `T17_viajes_lluvia` |
| Pendiente de los viajes diarios en el ajuste | 9,4 viajes/día cada día (error típico 4,9), un 8,3 % de la media por semana | `T17_tendencia.csv` |
| Pendiente en el mes, con fin de semana / añadiendo lluvia y temperatura | 10,6 (e. t. 3,0) / 7,6 (e. t. 2,5) viajes/día cada día | ídem |
| Cociente reservada / ajuste por día de la semana | 1,13–1,25; 1,184 en la semana | `T17_cociente_semana.csv` |
| Viento máximo diario medio en el ajuste / en la reservada | 18,3 / 13,5 km/h; racha máxima de la reservada 34,2 km/h | `T17_resumen.csv` |
| Spearman viajes–viento máximo en fin de semana (n = 8): simple / descontando la lluvia / quitando un día | −0,88 / −0,86 / de −0,82 a −0,93; viento y lluvia solo se asocian en 0,38 | `T17_viento_diario.csv`, figura `T17_viento` |
| Efecto de +10 km/h de viento en los viajes por hora, con la lluvia en el mismo modelo | Fin de semana −14 % entre días (IC 95 %: −23 a −5) y −16 % dentro del día; laborables −7 % y −4 %, sin diferencia clara con cero | `T17_viento_horario.csv` |
| Horas secas con ≥ 20 km/h frente a horas secas en calma (< 10 km/h) | Fin de semana 0,76 en 22 horas, todas del 13 y el 14/02 | `T17_viento_horas_secas.csv` |

Con 28 días, las correlaciones son orientativas. La celda del reanálisis está a 6,1 km del punto
pedido (`T17_resumen.csv`).

**Viento frente a lluvia (apartado 6 del notebook).** La asociación del viento con menos
viajes de fin de semana se mantiene al controlar la lluvia, la temperatura y la tendencia.
El resultado depende del episodio frío y ventoso del 13–14/02. El 14/02 tuvo 721 viajes
sin lluvia, frente a 889–1 048 en los fines de semana secos y en calma. El simulador
conserva la demanda observada y marca ese episodio y el 07/02 como tiempo adverso.

**Respuesta a la pregunta abierta sobre el 07/02 y el crecimiento.** La lluvia explica el 07/02 y parte del crecimiento: al
añadir lluvia y temperatura, la pendiente del mes baja de 10,6 a 7,6 viajes/día cada día, pero
no desaparece.

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Excluir algún día? | **No excluir ninguno** de la localización ni de las matrices. El 07/02 (lluvia) y el 13–14/02 (viento fuerte y frío) son demanda real de tiempo adverso: se marcan y no se usan como días de diseño ni como días tipo | `T17_dias_anomalos.csv`, `T17_viento_fines_de_semana.csv` | Mes | Solo el 07/02 baja del 70 % de la mediana; el 13 y el 14/02 se quedan en el 82–83 % | Marcarlos como días de tiempo adverso en el simulador |
| ¿Entra el viento en el simulador? | Se conserva la demanda observada. Los 10 km/h adicionales se asocian con un 14 % menos de viajes de fin de semana en el modelo que controla la lluvia. | `T17_viento_diario.csv`, `T17_viento_horario.csv`, `T17_viento_horas_secas.csv` | Mes | Un episodio. Los errores típicos suponen horas independientes. | Marcar los días adversos para elegir jornadas representativas. |
| ¿Es comparable la semana reservada? | **Con cautela.** Tiene un 18,4 % más de viajes, no llovió, fue más cálida (10,9 °C frente a 9,3 °C) y con menos viento. El tiempo explica parte de la diferencia, no toda | `T17_resumen.csv`, `T17_tendencia.csv`, `T17_cociente_semana.csv` | Mes | n = 28 con cuatro variables | La validación de T30 es más exigente que el ajuste; hay que decirlo al presentarla |
| Restricciones por COVID | Toque de queda nacional de 22 a 5 h todo el mes (DPCM de 14/01/2021, art. 1.3), igual en el ajuste y en la reservada | Texto del DPCM en la Gazzetta Ufficiale; `T12_noche.csv` | Mes | Solo se ha leído el toque de queda, no el resto de medidas de la zona de Lacio | Limitación de la noche en la memoria (T12) |
| Zona horaria de los datos | **Local (Europe/Rome)**. La caída de salidas más fuerte es de 21 a 22 h, cuando empieza el toque de queda. Desplazar la lluvia ±1 h no distingue: el 78,6 % de las horas con lluvia sigue lloviendo la hora siguiente | `T12_noche.csv`, `T17_desfase_lluvia.csv`, figura `T17_desfase_lluvia` | Mes | La prueba de la lluvia no discrimina | Ninguno |

## T18. Tarifa e importe nominal

La tarifa de **1 € por desbloqueo y 0,15 €/min**, calculada sobre los segundos
registrados, reproduce los **25 186 precios** dentro de la tolerancia de T10.
Los 23 370 viajes elegibles suman **63 205,67 €** de los 76 419,57 € registrados.
El **17,3 % del importe bruto** queda en registros excluidos. Los 122 registros
de más de dos horas suman 10 335,96 €; 10 de ellos son viajes con paradas y siguen
siendo elegibles.
En el ajuste el importe elegible es de **2 138,77 €/día** y en la semana reservada
de **2 613,07 €/día**. Para comparar escenarios, se sumará el precio nominal de los
viajes elegibles atendidos. Los cobros, descuentos y costes quedan fuera de este cálculo.
[Notebook](../exploracion/T18_tarifa_ingresos.ipynb) · [Resumen](../resultados/tablas/exploracion/T18_resumen.csv)

## T19. Cierre de la exploración

Conclusiones preparadas para el seguimiento del 23/11. La fase de diseño usa la
limpieza principal y las decisiones de ajuste fijadas del 1 al 21 de febrero.
La semana del 22 al 28 queda reservada para evaluar las redes elegidas con las
mismas reglas y comparar a la vez volumen y cuotas.

| Decisión para las siguientes fases | Evidencia de la exploración | Aplicación en el diseño |
|---|---|---|
| Ajustar sobre **16 756** viajes y reservar **6 614** | T10 deja 23 370 viajes elegibles de 25 186. La limpieza permisiva altera poco las medianas y la concentración. | Mantener la limpieza principal y repetir la sensibilidad con los indicadores de la red elegida. |
| Modelar cinco franjas y dos tipos de día | T12 muestra perfiles de salida distintos. El máximo simultáneo observado fue de 41 viajes. | Separar perfiles del simulador. Calcular el stock y los anclajes por estación con la secuencia de salidas y llegadas. |
| Usar H3 de resolución 9 para emplazamientos y 8 para diagnóstico espacial | T13 sitúa la arista media de resolución 9 cerca de 201 m. T15 compara radios de 200, 250 y 300 m y añade 400 m como sensibilidad. | Construir T24 sobre el ajuste. Barrer los rangos de T13 con margen del 20 % y medir acceso en cada extremo del viaje. |
| Simular rebalanceo nocturno de 100 patinetes por día | T11 detecta recolocaciones y T14 encuentra saldos zonales persistentes. | Comparar 0, 100 y 220 movimientos con la misma red y medir rechazos, distancia y déficit residual. |
| Conservar los días de tiempo adverso | T17 identifica el 07/02 por lluvia y el 13–14/02 por viento y frío. La semana reservada tuvo un 18,4 % más de viajes diarios. | Marcar esos días al elegir jornadas representativas y mantenerlos en los recuentos. Evaluar la semana reservada con su demanda observada. |
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
| Celdas de origen / de destino / pares con viajes | 103 / 111 / 2 157 | `tablas/movilidad/T20_resumen.csv`, `T20_od_res8.csv` |
| Viajes que empiezan y acaban en la misma celda | **21,4 %** | ídem |
| Viajes en los 20 pares más frecuentes | 14,8 % | ídem, `T20_pares_top20.csv`, `T20_pares_top20_entre_celdas.csv` |
| Viajes entre las 30 celdas con más extremos | 51,0 % | ídem, `T20_celdas_top30.csv`, figura `figuras/movilidad/T20_od_top30` |
| Asimetría de los pares entre celdas distintas (Σ\|M − Mᵀ\| / viajes entre celdas) | 0,223, frente a 0,204 esperable por azar (cociente 1,09) | ídem, `T20_asimetria_pares_top10.csv` |
| Cambio del reparto entre pares del ajuste a la reservada (TVD) | 27,4 %, frente a 21,9 % solo por azar (+5,5 puntos). Entre semanas del ajuste, de +4,7 a +7,6 puntos. El 94,1 % de los viajes de la reservada va por pares ya vistos | `T20_estabilidad_pares.csv`, figura `T20_estabilidad_pares` |

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| ¿Hay corredores asimétricos? | No: cada par es casi simétrico (1,09 veces lo esperable por azar). El saldo de T14 es la suma de muchos pares pequeños | `T20_resumen.csv` | Ajuste | Resolución 8 | El rebalanceo se plantea por zonas, no por corredores |
| Viajes intrazonales | El 21,4 % no sale de su celda de resolución 8 | ídem | Ajuste | Depende de la resolución | Con radios de 300 m o más, parte de ellos empezarían y acabarían en la misma estación |
| Estabilidad de los pares | La reservada cambia lo mismo que dos semanas del ajuste: no es especial, pero cada par por separado es sobre todo ruido | `T20_estabilidad_pares.csv` | Ajuste y reservada | Una sola semana de validación | La red se valida con extremos y cobertura OD; las matrices se usan agregadas (T21–T22) |

## T21. Matrices OD por municipios y zonas urbanísticas

En febrero, **23 346 de 23 370 viajes elegibles** tienen ambos extremos asignados
en las dos divisiones de Istat. Las matrices completas incluyen los otros
24 viajes en la categoría «Sin asignar».

| División | Viajes dentro de la misma unidad | Proporción sobre viajes asignados |
|---|---:|---:|
| Municipio | 17 184 | 73,6 % |
| Zona urbanística | 9 769 | 41,8 % |
| H3, resolución 8 | 4 954 | 21,2 % |

El mayor flujo entre municipios va del **VII al I (749 viajes)** y el regreso
registra 707. El porcentaje intrazonal depende de la escala, por lo que conviene
usar los municipios para resumir los intercambios y las zonas urbanísticas o H3
para describir los desplazamientos locales. La asignación usa la cartografía
de Istat del 31/12/2021. [Notebook de T21](../movilidad/T21_matrices_od_administrativas.ipynb) · [Tablas](../resultados/tablas/movilidad)

## T22. Matrices OD por franja y tipo de día

Se generaron 90 matrices al cruzar tres divisiones territoriales, tres periodos,
cinco franjas de salida y dos tipos de día. En las tres divisiones se recuperan
los mismos totales por corte, incluidos los extremos sin asignar de T21.
La franja de 7 a 10 h del ajuste tiene **114,7 viajes por laborable** y **34,5
por día de fin de semana**. Se conservan perfiles separados para el simulador.
[Notebook de T22](../movilidad/T22_matrices_od_temporales.ipynb) · [Resumen por franja](../resultados/tablas/movilidad/T22_segmentos.csv)

## T23. Indicadores OD y líneas de deseo

En el ajuste, los diez pares de celdas con más viajes en ambos sentidos
concentran **el 10,6 %** de los viajes entre celdas H3. La asimetría agregada
es del **22,3 %** frente al **20,4 %** esperado si los dos sentidos de cada
par fueran equiprobables. El simulador podrá usar los saldos por par y franja
para estimar dónde y cuándo hace falta rebalancear. El mapa conecta los
centros de celda y ajusta el grosor al volumen total de ida y vuelta.
[Notebook de T23](../movilidad/T23_indicadores_lineas_deseo.ipynb) · [Indicadores por corte](../resultados/tablas/movilidad/T23_indicadores.csv)

## T24. Catálogo de candidatos para localización

Los **33 512 extremos** del ajuste se reparten en **600 celdas H3 de resolución 9**.
Siete centros caen en agua cartografiada y se sustituyen por el extremo observado
en tierra más cercano al centro de la misma celda. Las 600 posiciones pasan al
barrido. Hay **65** con avisos cartográficos, entre cercanía al río (20) y cercanía
a vías con restricciones (47), con dos coincidencias. La separación mínima
entre posiciones es de 236 m. El catálogo conserva las coordenadas originales,
la corrección y el estado de revisión urbana.
La ficha cartográfica muestra el contorno de la celda, las coordenadas de cálculo,
la distancia al candidato vecino y la vía con nombre más próxima en la cartografía.
El mapa de detalle amplía la celda desplazada con mayor demanda y une el centro H3
con la posición propuesta. Las marcas de proximidad orientan la revisión sobre el terreno.
[Catálogo](../resultados/tablas/movilidad/T24_candidatos.csv) · [Mapa de T24](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t24) · [Fuente cartográfica](../datos/externos/osm/osm_roma_2026-11-19.meta.json)

## T25. Líneas base comparables en el ajuste

Se calcularon **118 redes** de K-medoids y K-means ajustado a candidatos, que
dan **166** evaluaciones al cruzar tamaños y radios. A 300 m con 141 estaciones,
K-medoids cubre ambos extremos del **60,8 %** de los viajes y K-means del
**58,4 %**. Con 207 estaciones la mejor de las dos redes llega al **75,9 %**.
El umbral del 80 % se alcanza desde 340 estaciones ensayadas a 200 m con K-medoids
(350 con K-means) y desde 290 a 250 m con ambos métodos. El número de estaciones estimado por área en
T13 sirve para acotar el barrido. La cobertura conjunta de un viaje se mide
directamente sobre sus dos extremos y será el objetivo de la comparación de T26–T28.
La superposición de los métodos muestra los emplazamientos compartidos y exclusivos
para cada radio y tamaño. Los gráficos distinguen viajes con ambos extremos cubiertos,
uno solo y ninguno. Para cada red se asigna cada extremo a su estación más cercana
y se publican los conteos por estación de los viajes con cobertura completa. La suma
de salidas y la de llegadas coinciden por separado con el total de viajes cubiertos.
[Barrido](../resultados/tablas/movilidad/T25_barrido.csv) · [Redes](../resultados/tablas/movilidad/T25_redes.csv) · [Comparación 3D](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/localizacion)

## T26. Mínimo de estaciones para cubrir viajes completos

Se exigen **13 405 de los 16 756 viajes** del ajuste. Las variables binarias
abren emplazamientos de T24. Cada grupo OD cuenta en proporción a su
multiplicidad si se abre al menos un candidato de su conjunto de origen y
uno de su conjunto de destino. Se valida cada solución factible sobre los
viajes originales.

Se comparte una variable por conjunto de acceso, se relajan las aperturas a
fracciones y se verifica la cota dual con aritmética entera. Esto acota el
mínimo por abajo. La solución factible lo acota por arriba. La auditoría
aplica ambos criterios al catálogo existente y a la demanda de ajuste.

| Radio | Voraz por extremos | Cota inicial | Cota auditada | Factible | Margen sobre 13 405 viajes |
|---:|---:|---:|---:|---:|---:|
| 200 m | 293 | 289 | 289 | 289 | +10 |
| 250 m | 228 | 224 | 224 | 225 | +7 |
| 300 m | 163 | 62 | 154 | 159 | +4 |
| 400 m (sensibilidad) | 87 | 33 | 78 | 86 | +73 |

El mínimo está certificado a 200 m. A 300 m, **154–159 estaciones** deja por
resolver hasta cinco estaciones y muestra lo cerca que la solución queda
del umbral de demanda. [Auditoría](../resultados/tablas/movilidad/T26_certificados.csv) · [T26 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t26)

## T27. Cobertura y distancias con presupuesto fijo

MCLP maximiza el recuento de viajes completos para un número fijo de estaciones.
La p-mediana minimiza la distancia media ponderada por la demanda de las
celdas. Su cota relaja las asignaciones lejanas y el coste factible usa la
distancia completa. La comparación vuelve a medir todos los métodos sobre
los mismos extremos originales. El P90 del cuadro incluye extremos de
viajes fuera de radio.

| Método a 300 m y 159 estaciones | Viajes completos en ajuste | Cobertura | P90 de acceso |
|---|---:|---:|---:|
| MCLP | 13 409 | 80,03 % | 309,8 m |
| Voraz por extremos | 13 230 | 78,96 % | 310,2 m |
| P-mediana | 11 656 | 69,56 % | 374,8 m |

MCLP recupera **179 viajes completos** frente al voraz. La mejor red MCLP
conocida en ese presupuesto cubre 13 409 y la cota dual auditada limita el
máximo a 13 603, una diferencia de 194 viajes. La web permite repetir la
comparación para cada presupuesto ensayado y consultar el desglose en cero,
uno y dos extremos cubiertos. [Resultados](../resultados/tablas/movilidad/T27_resultados.csv) · [Cotas de MCLP](../resultados/tablas/movilidad/T27_certificados.csv) · [T27 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t27)

## T28. Frente de Pareto y elección

Una red del frente carece de otra alternativa evaluada que iguale o mejore
estaciones, viajes completos y P90 y mejore estrictamente alguno. La regla
compara los radios de 200, 250 y 300 m. Entre las redes que cubren al menos
el 80 % elige por menos estaciones, menor P90, más viajes cubiertos y menor radio.

| Finalista congelada | Estaciones | Radio | Cobertura de ajuste | P90 |
|---|---:|---:|---:|---:|
| Elegida (LSCP) | 159 | 300 m | 80,03 % | 309,8 m |
| Menos estaciones (MCLP) | 158 | 300 m | 79,79 % | 310,4 m |
| Menor radio (LSCP) | 225 | 250 m | 80,04 % | 265,1 m |

Las dos primeras redes factibles publicadas difieren en 39 viajes completos.
La opción de 250 m requiere 66 estaciones adicionales y reduce el P90 en
44,6 m. El objetivo interactivo se aplica a las redes ya ensayadas en el ajuste.
Las ubicaciones de las tres redes constan en una tabla que se verifica por
huella antes de la evaluación temporal. [Barrido](../resultados/tablas/movilidad/T28_comparacion.csv) · [Emplazamientos](../resultados/tablas/movilidad/T28_estaciones.csv) · [T28 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t28)

## T29. Cuánto acceso se pierde al caminar

| Periodo | Viajes comparables | En recta | A pie | Cambio | Pierde origen | Pierde destino | Pierde ambos |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ajuste | 969 | 86,0 % | 44,5 % | −41,5 pp | 149 | 172 | 81 |
| Semana reservada | 431 | 82,4 % | 44,3 % | −38,1 pp | 66 | 62 | 36 |

Los dos extremos del viaje deben caer en el mismo núcleo. Se excluyeron de los
porcentajes emparejados 6 viajes del ajuste y 2 de la semana reservada por falta
de dos rutas medibles. También se publica la cobertura peatonal verificable
sobre todos los viajes del sector. El grafo respeta sentidos peatonales y
restricciones explícitas. Los conectores de hasta 60 m evitan cruzar ejes de río
y ferrocarril. Se usa cartografía archivada de noviembre de 2026 para evaluar
la demanda observada de febrero de 2021. Los resultados peatonales corresponden
a estos dos sectores. Las columnas de pérdida clasifican exclusivamente a los viajes
cubiertos en recta que rebasan el radio al medir calles.

El P90 a pie del ajuste es **412,7 m**, frente a 285,6 m en recta. Al variar el
umbral entre 200 y 400 m sobre la misma red y los mismos 969 viajes comparables,
la cobertura a pie va del 14,6 % al 78,2 %. En la semana reservada Termini baja
del 75,8 % al 30,2 % a 300 m, frente al 87,1 % al 54,6 % en Tíber. Estas dos
muestras muestran la sensibilidad a barreras locales. [Prueba peatonal](../resultados/tablas/movilidad/T30_validacion_peatonal.csv) · [Curvas](../resultados/tablas/movilidad/T30_sensibilidad_peatonal.csv) · [T29 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t29) · [Mapa 3D](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/validacion)

## T30. Transferencia a la semana reservada

En toda Roma, con las mismas 159 estaciones y 300 m de radio, se pasa de
**13 409 de 16 756 (80,03 %)** a **5 001 de 6 614 (75,61 %)**. La caída es
de 4,41 pp con 18,4 % más de viajes diarios y el P90 sube de 309,8 a 329,4 m.
Los siete días de reserva quedan por debajo del 80 %. El 26/02 presenta la
menor cobertura, **72,94 % sobre 1 094 viajes**.

Se divide el cambio según tipo de día y franja T12. Para cada grupo se
multiplica el cambio de peso por su cobertura media y el cambio de
cobertura por su peso medio. Las contribuciones se suman para recuperar la
caída total. En esta muestra, **−0,03 pp** se asocian a cambios de mezcla
horaria y **−4,38 pp** a diferencias de cobertura dentro de las franjas.
La comparación es descriptiva y corresponde a una semana. La proximidad
de las estaciones se evalúa antes de modelar patinetes y anclajes disponibles.
**Robustez.** Si se unen los viajes encadenados de T11, la cobertura pasa del 80,03 % al 80,22 % en el ajuste y del 75,61 % al 75,87 % en la reservada. El 90,3 % de las entregas del operador queda a menos de 300 m de una estación, frente al 89,9 % de los orígenes y al 80,7 % de las recogidas (`T30_robustez_encadenados.csv`, `T30_entregas_operador.csv`).
[Cobertura diaria](../resultados/tablas/movilidad/T30_cobertura_diaria.csv) · [Desglose por franja](../resultados/tablas/movilidad/T30_cobertura_franjas.csv) · [Descomposición](../resultados/tablas/movilidad/T30_efectos_temporales.csv) · [T30 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t30)

## T32. Stock inicial y anclajes por estación

El simulador (`movilidad/inventario.py`) procesa las solicitudes del ajuste en orden
temporal, con las llegadas antes que las salidas del mismo segundo. Acepta un viaje si hay
patinete en el origen y reserva el anclaje de destino hasta que llega. Si la estación más
cercana no sirve, desvía a la siguiente dentro de los 300 m. Cada noche, a las 4 h, recoloca
como mucho 100 patinetes hacia el stock inicial. Diez casos pequeños comprueban las reglas
(`movilidad/test_inventario.py`). Cada simulación verifica la conservación de patinetes, la
capacidad y un único resultado por solicitud.

| Diseño (cuantil de los días) | Patinetes de diseño | Anclajes | Atendidos (100 por noche) |
|---|---:|---:|---:|
| P75 | 343 | 684 | 90,37 % |
| P85 | 412 | 836 | 94,24 % |
| **P90 (elegido)** | **474** | **966** | **95,94 %** |
| P95 | 549 | 1 121 | 97,40 % |
| P100 | 699 | 1 443 | 98,95 % |

- Con el criterio fijado (menor cuantil que atiende el 95 % de los viajes cubiertos con el
  rebalanceo base) sale el P90. Las estaciones tienen de 2 a 11 anclajes (mediana 6).
- Con esos anclajes, la curva de T34 da la flota adoptada: **400 patinetes**. Se reparten en
  proporción al stock de diseño (474) y cada estación empieza el día con 1 a 6 (mediana 2).
  Las cifras siguientes son con esta flota.
- Sin rebalanceo, no quedarse nunca sin patinetes exigiría 1 556 patinetes y 3 123 anclajes.
  Ni el P100 llega al 95 % (90,11 %). Con 220 recolocaciones el P90 solo sube al 96,61 %.
- Se atiende el 95,09 % de los viajes cubiertos. Se rechazan 472 por falta de patinete y
  187 por falta de anclaje. 298 se desvían, con 85 m de más de media; sin desvío se
  atendería el 92,96 %.
- El límite de 100 se agota en 16 de las 20 noches (unos 121 km por noche). Cada patinete
  hace 1,52 viajes al día y está en viaje el 1,2 % del tiempo.
- En la semana reservada, la misma red y flota atienden el 93,38 % de los 5 001 viajes
  cubiertos (94,18 % con los 474 de diseño).

| Decisión | Valor propuesto | Evidencia | Periodo | Limitaciones | Qué cambia en el plan |
|---|---|---|---|---|---|
| Stock y anclajes por estación | Anclajes del P90 diario (966); stock inicial = 400 patinetes repartidos en proporción al P90 | `T32_dimensionado.csv`, `T32_estaciones.csv` | Ajuste | Duración observada; desvíos en línea recta; los rechazados no se repiten | T31, T33, T34 y consumo leen `T32_estaciones.csv` |
| Rebalanceo base | 100 por noche; 220 apenas mejora con estos anclajes | `T32_noches.csv` | Ajuste | Política voraz hacia el stock inicial | T33 compara políticas y kilómetros |

[Catálogo](../resultados/tablas/movilidad/T32_estaciones.csv) · [Barrido](../resultados/tablas/movilidad/T32_dimensionado.csv) · [Semana reservada](../resultados/tablas/movilidad/T32_reservada.csv) · [T32 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t32)

## T34. Curva de flota frente a nivel de servicio (Alejandro)

Con la red y los 966 anclajes de T32 fijos, se barre la flota de 150 a 900 patinetes de 25
en 25, repartida en proporción al stock de diseño, con 0, 100 y 220 recolocaciones por noche.
Criterio: la menor flota que atiende el 95 % de los viajes cubiertos con 100 por noche.

| Flota | Atendidos (100 por noche) | Sin patinete | Sin anclaje | Viajes por patinete y día |
|---:|---:|---:|---:|---:|
| 375 | 94,48 % | 592 | 148 | — |
| **400 (adoptada)** | **95,09 %** | **472** | **187** | **1,52** |
| 475 (máximo) | 95,92 % | 237 | 310 | 1,29 |
| 600 | 93,30 % | 90 | 809 | — |
| 700 | 87,67 % | 21 | 1 632 | — |

- **Se adopta la flota de 400 patinetes**: es lo que da el criterio y lo que pide el
  enunciado (la menor flota con el mayor uso). El diseño de 474 queda como alternativa con
  más margen si crece la demanda.
- El servicio tiene un máximo: con más patinetes las estaciones se llenan. Flota y anclajes
  se dimensionan juntos. Sin rebalanceo, el máximo es el 85,74 % (525 patinetes).
- En la semana reservada: 93,38 % con 400 y 94,18 % con 474. Ninguno llega al 95 %.
- T34 comprueba que la flota de T32 (`FLOTA`) sigue siendo la mínima; si cambian los
  anclajes, se detiene y pide cambiarla.

[Curva](../resultados/tablas/movilidad/T34_curva_flota.csv) · [Comparación](../resultados/tablas/movilidad/T34_comparacion.csv) · [T34 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t34)

## T31. Asignación de viajes a estaciones y matriz estación → estación (Alejandro)

- Cada viaje va a la estación más cercana a 300 m o menos de cada extremo; la simulación de
  T32 con 400 patinetes da su resultado y su estación real. Se atienden 12 750 de las 16 756
  solicitudes (76,1 %); las cuentas cuadran con T32.
- Acceso medio en línea recta: 162 m en el origen y 163 m en el destino (P90 de 264 m); a
  pie, unos 215 m.
- La matriz está muy repartida: 4 090 pares con viajes (16,2 % de los posibles), los diez más
  fuertes suman el 4,0 % y el 12,3 % de los viajes vuelve a su estación. Asimetría del 38,4 %
  frente al 34,6 % del azar.
- En los laborables, el saldo de mañana y el de tarde tienen un Spearman de −0,40: la
  compensación dentro del día es parcial y el resto lo corrige el rebalanceo.
- Los 659 rechazos están repartidos: las diez estaciones con más suman el 17,5 %.
- La tabla por viaje (`datos/procesados/T31_asignacion.parquet`) es la entrada de consumo.

[Matriz](../resultados/tablas/movilidad/T31_matriz_estaciones.csv) · [Estaciones](../resultados/tablas/movilidad/T31_estaciones.csv) · [T31 en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t31)

## T33. Política y coste del rebalanceo nocturno

Se fijan flota, anclajes, red, demanda y corte a las 04:00 de Roma. El límite de
100 procede del orden de magnitud de T14 en resolución 8. Los límites 0 y 220
miden el efecto de prescindir del traslado y el de usar la cota aproximada de
resolución 9. La política por déficit atiende primero el mayor faltante. La
alternativa marginal repone primero donde la proporción de días de ajuste en
que faltaría la siguiente unidad es mayor, según la trayectoria de saldo
ideal. Ambas toman el donante con excedente más cercano. El beneficio estimado
sirve para ordenar movimientos y el servicio se vuelve a medir con restricciones.

| Política y límite | Atendidos en ajuste | km equivalentes en ajuste | Atendidos en reserva | km equivalentes en reserva |
|---|---:|---:|---:|---:|
| Sin movimientos | 11 379 | 0 | 4 302 | 0 |
| Mayor déficit, 100 | 12 750 | 2 416,84 | 4 670 | 806,32 |
| Beneficio marginal, 100 | 12 756 | 2 430,25 | 4 674 | 730,44 |
| Mayor déficit, 220 | 12 790 | 2 988,91 | 4 681 | 985,91 |
| Beneficio marginal, 220 | 12 790 | 2 909,82 | 4 681 | 935,33 |

Se conserva **mayor déficit con límite de 100**. Es la combinación que menos
kilómetros requiere entre las que superan el 95 % de los 13 409 viajes
cubiertos del ajuste. Con 220 y la misma regla se recuperan 40 viajes en el
ajuste y 11 en reserva, a cambio de 572,08 y 179,59 km adicionales. La regla
marginal a 100 merece una prueba operativa por el ahorro de distancia en reserva.
Sin embargo, su mejora de servicio es pequeña y en esa semana deja 10,17
patinetes por reponer por noche frente a 9,33. La distancia publicada suma
traslados individuales con el rodeo de T15. La ruta del vehículo, sus tiempos
de carga y la agrupación de traslados requieren datos logísticos. [Comparación](../resultados/tablas/movilidad/T33_politicas.csv) · [Noches y causas de rechazo](../resultados/tablas/movilidad/T33_noches.csv) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t33)

## T35. Si la carga limita los viajes

Cada unidad parte con 576 Wh. Se usa la distancia registrada y los 13,5 Wh/km
del Modelo A. Mientras ocupa un anclaje recarga a 576 Wh / 7 h en el lado batería.
La unidad elegida es la menos cargada entre las suficientes, para conservar
opciones para viajes más largos. Se comprueba el caso físicamente mínimo
(energía del propio viaje) y una reserva de fin de viaje del 20 % como
sensibilidad operativa. Las recolocaciones transportan la carga de la unidad.
El balance suma energía repuesta y déficit final y coincide con la tracción.

Los dos casos con carga conservan los **12 750 y 4 670 viajes atendidos** y
registran **cero rechazos por batería**. Con reserva del 20 %, la tracción es
349,535 y 131,301 kWh en los dos periodos y quedan 0,107 y 0,067 kWh por
reponer al final. Se conserva una política de despacho con comprobación de
energía para la futura integración. La prueba supone carga disponible en cada
anclaje y stock inicialmente cargado. La potencia de suministro, las pérdidas
del cargador y las políticas FV se evaluarán en recarga. [Energía por viaje](../resultados/tablas/consumo/T40_energia_viaje.csv) · [Simulación y balance](../resultados/tablas/movilidad/T35_carga.csv) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t35)

## T36. Evidencia de cobertura y flujos en 3D

La vista de la red elegida alterna cobertura OD y servicio por celda H3 de
origen, además de flujos dirigidos de la simulación. El denominador de cada
celda es sus salidas elegibles. Los flujos de la tabla incluyen circulares y
concuerdan con las llegadas y salidas por estación. Se dibujan los flujos más
frecuentes entre estaciones distintas para mantener legible la vista al
alejarla. La selección de una estación muestra sus principales entradas y
salidas. Cambiar de periodo mantiene los emplazamientos. [Celdas](../resultados/tablas/movilidad/T36_cobertura_operativa.csv) · [Flujos](../resultados/tablas/movilidad/T36_flujos_operativos.csv) · [Mapa de operación](https://javiersaguar.github.io/PIDS-Proyecto3/#/mapa/validacion/ajuste/ambos/lscp_r300_k159/operacion)

## T37. Acceso de las zonas peor cubiertas

Se mide cobertura OD por zona urbanística de origen de T21. El mínimo de
100 salidas en el ajuste acota en cinco puntos el error estándar binomial
máximo de la tasa como referencia descriptiva. Entre las zonas elegibles se
fija el cuartil inferior, ocho zonas, con el mismo peso por zona. Se evalúa
cada intercambio de un emplazamiento abierto y otro del catálogo T24, se
elige el de mayor mejora media y se protege la cobertura global habitual.
El límite de cinco sustituciones acota el cambio de infraestructura y
facilita contrastarlo con la variante de redundancia. La búsqueda es local.

| Periodo | Salidas en las ocho zonas | Cubiertas habitual → territorial | Media por zona habitual → territorial |
|---|---:|---:|---:|
| Ajuste | 1 655 | 842 → 912 | 51,95 % → 57,45 % |
| Reservada | 700 | 327 → 366 | 45,61 % → 51,92 % |

En la reserva, con 159 estaciones y 300 m, se ganan **6,31 pp de media**
y 39 viajes completos en las zonas prioritarias. En toda Roma, la variante
cubre 19 viajes adicionales y atiende 14 más en reserva. En ajuste atiende
9 menos que la habitual y reduce de 2 003 a 1 784 los viajes con dos opciones
por extremo. La variante es útil si se prioriza acceso territorial y se
mantiene como alternativa por ese compromiso. La demanda observada por
origen y la cobertura geométrica son el alcance del indicador. [Resultados por zona](../resultados/tablas/movilidad/T37_zonas.csv) · [Intercambios](../resultados/tablas/movilidad/T37_T38_intercambios.csv) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t37)

## T38. Cinco cierres críticos

La franja de punta de T12 es 16:00–20:00. El 06/02 maximiza los viajes
cubiertos del ajuste en esa franja. Se toman los cinco sitios con más
viajes que dependen de ellos como única opción en origen o destino. Se
prueba cada fallo por separado el 06/02 y el 27/02, mismo día de la semana.
Se suspenden las asignaciones nuevas en el sitio cerrado, se conservan
las devoluciones reservadas y se permiten desvíos dentro del radio. Cada
red tiene su propio control sin cierre con los mismos recursos.

La variante conserva los cinco sitios y el objetivo del 80 % en ajuste.
Dentro de ese límite se aceptan dos sustituciones que mejoran el recuento
de viajes con dos opciones en cada extremo. Pasa de 2 003 a 2 040 en ajuste
y de 798 a 801 en reserva. La pérdida neta sumada de los cinco casos
durante la punta pasa de 52 a 51 en ajuste y **se mantiene en 48 en reserva**.
En reserva, el receptor de devoluciones desviadas de uno de los cierres
pasa del 0 % al 54,24 % de la ventana lleno, contando reservas. La
redundancia global probada no justifica cambiar la red de referencia.
La pérdida de la semana completa, los metros de desvío y la concentración
vecina quedan desglosados por cierre. [Casos completos](../resultados/tablas/movilidad/T38_cierres.csv) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t38)

## T39. Redes comparables para operación y recarga

Se ensayan las tres finalistas y las dos variantes con **400 patinetes,
966 anclajes y hasta 100 movimientos al corte**. En las alternativas se
aseguran dos plazas por estación y se reparte el resto según el excedente
de capacidad P90 del ajuste. El stock se reparte según la necesidad de
diseño con el tope de plazas. Dos plazas permiten partir de una recogida
y una devolución posibles en la misma estación.

| Red | Atendidos en ajuste | Atendidos en reserva | kWh/día en reserva | Pico simultáneo en reserva (kW) | Cuota de las 10 primeras en reserva |
|---|---:|---:|---:|---:|---:|
| Elegida | 12 750 | 4 670 | 18,76 | 3,46 | 16,82 % |
| Menos estaciones | 12 710 | 4 669 | 18,75 | 3,46 | 16,77 % |
| Menor radio | 12 148 | 4 370 | 17,50 | 3,47 | 15,04 % |
| Territorial | 12 741 | 4 684 | 19,06 | 3,57 | 16,33 % |
| Redundante | 12 735 | 4 677 | 18,79 | 3,47 | 16,69 % |

Se calcula el solape de cada sesión equivalente en intervalos de 15 minutos
desde la devolución. Los kWh por estación suman la energía de los viajes
atendidos. La potencia se expresa en el lado batería. El mayor pico
individual de la red habitual es 0,48 kW en reserva. La red habitual
atiende más viajes en ajuste bajo las reglas comparadas y pasa a recarga
como referencia. Las diferencias de demanda eléctrica de otras redes
deben leerse junto con los cambios de servicio. [Redes](../resultados/tablas/movilidad/T39_redes.csv) · [Estaciones](../resultados/tablas/movilidad/T39_estaciones.csv) · [Web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/t39)

## Cierre de la fase 1

Se adopta la red de **159 estaciones con radio geométrico de 300 m,
400 patinetes, 966 anclajes y un máximo de 100 traslados nocturnos**.
La localización alcanza el 80 % en ajuste con el menor presupuesto
factible ensayado. T32 dimensiona el stock y las plazas por estación y
T34 fija la menor flota probada que supera el 95 % de servicio entre
viajes cubiertos en ajuste. El contraste de políticas de T33 conserva
esa referencia por sus kilómetros equivalentes.

En la reserva, **5 001 de 6 614** solicitudes tienen cobertura geométrica
y se atienden **4 670** en la simulación (**70,61 % de todas las solicitudes,
93,38 % de las cubiertas**). En los sectores medidos a pie, la cobertura
pareada en reserva es 44,3 %. Esas tres métricas responden a alcance
geométrico, servicio con recursos limitados y acceso por calles en una
muestra local, respectivamente.

La red territorial queda como alternativa cuantificada y los cierres
muestran dónde los rodeos y las plazas vecinas siguen siendo limitantes.
La fase de Consumo recibe la energía por viaje y la asignación operativa
de T31–T32. La fase de Recarga recibe energía de tracción agregada por
estación y los picos equivalentes, y dimensionará potencia y energía
del lado de la instalación. [Notebook de reproducción](../movilidad/T33_T39_cierre.ipynb) · [Conclusiones en la web](https://javiersaguar.github.io/PIDS-Proyecto3/#/fase1/decisiones)

## Preguntas de la exploración ya respondidas

- ¿Coincide el saldo de T14 con las entregas netas del operador de T11? **Sí** (T14):
  Spearman de 0,89 y pendiente de 0,75; las recolocaciones compensan el 62,1 % del saldo.
  El rebalanceo nocturno es imprescindible en la simulación.
- ¿Explica la meteorología el 07/02 y el crecimiento del mes? **El 07/02 sí y el
  crecimiento solo en parte** (T17): el 07/02 tuvo 24,6 mm y 21 horas de lluvia, y la
  pendiente del mes baja de 10,6 a 7,6 viajes/día por día al añadir lluvia y temperatura.
- ¿Recorta la falta de patinetes la demanda observada? **No donde está la mayoría de los viajes** (T13): las celdas con más salidas pasan sin patinetes una mediana del 5,7 % de las horas de día, y es una cota superior.
- ¿Hay trayectos partidos en dos viajes? **Pocos** (T11): de los 1 045 pares encadenados, solo unos 90 siguen la dirección del primero más de lo esperable, y unirlos no cambia la red (T30).
- ¿Están las horas en hora local? **Sí** (T12 y T17): la mayor caída de salidas coincide con el toque de queda de las 22 h.

## Preguntas de Alejandro: respuestas de Javier

1. **Parámetros en `config.yaml`.** Sí para los que usan varias tareas o las fases siguientes:
   `movilidad.resolucion_mapas` (8), `resolucion_candidatos` (9), `radios_acceso_m`
   ([200, 250, 300, 400], con 400 m solo como sensibilidad), `velocidad_pie_ms` (1,3, con su
   referencia), `factor_rodeo` (1,329, copiado de T15) y el rebalanceo de la pregunta 3. T13,
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
   volumen. El volumen se compara tal cual y la diferencia (+18,4 %, sin lluvia, más cálida y con
   menos viento) se presenta como resultado: la validación es más exigente que el ajuste.
6. **COVID en Lacio.** Ya hay fuente oficial: el DPCM de 14/01/2021 (art. 1.3) fija el toque de queda
   nacional de 22 a 5 h durante todo el mes. T12 lo muestra en la demanda nocturna. En la memoria va
   como limitación: la noche observada no se extrapola a un mes sin restricciones.
7. **Energía con la flota simulada.** Sí, pero no se rehace T16: T16 se queda como referencia
   con la flota observada. La energía con la flota y la ocupación simuladas sale de T34 y T35
   y la calculan T44–T45 (fase 2) antes de dimensionar la estación en la fase 3.
8. **Concentración.** Se unifica con la definición de T13: el 20 % de celdas es el menor número
   entero de celdas que llega al 20 %, `ceil(0,2 · n)`. T10 ya la usa: 23 de 111 celdas y
   56,9 % de los extremos (56,94 % con la limpieza permisiva).
