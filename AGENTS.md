# Normas del repositorio (leer antes de cada commit)

Este fichero es de lectura obligatoria para cualquier agente o herramienta automática
que trabaje en el repositorio, antes de hacer `git commit`, `git push` o abrir una PR.

## Autoría

Los únicos autores del repositorio son los miembros del grupo:

- Javier Saguar
- Alejandro Cuevas

No debe quedar ningún rastro de herramientas de IA en el repositorio.

## Commits y pull requests

- El autor y el committer de cada commit es el miembro del grupo que trabaja en esa
  copia (el `user.name` / `user.email` de su Git). No se cambian.
- Prohibidos los trailers `Co-Authored-By`, `Generated-by` o similares que no sean de un
  miembro del grupo.
- Prohibidas en mensajes de commit, títulos y descripciones de PR las líneas tipo
  "Generated with ...", firmas, emojis de herramienta o enlaces a asistentes.
- El mensaje termina en la última línea de contenido, sin pies añadidos.
- Comprobación antes de hacer push: `git log -1 --pretty=%B` no debe contener nada de lo
  anterior.

## Contenido de los ficheros

- Nada de menciones a asistentes, modelos o herramientas de IA en código, comentarios,
  docstrings, notebooks, README, memoria, presentación, cabeceras de ficheros, campos
  `authors` ni nombres de ramas.
- Las carpetas y ficheros de configuración de las herramientas (ajustes locales, memorias,
  planes, etc.) no se versionan. Se excluyen en `.git/info/exclude` de cada copia local,
  no en el `.gitignore` versionado.

## Ramas

- `main`: rama principal. Solo recibe trabajo ya revisado.
- `javier-saguar` y `alejandro-cuevas`: rama de trabajo de cada miembro.
- Cada uno trabaja únicamente en su rama. Nunca se hacen commits en la rama de otro
  miembro ni se integra su rama sin que él lo pida.
- Antes de hacer push, `git fetch` para ver si el remoto ha cambiado.

## Estructura

| Carpeta | Contenido |
|---|---|
| `datos/brutos/` | Datos de partida (viajes Helbiz, Roma, febrero 2021) sin modificar |
| `datos/procesados/` | Datos limpios y derivados |
| `movilidad/` | Matrices origen-destino y ubicación y dimensionado de las estaciones (60 %) |
| `consumo/` | Consumo de la flota, por patinete y por estación (10 %) |
| `estacion_recarga/` | Potencia y energía demandadas, paneles fotovoltaicos y baterías (20 %) |
| `resultados/figuras/` | Gráficas y mapas generados |
| `memoria/` | Memoria y conclusiones (10 %) |
| `presentacion/` | Presentación final en PDF |
| `docs/` | Enunciado resumido, datos, plan y lista de tareas |

`datos/brutos/rome_u_journeys.csv` no se modifica nunca. Antes de empezar una tarea se
consulta `docs/TAREAS.md` y se actualiza su estado.
