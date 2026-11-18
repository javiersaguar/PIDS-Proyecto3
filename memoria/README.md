# Memoria y conclusiones

## Qué hay que hacer

- Redactar una memoria breve sobre los datos, los métodos, los resultados de movilidad, consumo y recarga, y las conclusiones (10 %).
- Justificar las decisiones de diseño con cifras y explicar los supuestos y limitaciones, como la ausencia de trayectorias y el alcance de un solo mes de observación.
- Citar el código en el texto y en la bibliografía. Verificar que las tablas y las [figuras](../resultados/figuras/README.md) coinciden con una ejecución en limpio.

## Qué debe incluir

- Los archivos fuente de la memoria, según el plan en LaTeX, y el PDF final `G02-P3.pdf` (somos el grupo 2; el enunciado lo llama `GZZ-P3.pdf`).
- Las referencias a los datos, los métodos y los programas utilizados. El comprimido de entrega reúne la memoria y la carpeta `G02-P3_code/` con los programas reproducibles, según el [enunciado](../docs/enunciado.md#entregable).

## Cómo se compila

La memoria está en LaTeX y se compila a PDF con un solo comando, desde la raíz del
repositorio y con el `.venv` activado:

```
python memoria/compilar.py
```

El script hace dos cosas:

1. `memoria/generar_cifras.py` lee las tablas de `resultados/tablas/` y escribe
   `memoria/generado/`: `cifras.tex` (cada número del texto como `\cifra{clave}`) y las
   tablas generadas. **En la memoria no se escribe ningún número a mano**: si cambia un
   resultado, se vuelve a ejecutar `python ejecutar_todo.py` y después este script, y la
   memoria cuenta lo mismo que los notebooks.
2. `latexmk -pdf` compila `memoria.tex` con pdflatex y biber (bibliografía en
   `referencias.bib`, estilo IEEE). Los ficheros intermedios van a `memoria/build/`, que no
   se versiona, y el PDF se copia a `memoria/G<grupo>-P3.pdf`. El número de grupo está en
   `config.yaml` (`entrega.grupo: "02"`), así que el PDF es `memoria/G02-P3.pdf`.

Hace falta una distribución de LaTeX con `latexmk`, `pdflatex` y `biber` (MiKTeX o TeX Live)
y los paquetes `carlito`, `babel-spanish`, `biblatex-ieee`, `booktabs`, `makecell`,
`placeins` y `float`. Las figuras se toman en PDF de `resultados/figuras/`.

| Fichero | Contenido |
|---|---|
| `memoria.tex` | Texto de la memoria |
| `referencias.bib` | Bibliografía: código del repositorio, datos, Open-Meteo, ERA5, programas y artículos |
| `generar_cifras.py` | Cifras y tablas desde `resultados/tablas/` |
| `compilar.py` | Genera las cifras y compila el PDF |
| `generado/` | Salida de `generar_cifras.py` (versionada para poder compilar sin Python) |
| `G02-P3.pdf` | Última versión compilada |

Formato: Calibri 11 (aquí Carlito, que tiene las mismas medidas), interlineado 1,15 y
márgenes de 2 cm (la plantilla de la asignatura usa 2,5 cm; se cambia en la línea de
`geometry` de `memoria.tex`).

Estructura, la de la plantilla de la asignatura con los apartados del cuerpo que pide el
[plan](../docs/PLAN.md#9-memoria-y-entrega):

- Portada, respuesta a la revisión anterior, reparto del trabajo, estado de la versión,
  índice, índice de figuras e índice de tablas (no cuentan para el límite de páginas).
- Cuerpo: introducción (contexto y objetivos), datos y método (datos, fases, reproducibilidad,
  limpieza y supuestos), exploración orientada a decisiones, movilidad, consumo, estación de
  recarga, conclusiones y limitaciones y trabajo futuro.
- Referencias y anexos: A, tablas extensas; B, figuras adicionales de la exploración; C,
  fragmentos de código (solo si son imprescindibles).

Los apartados sin resultados todavía llevan `\pendiente{...}` (texto gris) con lo que
contendrán y las tareas de [TAREAS.md](../docs/TAREAS.md) que los cubren; al rellenarlos se
quita esa línea. El cuerpo se queda con las cifras y figuras que justifican cada decisión; el
detalle va a los anexos, que la plantilla avisa que pueden no leerse.

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
| Datos y método | `figuras/exploracion/T17_viento` | El viento reduce los viajes del fin de semana por sí mismo; el 13–14/02 no son días de diseño |
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
