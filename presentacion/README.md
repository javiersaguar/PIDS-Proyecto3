# Presentación y defensa

## Qué hay que hacer

- Preparar la defensa desde los resultados verificados de la [memoria](../memoria/README.md). Explicar el problema, qué datos hay y cómo se diseñaron la red de estaciones, la flota y la recarga.
- Seleccionar los mapas, gráficas y cifras que ayuden a justificar las decisiones y a explicar las principales limitaciones.
- Ensayar la [demo 3D](../docs/PLAN.md#8-demo-3d-para-la-defensa) con un día de operación. Comparar las redes, mostrar qué ocurre cuando una estación queda indisponible y abrir la maqueta para explicar el balance de recarga.
- Ensayar la defensa en equipo para que ambos miembros puedan explicar el proyecto completo y responder preguntas.

## Qué debe incluir

- La presentación en HTML ([presentacion.html](presentacion.html), se abre con doble clic) y sus archivos fuente en [diapositivas/](diapositivas/). No se entrega en PDF.
- Las diapositivas deben mostrar la red propuesta, los anclajes y la flota, el consumo estimado y el diseño fotovoltaico y de batería de la estación elegida. Usar las [figuras generadas](../resultados/figuras/README.md).
- El guion, las instrucciones para abrir la compilación local de la demo y un vídeo breve de respaldo. Usar el mismo escenario y los mismos resultados en las diapositivas y en la demo.

## Diapositivas

Las diapositivas están en [diapositivas/](diapositivas/): una aplicación React + Vite con animaciones de Motion (antes Framer Motion) que lee las mismas tablas y datos que exportan los notebooks, así que sus cifras cambian con ellos. Se publica con la web en https://javiersaguar.github.io/PIDS-Proyecto3/presentacion/ (enlace «Presentación» de la cabecera).

Animaciones: barrido de luz y desenfoque al cambiar de diapositiva, títulos palabra a palabra, cifras que cuentan hasta su valor, líneas que se dibujan con la punta luminosa, la red de Roma con patinetes circulando por los pares con más viajes y ondas sobre la red elegida y la flota mínima. Con «reducir movimiento» activado en el sistema, las animaciones se simplifican. También se avanza deslizando en pantallas táctiles y con los puntos de abajo.

[presentacion.html](presentacion.html) es la presentación completa en un solo fichero (código, estilos, fuentes y cifras dentro): se abre con doble clic en cualquier navegador, sin servidor ni conexión. Flechas, espacio o clic para avanzar; «f», pantalla completa.

```
cd presentacion/diapositivas
npm install
npm run dev     # presentación en el navegador; se actualiza al guardar cada cambio
npm run html    # compila y guarda presentacion/presentacion.html
```

### Cómo quitar, añadir o cambiar diapositivas

1. `npm run dev` y abrir la dirección que indica (http://localhost:5173). Cada cambio guardado se ve al momento.
2. Todo el contenido está en [src/diapositivas.tsx](diapositivas/src/diapositivas.tsx), en la lista `DIAPOSITIVAS`, una entrada `{ id, titulo, contenido }` por diapositiva y en el orden en que se proyectan:
   - **Quitar:** borrar su bloque `{ … },`.
   - **Mover:** cortar el bloque y pegarlo en otra posición.
   - **Añadir:** copiar la plantilla comentada que hay justo encima de la lista. Los números de página y los puntos de navegación se ajustan solos.
   - **Cambiar textos:** editar las frases directamente. Las cifras se escriben como `{num(d.red.k)}` o `{pc(d.inventario.pct)}` para que salgan de los resultados y no queden desfasadas; [src/tipos.ts](diapositivas/src/tipos.ts) dice qué cifras hay.
3. Piezas disponibles: `Cabecera` (etiqueta, título y entradilla), `Puntos` (lista), `Cifras` (tarjetas con número que cuenta), `Tarjetas`, `Aparece` (cualquier bloque con entrada animada) y los gráficos de [src/graficos.tsx](diapositivas/src/graficos.tsx) (`MapaRed`, `CurvaFlota`, `Pareto`, `Embudo`, `PerfilHorario`, `Conciliacion`, `DemandaRecarga`). Colores y tamaños, en [src/estilos.css](diapositivas/src/estilos.css).
4. Para una cifra nueva: añadirla en [scripts/datos.mjs](diapositivas/scripts/datos.mjs) (lee `resultados/tablas/` y `frontend/public/datos/`) y su tipo en `src/tipos.ts`.
5. `npm run html` al terminar, y subir `presentacion.html` junto con los fuentes. La versión de la web se actualiza sola al llegar a `main`.

`scripts/datos.mjs` reúne las cifras en `src/datos.json` (no se versiona; se regenera en cada `dev` y `html`). Si alguna vez hiciera falta imprimirla, abriendo la presentación con `?imprimir` al final de la dirección salen todas las diapositivas seguidas, sin animación, listas para imprimir desde el navegador.
