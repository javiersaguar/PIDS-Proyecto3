"""Intercambios de emplazamientos con cobertura completa protegida."""

import numpy as np


def _ganancia(o, d, ambos, co, cd, umbral, pesos):
    acceso_o, acceso_d = co >= umbral, cd >= umbral
    al_limite_o, al_limite_d = co == umbral - 1, cd == umbral - 1
    base = pesos @ (acceso_o & acceso_d)
    return (base + (pesos * (al_limite_o & acceso_d)) @ o
            + (pesos * (acceso_o & al_limite_d)) @ d
            + (pesos * (al_limite_o & al_limite_d)) @ ambos)


def intercambiar(modelo, base, pesos, objetivo, maximo, protegidas=(), minimo_cubiertos=None):
    """Mejora local exhaustiva de un intercambio, con desempate estable.

    `objetivo` exige ese número de sitios accesibles en cada extremo del
    índice ponderado. Por defecto se conserva la cobertura completa de la base.
    """
    o, d = modelo.O, modelo.D
    ambos = o.multiply(d).tocsr()
    oc, dc = o.tocsc(), d.tocsc()
    red = np.sort(np.asarray(base, dtype=int))
    unitarios = np.ones(o.shape[0], dtype=float)
    co = np.asarray(o[:, red].sum(axis=1)).ravel()
    cd = np.asarray(d[:, red].sum(axis=1)).ravel()
    suelo = int(((co >= 1) & (cd >= 1)).sum()) if minimo_cubiertos is None else minimo_cubiertos
    actual = float(pesos @ ((co >= objetivo) & (cd >= objetivo)))
    fijas = set(protegidas)
    historial = []
    for paso in range(maximo):
        cerradas = np.setdiff1d(np.arange(modelo.n), red)
        mejor = None
        for sale in red:
            if sale in fijas:
                continue
            a = co - oc[:, [sale]].toarray().ravel()
            b = cd - dc[:, [sale]].toarray().ravel()
            cobertura = _ganancia(o, d, ambos, a, b, 1, unitarios)
            valor = _ganancia(o, d, ambos, a, b, objetivo, pesos)
            posibles = cerradas[(cobertura[cerradas] >= suelo) & (valor[cerradas] > actual + 1e-10)]
            if not len(posibles):
                continue
            entra = min(posibles, key=lambda j: (-round(valor[j], 10), -cobertura[j], j))
            clave = (-round(valor[entra], 10), -cobertura[entra], sale, entra)
            if mejor is None or clave < mejor[0]:
                mejor = clave, sale, entra, valor[entra], int(cobertura[entra])
        if mejor is None:
            break
        _, sale, entra, valor, cubiertos = mejor
        co += (oc[:, [entra]].toarray() - oc[:, [sale]].toarray()).ravel()
        cd += (dc[:, [entra]].toarray() - dc[:, [sale]].toarray()).ravel()
        assert cubiertos == ((co >= 1) & (cd >= 1)).sum()
        assert np.isclose(valor, pesos @ ((co >= objetivo) & (cd >= objetivo)))
        red = np.sort(np.r_[red[red != sale], entra])
        historial.append({"paso": paso + 1, "sale": int(sale), "entra": int(entra),
                          "valor_antes": actual, "valor_despues": float(valor), "viajes_cubiertos": cubiertos})
        actual = valor
    return red, historial


def _cubiertos_sin(o, d, ambos, a, b, oc, dc, cierres, pesos):
    """Viajes cubiertos (ponderados) sumados sobre cada cierre de `cierres` por separado."""
    total = 0.
    for c in cierres:
        total = total + _ganancia(o, d, ambos, a - oc[:, [c]].toarray().ravel(),
                                  b - dc[:, [c]].toarray().ravel(), 1, pesos)
    return total


def blindar(modelo, base, cierres, maximo, minimo_cubiertos):
    """Intercambios que maximizan la cobertura que queda al cerrar cada sitio de `cierres`.

    Los sitios de `cierres` no se retiran y la cobertura con todas las estaciones
    abiertas no baja de `minimo_cubiertos`. Mismo desempate estable que `intercambiar`.
    """
    o, d = modelo.O, modelo.D
    ambos = o.multiply(d).tocsr()
    oc, dc = o.tocsc(), d.tocsc()
    red = np.sort(np.asarray(base, dtype=int))
    unos = np.ones(o.shape[0], dtype=float)
    co = np.asarray(o[:, red].sum(axis=1)).ravel()
    cd = np.asarray(d[:, red].sum(axis=1)).ravel()

    def robustez(a, b):
        return sum(float(unos @ ((a - oc[:, [c]].toarray().ravel() >= 1) & (b - dc[:, [c]].toarray().ravel() >= 1)))
                   for c in cierres)

    actual = robustez(co, cd)
    fijas = set(cierres)
    historial = []
    for paso in range(maximo):
        cerradas = np.setdiff1d(np.arange(modelo.n), red)
        mejor = None
        for sale in red:
            if sale in fijas:
                continue
            a = co - oc[:, [sale]].toarray().ravel()
            b = cd - dc[:, [sale]].toarray().ravel()
            cobertura = _ganancia(o, d, ambos, a, b, 1, unos)
            valor = _cubiertos_sin(o, d, ambos, a, b, oc, dc, cierres, unos)
            posibles = cerradas[(cobertura[cerradas] >= minimo_cubiertos) & (valor[cerradas] > actual + 1e-10)]
            if not len(posibles):
                continue
            entra = min(posibles, key=lambda j: (-round(valor[j], 10), -cobertura[j], j))
            clave = (-round(valor[entra], 10), -cobertura[entra], sale, entra)
            if mejor is None or clave < mejor[0]:
                mejor = clave, sale, entra, valor[entra], int(cobertura[entra])
        if mejor is None:
            break
        _, sale, entra, valor, cubiertos = mejor
        co += (oc[:, [entra]].toarray() - oc[:, [sale]].toarray()).ravel()
        cd += (dc[:, [entra]].toarray() - dc[:, [sale]].toarray()).ravel()
        assert cubiertos == ((co >= 1) & (cd >= 1)).sum()
        assert np.isclose(valor, robustez(co, cd))
        red = np.sort(np.r_[red[red != sale], entra])
        historial.append({"paso": paso + 1, "sale": int(sale), "entra": int(entra),
                          "valor_antes": actual, "valor_despues": float(valor), "viajes_cubiertos": cubiertos})
        actual = valor
    return red, historial
