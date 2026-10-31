"""HU-27: recomendador según la encuesta de gustos (filtrado basado en contenido).

Idea: cada producto tiene "características" (géneros, consola, modos de juego) y cada cliente
tiene "gustos" (lo que respondió en la encuesta). Se le da puntos a cada producto según cuánto
se parecen sus características a los gustos del cliente, y se muestran primero los de más puntos.
Junto con los puntos se guarda la "razón" que se le muestra al cliente ("Por tu gusto: Deportes").

Pesos (los mismos del prototipo):
- cada género que coincide: +3
- es de su consola: +2
- calza con cómo juega (en línea / en casa / solo): +2 (+1 si prefiere un jugador)
- lo compró antes en esa categoría: +1
- sin stock hoy (y no es preventa): -4
"""
from dataclasses import dataclass, field

from app.models import PreferenciaCliente, Producto
from app.models.enums import ModoJuego

CONSOLAS = {"PS5": "PS5", "PS5PRO": "PS5", "PS4": "PS4", "PS3": "PS3", "PS2": "PS2", "NO": None}
NOMBRE_CONSOLA = {"PS5": "PS5", "PS5PRO": "PS5 Pro", "PS4": "PS4", "PS3": "PS3", "PS2": "PS2"}


@dataclass
class Gustos:
    """Lo que respondió el cliente, en forma fácil de comparar."""
    generos: dict[str, str] = field(default_factory=dict)  # {'deportes': 'Deportes'}
    consola: str | None = None                              # 'PS5', 'PS5PRO'... o 'NO'
    modo: ModoJuego | None = None

    @classmethod
    def de(cls, pref: PreferenciaCliente | None) -> "Gustos | None":
        if pref is None:
            return None
        return cls({g.id: g.nombre for g in pref.generos}, pref.consola, pref.modo_juego)

    @property
    def vacios(self) -> bool:  # saltó la encuesta
        return not self.generos and not self.consola and self.modo is None

    def perfil(self) -> str:
        """"Juegas Deportes y Acción, en línea con amigos, en PS5" (como el prototipo)."""
        nombres = list(self.generos.values())[:2]
        texto = "Juegas " + (" y ".join(nombres).lower() if nombres else "de todo")
        if self.modo == ModoJuego.online:
            texto += ", en línea con amigos"
        elif self.modo == ModoJuego.local:
            texto += ", con amigos en casa"
        if self.consola in NOMBRE_CONSOLA:
            texto += ", en " + NOMBRE_CONSOLA[self.consola]
        return texto


def puntuar(p: Producto, gustos: Gustos | None, categorias_compradas: set[int] = frozenset()) -> tuple[int, str]:
    """Puntos de un producto para un cliente y la razón principal."""
    puntos, razon = 0, ""
    if gustos:
        coinciden = [g.id for g in p.generos if g.id in gustos.generos]
        if coinciden:
            puntos += 3 * len(coinciden)
            razon = "Por tu gusto: " + gustos.generos[coinciden[0]]
        plataforma = CONSOLAS.get(gustos.consola or "")
        if plataforma and p.plataforma == plataforma:
            puntos += 2
            razon = razon or "Para tu " + NOMBRE_CONSOLA[gustos.consola]
        if p.categoria.es_juego and gustos.modo:
            modos = {m.modo for m in p.modos} or {ModoJuego.solo}
            if gustos.modo == ModoJuego.online and ModoJuego.online in modos:
                puntos += 2
                razon = razon or "Para jugar en línea"
            elif gustos.modo == ModoJuego.local and ModoJuego.local in modos:
                puntos += 2
                razon = razon or "Para dos jugadores"
            elif gustos.modo == ModoJuego.solo and modos == {ModoJuego.solo}:
                puntos += 1
                razon = razon or "Para jugar solo"
    if p.categoria_id in categorias_compradas:
        puntos += 1
        razon = razon or "Por lo que ya compraste"
    if p.stock == 0 and not p.es_preventa:
        puntos -= 4
    return puntos, razon or "Popular en la tienda"
