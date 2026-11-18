# Plan del proyecto (boceto)

Objetivo: cumplir **todo** lo que pide el enunciado con rigor y añadir trabajo extra que
se note en la memoria y en la defensa, sin que la memoria se alargue. Cada extra debe
responder a una pregunta del enunciado o de la presentación (gestión de la demanda,
autonomía, uso de la flota), no estar ahí por estar.

Principios que guían todo el plan:

1. **Reproducibilidad total.** El enunciado penaliza los resultados que no se pueden
   reproducir. Un solo comando regenera, desde el CSV en bruto, todas las tablas y
   figuras de la memoria. Semillas fijas, versiones fijadas y datos externos guardados.
2. **Decisiones justificadas con números.** Cada parámetro (radio de cobertura, masa del
   usuario, eficiencias, tamaño de batería) sale de una referencia o de un análisis de
   sensibilidad, nunca "porque sí".
3. **Compromisos visibles.** Los objetivos de movilidad chocan entre sí. En vez de dar una
   solución única, se enseña el frente de Pareto y se elige un punto razonado.
4. **Memoria corta y densa.** Pocas figuras, muy trabajadas; tablas en lugar de párrafos.

---

## Fase 0. Puesta en marcha (18–22/11)

- Entorno Python 3.12 con dependencias fijadas (`requirements.txt` con versiones exactas
  o `uv.lock`): pandas, numpy, geopandas, shapely, h3, scikit-learn, pulp (solver CBC),
  osmnx, folium, matplotlib, pvlib y requests.
- Código común en un paquete (`comun/`): lectura y limpieza, distancias haversine,
  asignación de viajes a estaciones, modelos de consumo, simulación de baterías y
  estilos de figuras.
- `config.yaml` con **todos** los parámetros físicos y de diseño en un solo sitio.
- Script maestro (`ejecutar_todo.py` o `Makefile`) que ejecute las fases en orden y
  escriba en `resultados/`.
- Carpeta `datos/externos/` para las respuestas de API guardadas (PVWatts, PVGIS,
  elevaciones, OSM, meteorología).
- `.gitignore` para entornos y cachés.

## Fase 1. Limpieza y análisis exploratorio (20–25/11)

**Limpieza** (`datos/procesados/viajes_limpios.parquet`):

- Pasar las fechas a `datetime` con zona `Europe/Rome`.
- Marcar, sin borrar, los viajes no válidos con una columna `motivo`: `tt < 60 s`,
  `dis < 100 m`, `vel > 25 km/h`, `tt > 2 h`, coordenadas fuera del área de servicio,
  precio incoherente. Los umbrales se justifican con los histogramas.
- Tabla de embudo: viajes iniciales → eliminados en cada paso → viajes finales.

**Exploración** (figuras candidatas para la memoria):

- Mapa de calor hora × día de la semana; serie diaria con laborables y fines de semana.
- Mapas de densidad de orígenes y destinos (hexágonos H3) y su diferencia
  (zonas emisoras y receptoras).
- Distribuciones de duración, distancia y velocidad.
- Recolocaciones del operador: saltos entre el final de un viaje y el inicio del
  siguiente del mismo patinete. Cuántas hay, cuándo (¿de noche?) y adónde llevan los
  patinetes. Es la prueba de que hoy el sistema necesita rebalanceo.
- **Extra:** cruce con la meteorología diaria (lluvia frente a viajes) para explicar los
  días anómalos, como el 07/02.
- **Extra:** modelo de tarifa (`1 € + 0,15 €/min`) e ingresos por día y por zona; sirve
  para valorar económicamente las estaciones.

## Fase 2. Movilidad (60 %), el núcleo (23/11–4/12)

### 2.1 Matrices origen → destino

- Tres zonificaciones para mostrar que el resultado no depende de una sola elección:
  1. rejilla hexagonal H3 (resolución 8, unos 0,7 km² por celda);
  2. zonas administrativas de Roma (15 Municipi y zone urbanistiche);
  3. las propias estaciones, una vez elegidas (matriz estación → estación).
- Matrices por franja (punta de mañana, mediodía, punta de tarde, noche) y
  laborable/fin de semana.
- Indicadores: porcentaje de viajes intrazonales, pares más fuertes, asimetría
  (`M − Mᵀ`) y balance neto por zona (producción − atracción).
- Visualización: mapa de líneas de deseo (folium o kepler.gl) y matriz ordenada en
  mapa de calor. **Extra:** mapa interactivo HTML para la defensa.

### 2.2 Localización y número de estaciones

Se plantea como problema de localización de instalaciones, comparando métodos:

| Método | Qué optimiza | Para qué sirve |
|---|---|---|
| K-medoids / K-means sobre orígenes y destinos (barrido de k) | Distancia media a la estación más cercana | Línea base sencilla y curva del codo |
| HDBSCAN | Puntos calientes naturales | Candidatos y validación cualitativa |
| **Cobertura de conjuntos (LSCP), MILP** | Mínimo número de estaciones que cubren el X % de orígenes **y** destinos en un radio R | Responde a "minimizar estaciones" con garantía de distancia |
| **p-mediana, MILP** | Mínima distancia total ponderada origen + destino para p estaciones | Responde a "minimizar distancias" |
| **Cobertura máxima (MCLP)** | Máxima demanda cubierta con p estaciones | Curva cobertura frente a coste |

- Candidatos: centros de celdas H3 con demanda, opcionalmente filtrados con OSM
  (plazas, aceras anchas, salidas de metro).
- Radio de cobertura R: 200, 300 y 400 m (de 3 a 5 minutos andando). Se justifica con
  literatura sobre distancia aceptable a pie hasta la micromovilidad.
- **Frente de Pareto:** número de estaciones frente a distancia media o P90 al origen y
  al destino. Se elige el punto del codo y se razona.
- **Extra:** distancias reales andando por la red peatonal de OSM (OSMnx) en la
  solución final, comparadas con la haversine.
- **Extra de robustez:** validación temporal. Se diseñan las estaciones con las
  semanas 1–3 y se mide la cobertura en la semana 4. Si cae poco, la red sirve para
  demanda futura.

### 2.3 Patinetes por estación y tamaño de flota

Con cada viaje asignado a su estación de origen y de destino:

- **Simulación por eventos** del inventario de cada estación durante el mes
  (salidas restan, llegadas suman).
  - Stock inicial mínimo por estación = mayor déficit acumulado (garantiza servicio
    sin rebalanceo).
  - Número de anclajes por estación = máximo inventario alcanzado más un margen.
  - Flota = suma de stocks iniciales. Se compara con los 2 331 patinetes del piloto.
- **Escenarios de operación:**
  1. sin rebalanceo;
  2. rebalanceo nocturno (se reponen las estaciones cada noche);
  3. rebalanceo óptimo entre estaciones (problema de transporte de coste mínimo).
- **Curva flota frente a nivel de servicio:** porcentaje de viajes atendidos según el
  tamaño de flota. Responde a la vez a "minimizar patinetes" y "maximizar su uso".
- Indicadores de uso: viajes por patinete y día, horas de uso por día, tasa de
  utilización y tiempo medio en estación.
- **Extra (une movilidad y consumo):** simulación con estado de carga. Un patinete que
  llega con poca batería no está disponible hasta recargar (82 W, 7 h para la carga
  completa). Así se ve si la recarga obliga a ampliar la flota.

## Fase 3. Consumo (10 %) (25/11–2/12)

- **Modelo A, enunciado:** `E = 13,5 Wh/km · dis`.
- **Modelo B, físico (presentación):** `F_te = F_rr + F_a + F_hc + F_la`,
  `P_bat = F_te · v / η_motor`, `E = P_bat · Δt / η_disch`.
  - Parámetros de partida con referencia: masa del patinete 22,5 kg, masa del usuario
    75 kg, coeficiente de rodadura R ≈ 0,01–0,015, `C_d·A` ≈ 0,5–0,7 m²,
    ρ = 1,225 kg/m³, η_motor ≈ 0,8, η_disch ≈ 0,95.
  - Velocidad: la media del viaje (no hay trayectorias). Aceleraciones: un perfil
    tipo con arranques cada cierta distancia, documentado como hipótesis.
  - **Extra:** pendiente real con el desnivel origen-destino sacado de un modelo digital
    de elevaciones. Roma tiene colinas y el término `F_hc` cambia el consumo de
    algunos viajes.
  - **Extra:** consumo en reposo de la electrónica (GPS y comunicaciones).
  - Calibración: comparar el consumo medio del modelo B con los 13,5 Wh/km del fabricante.
- Resultados:
  - por viaje (distribución);
  - por patinete (energía en el mes y número de recargas completas equivalentes);
  - de la flota (kWh totales y por día);
  - por estación, con la hipótesis explícita de que el patinete recarga en la estación
    de **destino**.
- **Extra:** estado de carga de cada patinete viaje a viaje (¿se agotaría alguno sin
  recarga?).
- **Extra:** análisis de sensibilidad (tornado) de la energía total frente a masa,
  `C_d·A`, R y eficiencias.

## Fase 4. Estación de recarga (20 %) (30/11–7/12)

- **Demanda de cada estación:** cada llegada inicia una carga de `E_viaje` a potencia
  constante (576 Wh / 7 h ≈ 82 W, más el rendimiento del cargador). Curvas de potencia
  P(t) cada 15 min, energía diaria y pico. Se hace para todas las estaciones (mapa de
  energía por estación).
- **Estación concreta:** la de mayor demanda (peor caso) y, como contraste, una típica.
- **Producción FV:**
  - PVWatts en las coordenadas de la estación, por API (`DEMO_KEY` o clave propia),
    para hacerlo reproducible. Salida horaria por kWp, que se escala con el número de
    módulos. El área se estima con el Rooftop Size Estimator sobre la marquesina.
  - **Extra:** contraste con PVGIS para **febrero de 2021 real** (PVWatts usa un año
    tipo), y comprobación con pvlib.
- **Balance energético horario de febrero:** FV → carga, excedente → batería,
  déficit → batería → red.
  - Baterías del enunciado (4, 8 y 12 kWh, con 4, 5 y 5 kW), sus combinaciones,
    profundidad de descarga y rendimiento de ida y vuelta.
  - Indicadores: porcentaje de horas en autonomía, autosuficiencia, autoconsumo,
    energía vertida o perdida y energía tomada de la red.
- **Barrido de diseño:** número de paneles × capacidad de batería → mapa de autonomía.
  Se elige la combinación más barata que supere el objetivo (por ejemplo, ≥ 95 %).
- **Extra, gestión de la demanda (la presentación le dedica una parte):** comparar carga
  inmediata con **carga inteligente**, que retrasa las cargas hacia las horas solares
  manteniendo siempre patinetes con batería suficiente para la demanda prevista. Mide
  cuánto se reducen los paneles y la batería necesarios.
- **Extra:** previsión de la demanda horaria de la estación (estacionalidad
  diaria/semanal con un modelo sencillo tipo SARIMA o regresión) para alimentar la
  carga inteligente.
- **Extra:** estimación del año completo con PVWatts anual, suponiendo la misma demanda.
  Febrero es un mes de poca irradiancia, así que es un diseño conservador, y se razona.
- **Extra:** valoración económica y ambiental: CAPEX de paneles y baterías, ahorro frente
  a la red, periodo de retorno y CO₂ evitado.

## Fase 5. Conclusiones y extras transversales (7–11/12)

- Conclusiones por apartado con las cifras clave (estaciones, flota, kWh, paneles, kWh
  de batería, porcentaje de autonomía).
- Limitaciones:
  - no hay trayectorias;
  - solo hay un mes de invierno;
  - la demanda cambia al pasar a un sistema con estaciones (efecto de la distancia a pie);
  - PVWatts usa año tipo;
  - la viabilidad urbana de cada emplazamiento no está comprobada.
- **Extra:** sensibilidad global del diseño final (radio R, nivel de servicio,
  parámetros de consumo).
- **Extra:** cuadro de mando interactivo (mapa con estaciones, matrices y curvas de
  potencia) para usarlo en la defensa.

## Fase 6. Memoria, presentación y entrega (9–16/12)

- Memoria en LaTeX (Overleaf), corta:
  - figuras vectoriales generadas por el código;
  - el código citado en la bibliografía, no pegado;
  - cada cifra con el script que la produce.
- Presentación en PDF y ensayo de la defensa. Los dos debemos dominar **todo** el
  proyecto, no solo nuestra parte.
- Prueba final de reproducción: clonar en limpio, crear el entorno, ejecutar el script
  maestro y comprobar que figuras y tablas coinciden con la memoria.
- Script que monte `GZZ-P3.zip` con `GZZ-P3.pdf` y `GZZ-P3_code/`.

---

## Reparto propuesto

| Bloque | Responsable principal | Apoyo |
|---|---|---|
| Fase 0 (entorno, estructura, script maestro) | Javier | Alejandro |
| Fase 1 (limpieza y exploración) | Javier | Alejandro |
| Fase 2.1 (matrices O-D) | Alejandro | Javier |
| Fase 2.2 (localización de estaciones) | Javier | Alejandro |
| Fase 2.3 (flota y simulación de inventario) | Javier | Alejandro |
| Fase 3 (consumo) | Alejandro | Javier |
| Fase 4 (estación de recarga y FV) | Alejandro | Javier |
| Extras de gestión de la demanda | Alejandro | Javier |
| Fase 5 y 6 (conclusiones, memoria, presentación) | Los dos | |

Cada uno trabaja en su rama. Las piezas compartidas (`comun/`, `config.yaml`) se
acuerdan antes de tocarlas para no pisarnos. Hay que decidir quién es el **líder** del
proyecto 3 (la asignatura pide uno distinto en cada proyecto).

## Hitos y seguimiento de los lunes

| Fecha | Qué enseñamos |
|---|---|
| Lun 23/11 | Limpieza hecha, exploración, primeras matrices O-D, plan de métodos |
| Lun 30/11 | Frente de Pareto de estaciones, modelo de consumo calibrado |
| Mié 9/12 (horario de lunes) | Flota dimensionada, estación concreta con FV y batería, carga inteligente |
| Lun 14/12 | Memoria y presentación casi finales; reproducción en limpio superada |

## Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Resultados no reproducibles | Script maestro, semillas, versiones fijadas, APIs guardadas en caché |
| El MILP tarda demasiado | Reducir candidatos (celdas H3 con demanda), límite de tiempo y brecha de optimalidad documentados |
| La API de PVWatts falla el día de la entrega | Respuestas guardadas en `datos/externos/` |
| Memoria demasiado larga | Límite propio de figuras por apartado, revisión cruzada |
| Uno de los dos no domina una parte | Revisión cruzada de cada PR y ensayo de preguntas antes de la defensa |

## Checklist para el 10

- [ ] Todos los puntos de [enunciado.md](enunciado.md) marcados.
- [ ] Matrices O-D en al menos dos zonificaciones, con franjas horarias.
- [ ] Frente de Pareto de estaciones con métodos de optimización formales.
- [ ] Flota dimensionada con simulación y curva de nivel de servicio.
- [ ] Consumo con modelo físico calibrado y desnivel real.
- [ ] Estación con FV (PVWatts y PVGIS) y batería elegida con barrido y carga inteligente.
- [ ] Sensibilidad de los parámetros clave.
- [ ] Validación temporal de la red de estaciones.
- [ ] Limitaciones honestas.
- [ ] Reproducción en limpio con un comando.
- [ ] Memoria breve, figuras legibles y código citado.
- [ ] Defensa ensayada por los dos.
