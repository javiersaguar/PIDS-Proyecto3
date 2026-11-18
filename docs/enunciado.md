# Enunciado del Proyecto 3: resumen y requisitos

Planificación y optimización de sistemas de micro-movilidad eléctrica (PIDS, bloque
MAT/ELF/TFB). Fuentes: enunciado del proyecto, presentación del 18/11/2026 y
presentación general de la asignatura.

## Contexto

Una empresa quiere implantar patinetes eléctricos compartidos (VMP) en Roma. Se hizo un
piloto de 30 días con una flota finita y se registraron los viajes. El Ayuntamiento
exige que, cuando no se usan, los patinetes estén anclados a una estación de recarga
(como BiciMAD), nunca aparcados en la acera. Hay que dimensionar la flota y decidir
cuántas estaciones poner y dónde.

## Qué hay que hacer

### 1. Movilidad (60 %)

- [ ] Matrices origen → destino de la movilidad durante el periodo.
- [ ] Número de estaciones de recarga, su localización y el número de patinetes por
      estación, buscando a la vez que:
  - [ ] se minimice el número de estaciones y se maximice el número de patinetes por estación;
  - [ ] se minimice la distancia entre el **origen** de los viajes y las estaciones;
  - [ ] se minimice la distancia entre el **destino** de los viajes y las estaciones;
  - [ ] se minimice el número de patinetes del sistema;
  - [ ] se maximice el uso de esos patinetes.

Los objetivos chocan entre sí (menos estaciones implica andar más), así que la
solución es un compromiso que hay que justificar.

### 2. Consumo (10 %)

- [ ] Energía consumida por cada patinete en cada desplazamiento.
- [ ] Análisis de consumo de la flota, por patinete y por estación de recarga
      (presentación de introducción).

### 3. Estaciones de recarga (20 %)

- [ ] Potencia y energía demandadas en cada estación a lo largo del tiempo.
- [ ] Número de paneles fotovoltaicos para cubrir la demanda de modo que la estación
      sea autónoma la mayor parte del tiempo.
- [ ] Capacidad de las baterías de apoyo para casar la generación (horas centrales) con
      la recarga (a cualquier hora).
- [ ] Diseño y dimensionado de **una estación concreta** para la demanda de todo el periodo.

### 4. Conclusiones (10 %)

- [ ] Conclusiones de las implementaciones, limitaciones y consideraciones del grupo.

## Especificaciones

### Datos de movilidad

Servicio Helbiz, Roma, febrero de 2021. Campos del CSV: `idS`, `tsO`, `tsD`, `price`,
`tt`, `dis`, `vel`, `lonO`, `latO`, `lonD`, `latD` (detalle en [datos.md](datos.md)).
El enunciado habla también de trayectorias con puntos cada 10 s, pero el CSV que se
nos ha dado no las incluye.

### Patinete (Lime Gen 3.0)

| Parámetro | Valor |
|---|---|
| Peso | 22,5 kg |
| Potencia | 250 W |
| Velocidad máxima | 25 km/h |
| Consumo medio | 13,5 Wh/km |
| Batería | 576 Wh (36 V, 16 Ah) |
| Tiempo de recarga | 7 h (≈ 82 W medios) |

### Modelo físico de consumo (presentación)

- Fuerza de tracción: `F_te = F_rr + F_a + F_hc + F_la`
  - rodadura `F_rr = R (M_car + M_d) g cos α`
  - aerodinámica `F_a = ½ A C_d ρ v²`
  - pendiente `F_hc = (M_car + M_d) g sin α`
  - aceleración `F_la = (M_car + M_d) a`
- Potencia en rueda `P_te = F_te · v`
- Potencia de batería `P_bat = P_te / η_motor`
- Energía de batería `E_bat = P_bat · Δt / η_disch`

### Estación de recarga

- Potencial fotovoltaico con PVWatts (NREL): localización, base de datos solar,
  información del sistema (Rooftop Size Estimator) y resultados horarios
  (`DC Array Output` / `AC System Output`).
- Baterías de almacenamiento (BeeBattery home), Li-ion LMO, 90 V:

| Capacidad nominal | Potencia nominal |
|---|---|
| 4 kWh | 4 kW |
| 8 kWh | 5 kW |
| 12 kWh | 5 kW |

- Gestión de la demanda (presentación): cuándo y a qué potencia cargar, tiempos de
  espera, qué pasa sin potencia o sin patinetes; autoconsumo y balance neto; picos y
  valles; herramientas de previsión (ARIMA, Kalman, redes neuronales).

## Entregable

Por Moodle, un comprimido `GZZ-P3.zip` (o `.tar` / `.tgz`, ZZ = número de grupo) con:

- `GZZ-P3.pdf`: memoria con la descripción, el análisis y el desarrollo de todos los
  apartados.
- `GZZ-P3_code/`: programas que reproduzcan **exactamente** los resultados de la memoria.

Normas de la memoria:

- El código no va en la memoria: se referencia en la bibliografía y se cita en el texto.
  Se pueden mostrar funciones concretas si son importantes.
- Si los resultados no se pueden reproducir (faltan programas o no coinciden), se
  penaliza el apartado.
- Extensión mínima: explicaciones breves, sin redundancias, claras y concisas; figuras
  del tamaño mínimo que permita leerlas.

Además, por la estructura de la asignatura: presentación final en PDF y defensa. Todos
los miembros deben conocer la solución entera y saber responder a cualquier pregunta.

## Evaluación (común a la asignatura)

- Actividad durante el desarrollo (seguimiento obligatorio de los lunes).
- Memoria escrita.
- Verificación del funcionamiento y del cumplimiento de requisitos.
- Presentación y defensa.
- Asistencia obligatoria a introducción y presentación. Cada proyecto tiene un líder
  distinto.

## Calendario

| Semana | Fechas | Sesiones |
|---|---|---|
| 10 | 18/11 | Introducción |
| 11 | 23–26/11 | Desarrollo (L, X, J) |
| 12 | 30/11–3/12 | Desarrollo (L, X, J) |
| 13 | 9–10/12 | Desarrollo (X con horario de L, J) |
| 14 | 14–16/12 | Memoria y presentación |
| — | 17/12 | Clausura |

Clases: lunes y miércoles 15:00–17:10, jueves 17:20–19:30, aula A-202. El lunes es
obligatorio para presentar el progreso.

## Contactos

Jesús Fraile Ardanuy, Álvaro Gutiérrez Martín, Juan José Vinagre Díaz.
