# Memoria y conclusiones

## Qué hay que hacer

- Redactar una memoria breve sobre los datos, los métodos, los resultados de movilidad, consumo y recarga, y las conclusiones (10 %).
- Justificar las decisiones de diseño con cifras y explicar los supuestos y limitaciones, como la ausencia de trayectorias y el alcance de un solo mes de observación.
- Citar el código en el texto y en la bibliografía. Verificar que las tablas y las [figuras](../resultados/figuras/README.md) coinciden con una ejecución en limpio.

## Qué debe incluir

- Los archivos fuente de la memoria, según el plan en LaTeX, y el PDF final `GZZ-P3.pdf`, donde `ZZ` es el número de grupo.
- Las referencias a los datos, los métodos y los programas utilizados. El comprimido de entrega reúne la memoria y la carpeta `GZZ-P3_code/` con los programas reproducibles, según el [enunciado](../docs/enunciado.md#entregable).

## Material de la fase 0 para la memoria

Propuesta de figuras y tablas de la exploración que entran en la memoria. Como dice el
[plan](../docs/PLAN.md#exploración-orientada-a-decisiones), solo entran las que justifican
una decisión; el resto se queda en los notebooks y en la
[web de resultados](https://javiersaguar.github.io/PIDS-Proyecto3/). Las rutas son relativas
a `resultados/` y las cifras están en [conclusiones_eda.md](../docs/conclusiones_eda.md).

| Apartado | Figura o tabla | Decisión que justifica |
|---|---|---|
| Datos y método | `tablas/exploracion/T10_embudo.csv` | Viajes elegibles: 23 292 de 25 186 |
| Datos y método | `figuras/exploracion/T10_umbrales` | Umbrales de 60 s, 100 m, 2 km/h, 25 km/h y 2 h |
| Datos y método | `figuras/exploracion/T12_calor_dia_hora` | Franjas horarias y tipos de día |
| Datos y método | `figuras/exploracion/T17_viajes_lluvia` | Periodos de ajuste y reservada; el 07/02 no se excluye |
| Movilidad | `figuras/exploracion/T13_densidad_res8` | Zona de candidatos y rejilla H3 de resolución 9 |
| Movilidad | `tablas/exploracion/T13_estaciones_orden_magnitud.csv` | Rango de número de estaciones del barrido |
| Movilidad | `figuras/exploracion/T15_radios_acceso` | Radios de 200, 250 y 300 m; 400 m como sensibilidad |
| Movilidad | `figuras/movilidad/T20_od_top30` | Matriz OD: 21,4 % de viajes intrazonales y pares casi simétricos |
| Movilidad (flota) | `figuras/exploracion/T11_parado` | El piloto recogía patinetes durante días, no rebalanceaba en el día |
| Movilidad (flota) | `figuras/exploracion/T14_saldo` y `T14_saldo_frente_operador` | Rebalanceo nocturno en el escenario base |
| Consumo | `tablas/exploracion/T16_resumen.csv` y `figuras/exploracion/T16_flota_diaria` | Energía de referencia de la flota: 22,1 kWh/día en el ajuste |
| Estación | `figuras/exploracion/T16_perfil_horario` | Dos tercios de la energía llegan sin sol: carga inteligente |
| Conclusiones | `tablas/exploracion/T17_tendencia.csv` | La semana reservada tiene un 18,2 % más de viajes: la validación es más exigente |

Antes de cerrar la memoria hay que volver a ejecutar `python ejecutar_todo.py` y comprobar
que estas cifras no cambian.
