"""Medición de rutas peatonales entre extremos observados y estaciones congeladas."""

import gzip
import hashlib
import json
from dataclasses import dataclass

import numpy as np
import pandas as pd
import shapely
from pyproj import Transformer
from scipy.sparse import csr_array
from scipy.sparse.csgraph import dijkstra
from shapely.strtree import STRtree

from comun.config import ruta
from comun.datos import cargar_viajes
from comun.geo import haversine_m
from redes import distancias, extremos, leer

OSM = ruta("externos") / "osm"
META = OSM / "osm_peatonal.meta.json"
ENLACE_MAX_M = 60
PERMITIDO = {"yes", "designated", "permissive"}
RESTRINGIDO = {"no", "private", "customers", "permit", "delivery", "use_sidepath", "destination"}
VIA_A_PIE = {
    "footway", "pedestrian", "path", "steps", "living_street", "residential", "unclassified",
    "service", "track", "primary", "secondary", "tertiary",
    "primary_link", "secondary_link", "tertiary_link",
}
UTM = Transformer.from_crs("EPSG:4326", "EPSG:32633", always_xy=True)
WGS = Transformer.from_crs("EPSG:32633", "EPSG:4326", always_xy=True)


def proyectar(puntos, transformador=UTM):
    return np.column_stack(transformador.transform(*np.asarray(puntos).T))


def dentro(puntos, caja):
    o, s, e, n = caja
    lon, lat = np.asarray(puntos).T
    return (lon >= o) & (lon <= e) & (lat >= s) & (lat <= n)


def leer_osm(ficha):
    raw = gzip.decompress((OSM / ficha["fichero"]).read_bytes())
    if hashlib.sha256(raw).hexdigest() != ficha["sha256"]:
        raise ValueError(f"Huella incorrecta de {ficha['fichero']}.")
    return json.loads(raw)["elements"]


def cargar_recorte(sector):
    """Acepta Overpass con geometrías y teselas de la API con nodos separados."""
    fichas = sector["ficheros"]
    elementos = {}
    for f in fichas:
        for e in leer_osm(f):
            clave = (e["type"], e["id"])
            if clave not in elementos or e.get("version", 0) > elementos[clave].get("version", 0):
                elementos[clave] = e
    return elementos.values()


def transitable(tags):
    pie = tags.get("foot")
    if pie in RESTRINGIDO or tags.get("highway") in {"construction", "proposed"}:
        return False
    if pie in PERMITIDO:
        return True
    return (tags.get("highway") in VIA_A_PIE and tags.get("access") not in RESTRINGIDO
            and tags.get("service") != "driveway")


def barrera_nodo(tags):
    pie = tags.get("foot")
    if pie in PERMITIDO:
        return False
    return (pie in RESTRINGIDO or tags.get("access") in RESTRINGIDO or tags.get("locked") == "yes"
            or tags.get("barrier") in {"wall", "fence", "retaining_wall"})


def cargar_barreras():
    """Ejes de río y tren para impedir atajos en los conectores al grafo."""
    meta_base = sorted(OSM.glob("osm_roma_*.meta.json"))[-1]
    meta = json.loads(meta_base.read_text(encoding="utf-8"))
    trazos = []
    for capa in ("agua", "tren"):
        for e in leer_osm(meta["capas"][capa]):
            tags = e.get("tags", {})
            permitido = (tags.get("waterway") == "river" if capa == "agua"
                         else tags.get("railway") == "rail" and tags.get("tunnel") not in {"yes", "building_passage"})
            coords = [(x["lon"], x["lat"]) for x in e.get("geometry", []) if x]
            if permitido and len(coords) > 1:
                trazos.append(shapely.LineString(proyectar(coords)))
    return shapely.MultiLineString(trazos)


@dataclass
class Grafo:
    coords: np.ndarray
    extremos: np.ndarray
    adelante: np.ndarray
    atras: np.ndarray

    @classmethod
    def desde_sector(cls, sector):
        elementos = cargar_recorte(sector)
        nodos, bloqueados = {}, set()
        for e in elementos:
            if e["type"] == "node":
                nodos[e["id"]] = (e["lon"], e["lat"])
                if barrera_nodo(e.get("tags", {})):
                    bloqueados.add(e["id"])
        enlaces = {}
        for way in elementos:
            tags = way.get("tags", {})
            if way["type"] != "way" or not transitable(tags):
                continue
            ids = way["nodes"]
            for idx, pt in zip(ids, way.get("geometry", [])):
                if pt:
                    nodos[idx] = (pt["lon"], pt["lat"])
            sentido = tags.get("oneway:foot")
            avance = sentido != "-1" and tags.get("conveying") != "backward"
            retroceso = sentido not in {"yes", "1", "true"} and tags.get("conveying") != "forward"
            for a, b in zip(ids[:-1], ids[1:]):
                if a == b or a in bloqueados or b in bloqueados:
                    continue
                if a not in nodos or b not in nodos:
                    continue
                clave = (min(a, b), max(a, b))
                f, r = enlaces.get(clave, (False, False))
                enlaces[clave] = (f or (avance if a < b else retroceso), r or (retroceso if a < b else avance))
        ids = sorted({i for e in enlaces for i in e})
        ix = {i: j for j, i in enumerate(ids)}
        claves = sorted(enlaces)
        sentidos = np.array([enlaces[i] for i in claves], dtype=bool)
        return cls(np.array([nodos[i] for i in ids]), np.array([(ix[a], ix[b]) for a, b in claves]),
                   sentidos[:, 0], sentidos[:, 1])

    def conectar(self, puntos, barreras):
        """Inserta las proyecciones como vértices de calle y conserva el coste de enlace."""
        xy = proyectar(self.coords)
        a, b = xy[self.extremos].transpose(1, 0, 2)
        delta = b - a
        longitud2 = np.einsum("ij,ij->i", delta, delta)
        usables = np.flatnonzero(longitud2 > 1e-10)
        tramos = shapely.linestrings(np.stack((a[usables], b[usables]), axis=1))
        tree = STRtree(tramos)
        entrada = proyectar(puntos)
        p, j = tree.query(shapely.points(entrada), predicate="dwithin", distance=ENLACE_MAX_M)
        segmentos = usables[j]
        f = np.clip(np.einsum("ij,ij->i", entrada[p] - a[segmentos], delta[segmentos]) / longitud2[segmentos], 0, 1)
        proyeccion = a[segmentos] + f[:, None] * delta[segmentos]
        separacion = np.linalg.norm(entrada[p] - proyeccion, axis=1)
        conectores = shapely.linestrings(np.stack((entrada[p], proyeccion), axis=1))
        ok = ~shapely.crosses(conectores, barreras)
        p, segmentos, f, separacion = p[ok], segmentos[ok], f[ok], separacion[ok]
        orden = np.lexsort((segmentos, separacion, p))
        _, primeras = np.unique(p[orden], return_index=True)
        mejor = orden[primeras]
        p, segmentos, f = p[mejor], segmentos[mejor], f[mejor].round(12)

        coords = self.coords.tolist()
        por_tramo = {}
        nodo = np.full(len(puntos), -1, dtype=int)
        for q, i, fraccion in zip(p, segmentos, f):
            u, v = self.extremos[i]
            if fraccion <= 0:
                nodo[q] = u
            elif fraccion >= 1:
                nodo[q] = v
            else:
                insertados = por_tramo.setdefault(i, {})
                if fraccion not in insertados:
                    paso = proyectar([a[i] + fraccion * delta[i]], WGS)[0]
                    insertados[fraccion] = len(coords)
                    coords.append(paso.tolist())
                nodo[q] = insertados[fraccion]

        filas, cols = [], []
        for i, (u, v) in enumerate(self.extremos):
            intermedios = por_tramo.get(i, {})
            serie = [u, *(intermedios[f] for f in sorted(intermedios)), v]
            if self.adelante[i]:
                filas.extend(serie[:-1])
                cols.extend(serie[1:])
            if self.atras[i]:
                filas.extend(serie[1:])
                cols.extend(serie[:-1])
        coords = np.asarray(coords)
        oi, di = coords[filas], coords[cols]
        metros = haversine_m(oi[:, 1], oi[:, 0], di[:, 1], di[:, 0]).clip(min=1e-7)
        g = csr_array((metros, (np.asarray(filas, dtype=np.int32), np.asarray(cols, dtype=np.int32))),
                      shape=(len(coords), len(coords)))
        enlaces = np.full(len(puntos), np.inf)
        validos = nodo >= 0
        c = coords[nodo[validos]]
        enlaces[validos] = haversine_m(c[:, 1], c[:, 0], puntos[validos, 1], puntos[validos, 0])
        return RedEnlazada(g, coords, nodo, enlaces, np.asarray(puntos))


@dataclass
class RedEnlazada:
    grafo: csr_array
    coords: np.ndarray
    nodo: np.ndarray
    enlace: np.ndarray
    puntos: np.ndarray

    def matriz(self, n_viajes):
        """Origen → estación en el grafo transpuesto y estación → destino en el original."""
        cortes = 2 * n_viajes
        estaciones = self.nodo[cortes:]
        validas = estaciones >= 0
        nodos, inverso = np.unique(estaciones[validas], return_inverse=True)
        salidas = []
        for g, s in ((self.grafo.T.tocsr(), slice(0, n_viajes)), (self.grafo, slice(n_viajes, cortes))):
            puntos = self.nodo[s]
            medidos = puntos >= 0
            d = np.full((n_viajes, len(estaciones)), np.inf)
            if len(nodos) and np.any(medidos):
                r = dijkstra(g, indices=nodos)
                dist = r[inverso[:, None], puntos[medidos][None, :]].T
                d[np.ix_(medidos, validas)] = dist
            d += self.enlace[s, None] + self.enlace[None, cortes:]
            salidas.append(d)
        return np.vstack(salidas)

    def tramo(self, extremo, indice_estacion, n_viajes):
        s = 2 * n_viajes + indice_estacion
        u, v = self.nodo[s], self.nodo[extremo]
        g = self.grafo.T.tocsr() if extremo < n_viajes else self.grafo
        _, prev = dijkstra(g, indices=int(u), return_predecessors=True)
        serie = [int(v)]
        while serie[-1] != u and prev[serie[-1]] >= 0:
            serie.append(int(prev[serie[-1]]))
        if serie[-1] != u:
            return []
        return np.vstack([self.puntos[s], self.coords[serie[::-1]], self.puntos[extremo]]).round(6).tolist()


def finalistas():
    redes = leer("T28_finalistas")
    estaciones = leer("T28_estaciones")
    por_red = estaciones.groupby("network_id")["station_id"].agg(list)
    return redes.assign(estaciones=redes["network_id"].map(por_red)), estaciones


def medir_sector(geo, pie, mismo, radio):
    go, gd = np.split(geo, 2)
    po, pdest = np.split(pie, 2)
    comparables = np.isfinite(po) & np.isfinite(pdest)
    cub_g = (go <= radio) & (gd <= radio)
    cub_p = (po <= radio) & (pdest <= radio)
    n = len(go)
    nc = int(comparables.sum())
    gc = int((cub_g & comparables).sum())
    pc = int((cub_p & comparables).sum())
    ambos = np.r_[comparables, comparables]
    asignables = (geo <= radio) & (pie <= radio)
    assert not np.any(cub_p & ~cub_g)
    return {
        "viajes_sector": n, "viajes_comparables": nc, "viajes_sin_par_rutas": n - nc,
        "linea_total_cubiertos": int(cub_g.sum()), "a_pie_total_verificados": int(cub_p.sum()),
        "linea_cubiertos": gc, "a_pie_cubiertos": pc,
        "pct_linea": 100 * gc / nc if nc else None, "pct_a_pie": 100 * pc / nc if nc else None,
        "delta_pp": 100 * (pc - gc) / nc if nc else None,
        "p90_linea_m": np.quantile(geo[ambos], .9) if nc else None,
        "p90_a_pie_m": np.quantile(pie[ambos], .9) if nc else None,
        "cambios_estacion": int((~mismo & asignables).sum()),
        "extremos_asignables_ambos": int(asignables.sum()),
    }


def juntar_extremos(coleccion):
    mitades = [np.split(x, 2) for x in coleccion]
    return np.concatenate([m[lado] for lado in (0, 1) for m in mitades])


def evaluar(periodo, redes, estaciones):
    """Compara ambos métodos sobre la misma población y los mismos emplazamientos."""
    meta = json.loads(META.read_text(encoding="utf-8"))
    barreras = cargar_barreras()
    viajes = cargar_viajes(periodo=periodo)
    estaciones = estaciones.drop_duplicates("station_id").sort_values("station_id")
    posiciones = estaciones[["lon", "lat"]].to_numpy()
    mapas_ids = {a: i for i, a in enumerate(estaciones["station_id"])}
    todas_geometria, datos_por_red, casos, diagnostico = [], {}, [], []
    for clave, sector in meta["sectores"].items():
        o = dentro(viajes[["lonO", "latO"]], sector["nucleo"])
        d = dentro(viajes[["lonD", "latD"]], sector["nucleo"])
        muestra = viajes.loc[o & d]
        n = len(muestra)
        # Incluso el radio de sensibilidad cabe entre núcleo y borde del grafo.
        no, ns, ne, nn = sector["nucleo"]
        go, gs, ge, gn = sector["recorte"]
        margen = min(haversine_m(nn, no, nn, go), haversine_m(nn, ne, nn, ge),
                     haversine_m(ns, no, gs, no), haversine_m(nn, no, gn, no))
        assert margen > redes["radio_m"].max() + ENLACE_MAX_M
        en_recorte = dentro(posiciones, sector["recorte"])
        candidata = np.flatnonzero(en_recorte)
        puntos = extremos(muestra)
        grafo = Grafo.desde_sector(sector)
        enlazada = grafo.conectar(np.vstack([puntos, posiciones[candidata]]), barreras)
        caminando = np.full((2 * n, len(posiciones)), np.inf)
        caminando[:, candidata] = enlazada.matriz(n)
        linea = distancias(puntos, posiciones)
        diagnostico.append({
            "periodo": periodo, "sector": clave, "viajes_sector": n, "nodos": len(grafo.coords),
            "tramos": len(grafo.extremos), "margen_min_m": float(margen),
            "extremos_sin_enlace": int((enlazada.nodo[:2*n] < 0).sum()),
            "estaciones_sector": len(candidata), "estaciones_sin_enlace": int((enlazada.nodo[2*n:] < 0).sum()),
        })
        for red in redes.itertuples():
            ids = np.array([mapas_ids[i] for i in red.estaciones])
            ix_g = linea[:, ids].argmin(axis=1)
            ix_p = caminando[:, ids].argmin(axis=1)
            dg = linea[np.arange(2 * n), ids[ix_g]]
            dp = caminando[np.arange(2 * n), ids[ix_p]]
            iguales = ix_g == ix_p
            todas_geometria.append({"network_id": red.network_id, "periodo": periodo, "sector": clave,
                                    **medir_sector(dg, dp, iguales, red.radio_m)})
            datos_por_red.setdefault(red.network_id, []).append((dg, dp, iguales))
            if red.rol != "recomendada":
                continue
            recta_misma = linea[np.arange(2 * n), ids[ix_p]]
            malos = np.flatnonzero((recta_misma <= red.radio_m) & (dp > red.radio_m) & np.isfinite(dp))
            if not len(malos):
                continue
            i = int(malos[np.argmax(dp[malos] - recta_misma[malos])])
            est = ids[ix_p[i]]
            local = int(np.searchsorted(candidata, est))
            camino = enlazada.tramo(i, local, n)
            if camino:
                casos.append({
                    "periodo": periodo, "sector": clave, "network_id": red.network_id,
                    "station_id": estaciones.iloc[est]["station_id"],
                    "extremo": "origen" if i < n else "destino",
                    "camino": camino, "recta": [camino[0], camino[-1]],
                    "d_a_pie_m": round(float(dp[i]), 1), "d_recta_m": round(float(linea[i, est]), 1),
                })

    for red in redes.itertuples():
        dg, dp, eq = (juntar_extremos(c) for c in zip(*datos_por_red[red.network_id]))
        todas_geometria.append({"network_id": red.network_id, "periodo": periodo, "sector": "ambos",
                                **medir_sector(dg, dp, eq, red.radio_m)})
    return pd.DataFrame(todas_geometria), pd.DataFrame(diagnostico), casos
