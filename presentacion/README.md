# Presentación y defensa

## Qué hay que hacer

- Preparar la defensa desde los resultados verificados de la [memoria](../memoria/README.md). Explicar el problema, qué datos hay y cómo se diseñaron la red de estaciones, la flota y la recarga.
- Seleccionar los mapas, gráficas y cifras que ayuden a justificar las decisiones y a explicar las principales limitaciones.
- Ensayar la [demo 3D](../docs/PLAN.md#8-demo-3d-para-la-defensa) con un día de operación. Comparar las redes, mostrar qué ocurre cuando una estación queda indisponible y abrir la maqueta para explicar el balance de recarga.
- Ensayar la defensa en equipo para que ambos miembros puedan explicar el proyecto completo y responder preguntas.

## Qué debe incluir

- El PDF final de la presentación y los archivos fuente de las diapositivas si se editan dentro del repositorio.
- Las diapositivas deben mostrar la red propuesta, los anclajes y la flota, el consumo estimado y el diseño fotovoltaico y de batería de la estación elegida. Usar las [figuras generadas](../resultados/figuras/README.md).
- El guion, las instrucciones para abrir la compilación local de la demo y un vídeo breve de respaldo. Usar el mismo escenario y los mismos resultados en las diapositivas y en la demo.

## Diapositivas

Las diapositivas están en [diapositivas/](diapositivas/): una aplicación React con animaciones (`motion`) que lee las mismas tablas y datos que exportan los notebooks, así que sus cifras cambian con ellos.

```
cd presentacion/diapositivas
npm install
npm run dev     # presentación en el navegador: flechas, espacio o clic para avanzar; «f», pantalla completa
npm run pdf     # compila y guarda presentacion/presentacion.pdf (una página por diapositiva)
```

`scripts/datos.mjs` reúne las cifras en `public/datos.json` desde `resultados/tablas/` y `frontend/public/datos/`. `scripts/pdf.mjs` abre la compilación en Chrome sin ventana con `?imprimir` (todas las diapositivas, sin animación) y la imprime a PDF. Si Chrome no está en la ruta habitual de Windows, se indica con la variable `CHROME`.
