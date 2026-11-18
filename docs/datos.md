# Datos de partida

## Fichero

`datos/brutos/rome_u_journeys.csv`: viajes de patinetes compartidos de Helbiz en Roma,
febrero de 2021. Se guarda tal cual se recibió y no se modifica nunca. Todo lo derivado
va a `datos/procesados/` y se genera con código.

- Tamaño: 3,2 MB, 25 186 viajes + cabecera, separador `,`, ASCII, finales de línea LF.
- SHA-256: `a2a3e147e05a6a4fc4462b991245245b3c954ac6ada3e265f0261b24cc7cf3f5`
- `.gitattributes` marca los `.csv` como binarios para que Git no cambie los finales de
  línea en Windows y el hash se mantenga.

## Diccionario

| Campo | Tipo | Descripción | Observaciones |
|---|---|---|---|
| `idS` | texto | Identificador del patinete | 2 331 patinetes distintos |
| `tsO` | fecha | Marca de tiempo del origen | Formato `dd/mm/aaaa HH:MM:SS`, hora local |
| `tsD` | fecha | Marca de tiempo del destino | `tsD − tsO = tt` en todos los viajes |
| `price` | real | Precio del viaje (€) | Se ajusta a `1 + 0,15 · minutos` (desbloqueo + minuto) |
| `tt` | entero | Tiempo de recorrido (s) | |
| `dis` | real | Distancia recorrida (m) | Distancia sobre la ruta: mediana 1,35 veces la distancia en línea recta |
| `vel` | real | Velocidad media (km/h) | Exactamente `dis / tt · 3,6` |
| `lonO`, `latO` | real | Coordenadas del origen (WGS84) | |
| `lonD`, `latD` | real | Coordenadas del destino (WGS84) | |

## Primer vistazo (18/11/2026)

Valores obtenidos con una exploración rápida. Hay que rehacerlos con el código de
limpieza para que la memoria cite cifras reproducibles.

### Volumen y cobertura

- Del 01/02/2021 00:21 al 28/02/2021 23:15 (28 días completos).
- Sin nulos ni filas duplicadas.
- 10,8 viajes por patinete de media (mín. 1, mediana 10, máx. 37).
- Zona: lon 12,437–12,536, lat 41,792–41,951 (centro de Roma, dentro del anillo GRA).

### Distribuciones

| Variable | P25 | Mediana | P75 | Máx. |
|---|---|---|---|---|
| `tt` (s) | 249 | 469 | 850 | 513 599 (≈ 6 días) |
| `dis` (m) | 761 | 1 506 | 2 708 | 18 268 |
| `vel` (km/h) | 8,5 | 12,1 | 15,1 | 61,0 |
| `price` (€) | 1,62 | 2,17 | 3,13 | 1 285 |

### Calidad: viajes sospechosos

| Criterio | Viajes | Interpretación probable |
|---|---|---|
| `tt < 60 s` | 950 | Desbloqueo y cancelación |
| `dis < 100 m` | 1 401 | Desbloqueo sin viaje real |
| `vel > 25 km/h` | 2 | Por encima del límite del patinete (error de GPS) |
| `tt > 2 h` | 122 | Viaje no cerrado por el usuario |
| `tt > 1 día` | 10 | Error claro |
| `price > 20 €` | 98 | Ligado a los `tt` largos |
| `dis > 15 km` | 7 | Revisar uno a uno |

Los criterios se solapan. La limpieza debe marcar los viajes con una columna de motivo,
no borrarlos sin más, y la memoria debe incluir la tabla de cuántos se quitan en cada paso.

### Patrones temporales

- Pico de tarde: de 16:00 a 19:59 sale el 39 % de los viajes, y el máximo es de 18:00 a
  18:59 (2 603 viajes). Pico de mañana menor, de 8:00 a 9:59. Casi nada de 0:00 a 6:00.
- El 07/02 (domingo) es el día con menos viajes (430); hay que mirar si llovió.
- La demanda crece a lo largo del mes: unos 800 viajes diarios la primera semana y más
  de 1 000 la última.

### Encadenamiento de viajes del mismo patinete

- La mediana de la distancia entre el final de un viaje y el inicio del siguiente del
  mismo patinete es 17 m (normal: se queda donde lo dejaron).
- En el 10 % de los casos el salto supera 3,9 km: **recolocaciones o recogidas del
  operador** (recarga o rebalanceo). Hay que tenerlo en cuenta al dimensionar la flota.
- Tiempo parado entre viajes: mediana 16,9 h, P25 1,45 h. Los patinetes están parados la
  mayor parte del tiempo, así que hay margen para reducir la flota.

## Datos externos previstos

| Fuente | Para qué | Cómo |
|---|---|---|
| PVWatts v8 (NREL) | Producción FV horaria de la estación | API con clave, respuesta guardada en `datos/externos/` |
| PVGIS (JRC) | Irradiancia real de febrero de 2021 en Roma para contrastar con el año tipo de PVWatts | API `seriescalc`, respuesta guardada |
| Modelo digital de elevaciones (SRTM / Copernicus) | Desnivel origen-destino para el término de pendiente | API OpenTopoData o ráster local |
| OpenStreetMap (OSMnx) | Red peatonal para distancias andando y emplazamientos posibles | Consulta guardada en caché |
| Límites administrativos de Roma (Municipi / zone urbanistiche) | Zonas de las matrices O-D | Portal de datos abiertos de Roma Capitale |
| Meteostat / Open-Meteo | Lluvia y temperatura diarias para explicar la demanda | API, respuesta guardada |

Todo lo descargado se guarda con fecha y fuente para poder reproducir sin conexión.
