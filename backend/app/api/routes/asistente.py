"""HU-09 y HU-10: asistente del chat. La IA decide QUÉ quiere el cliente; este archivo decide QUÉ responder.

HU-10 agrega dos intenciones que hacen algo en la tienda: llevar a una sección y agregar al carrito.
"""
import re
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import usuario_opcional
from app.api.routes.productos import _consulta_base, a_salida, calificaciones
from app.database import get_db
from app.ia.asistente import clasificar, limpiar
from app.models import ChatbotMensaje, Cliente, Interes, Producto, Usuario
from app.models.enums import OrigenInteres
from app.schemas import AccionAsistente, AsistenteEntrada, AsistenteSalida

router = APIRouter(prefix="/asistente", tags=["Asistente con IA"])

ASESORES = [AccionAsistente(tipo="whatsapp", etiqueta="Asesor 1 · Ángel", destino="51915152886"),
            AccionAsistente(tipo="whatsapp", etiqueta="Asesor 2 · Linda", destino="51999649195")]

RESPUESTAS = {
    "saludo": "¡Hola! Soy el asistente de Play Shop Tek. Puedo buscarte un juego o una consola, "
              "contarte del taller, el horario o cómo pagar. ¿Qué necesitas?",
    "reparacion": "Reparamos mandos (drift, botones, batería), consolas de PS2 a PS5 y PC. Trae tu equipo a la "
                  "tienda: te lo revisamos, te damos el precio antes de reparar y un código para seguir el avance.",
    "rastreo": "Puedes ver cómo va tu equipo con el código que te dimos (por ejemplo R-2062) "
               "y los 4 últimos dígitos de tu celular.",
    "horario_ubicacion": "Estamos en Av. Revolución 1420, Villa El Salvador. Atendemos de lunes a sábado "
                         "de 12:00 a 20:00 y los domingos de 15:00 a 20:00.",
    "pagos_entrega": "En la web pagas con Yape o tarjeta BCP y recoges en la tienda (por ahora no hacemos delivery). "
                     "En la tienda aceptamos efectivo, Yape y transferencia BCP. Las preventas se reservan con S/ 50.",
    "asesor": "Claro, te paso con un asesor por WhatsApp:",
    "no_entendi": "No estoy seguro de haberte entendido. ¿Te paso con un asesor por WhatsApp?",
    "navegar": "¿A qué sección quieres ir?",
    "agregar_carrito": "¿Qué producto quieres agregar? Dime su nombre, por ejemplo “agrega el FIFA 26”.",
}

# HU-10: palabra que dice el cliente -> sección de la tienda (se revisan en este orden)
SECCIONES = [
    (("pagar", "carrito"), "/carrito", "Carrito"),
    (("compras", "pedidos", "historial"), "/mis-compras", "Mis compras"),
    (("favorito",), "/favoritos", "Favoritos"),
    (("rastre", "reparacion"), "/rastreo", "Rastrear reparación"),
    (("sesion", "cuenta", "login", "registr", "entrar"), "/login", "Iniciar sesión"),
    (("catalogo", "tienda", "inicio", "principal", "productos"), "/", "Tienda"),
]

# Palabras que no ayudan a encontrar el producto ("¿tienen el gta 5 para ps4?" -> "gta 5")
VACIAS = set("""a al algo algun alguna aun busco cual cuales cuanto cuanta cuesta cuestan de del dame disponible el
en es esta estan hay info juego juegos la las lo los me mi muestrame para pa por precio precios que quiero
sale stock su tienen tiene un una unos venden vende ver y o consola consolas comprar vale valen
agrega agregalo agregame agregar agrego anade anadelo anadir pon ponlo mete echalo carrito si ok dale ese eso
llevo llevarme separalo dos uno compro""".split())
ROMANOS = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7"}
SINONIMOS = [(r"\bgrand theft auto\b", "gta"), (r"\bcall of duty\b", "cod"), (r"\bcontrol(es)?\b", "mando"),
             (r"\bplaystation\b", "ps"), (r"\bplay\b", "ps"), (r"\bps (\d)\b", r"ps\1"), (r"\bspider man\b", "spiderman")]


def _palabras(texto: str) -> list[str]:
    t = limpiar(texto)
    for patron, cambio in SINONIMOS:
        t = re.sub(patron, cambio, t)
    return [ROMANOS.get(p, p) for p in t.split()]


def buscar_productos(db: Session, mensaje: str, limite: int = 3) -> list:
    """Busca por coincidencia de palabras. Si el cliente dice la plataforma (ps4), filtra por ella."""
    todas = _palabras(mensaje)
    solo_juegos = "juego" in todas or "juegos" in todas
    palabras = [p for p in todas if p not in VACIAS]
    plataformas = {p.upper() for p in palabras if re.fullmatch(r"ps[2-5]", p)}
    claves = [p for p in palabras if p.upper() not in plataformas]
    if not claves and not plataformas:
        return []
    puntajes = []
    for p in db.scalars(_consulta_base()):
        if plataformas and p.plataforma not in plataformas:
            continue
        if solo_juegos and p.categoria.nombre not in ("PS5", "PS4", "PS3", "PS2"):
            continue
        nombre = _palabras(p.nombre)
        if any(c.isdigit() and c not in nombre for c in claves):
            continue  # "gta 6" no es "GTA V": si el número no coincide, no es ese producto
        puntos = sum(1 for c in claves if any(n == c or (len(c) >= 4 and n.startswith(c)) for n in nombre))
        if puntos or not claves:
            puntajes.append((puntos, p.stock > 0, p))
    if not puntajes:
        return []
    mejor = max(x[0] for x in puntajes)
    elegidos = sorted((x for x in puntajes if x[0] == mejor), key=lambda x: (not x[1], x[2].id))[:limite]
    notas = calificaciones(db)
    return [a_salida(p, notas) for _, _, p in elegidos]


@router.post("", response_model=AsistenteSalida)
def conversar(datos: AsistenteEntrada, db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Público. Clasifica el mensaje con el modelo de IA y arma la respuesta según la intención."""
    intencion, confianza = clasificar(datos.mensaje)
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id)) if usuario else None
    cliente_id = cliente.id if cliente else None
    respuesta, productos, acciones = RESPUESTAS.get(intencion, RESPUESTAS["no_entendi"]), [], []

    if intencion == "buscar_producto":
        productos = buscar_productos(db, datos.mensaje)
        if productos:
            respuesta = "Esto es lo que tenemos:" if len(productos) > 1 else "Sí lo tenemos:"
        else:
            # Lo que no tenemos se guarda como búsqueda sin resultado: así Ángel sabe qué traer (HU-11)
            respuesta = "Ahora no lo tenemos, pero ya lo anoté para que Ángel sepa que lo buscaste. ¿Quieres consultar con un asesor?"
            texto = " ".join(p for p in _palabras(datos.mensaje) if p not in VACIAS)[:80]
            if len(texto) >= 3:
                db.add(Interes(texto=texto, origen=OrigenInteres.chatbot, cliente_id=cliente_id,
                               tuvo_resultados=False, fecha=date.today()))
            acciones = ASESORES
    elif intencion == "navegar":
        t = limpiar(datos.mensaje)
        destino = next(((ruta, nombre) for claves, ruta, nombre in SECCIONES if any(c in t for c in claves)), None)
        if destino:
            respuesta = f"Te llevo a {destino[1]}."
            acciones = [AccionAsistente(tipo="ir", etiqueta=destino[1], destino=destino[0])]
        else:
            acciones = [AccionAsistente(tipo="ir", etiqueta=nombre, destino=ruta) for _, ruta, nombre in SECCIONES[:4]]
    elif intencion == "agregar_carrito":
        # Si nombra el producto se busca; si dice "agrégalo", se usa el último que mostró el chat
        encontrados = buscar_productos(db, datos.mensaje, limite=1)
        if not encontrados and datos.ultimo_producto_id:
            p = db.scalar(_consulta_base().where(Producto.id == datos.ultimo_producto_id))
            encontrados = [a_salida(p, calificaciones(db))] if p else []
        if encontrados:
            p = encontrados[0]
            productos = encontrados
            if p.stock > 0:
                respuesta = f"Listo, agregué {p.nombre} a tu carrito."
                acciones = [AccionAsistente(tipo="agregar", etiqueta="Ver carrito", destino="/carrito", producto_id=p.id)]
            else:
                respuesta = f"{p.nombre} está agotado. Puedes pedir que te avisemos cuando llegue desde su ficha."
    elif intencion == "rastreo":
        acciones = [AccionAsistente(tipo="ir", etiqueta="Rastrear mi reparación", destino="/rastreo")]
    elif intencion in ("asesor", "no_entendi", "reparacion"):
        acciones = ASESORES

    # Se guarda cada mensaje (sin datos de pago) para medir el modelo y volver a entrenarlo con casos reales
    db.add(ChatbotMensaje(sesion=datos.sesion, cliente_id=cliente_id, texto=datos.mensaje,
                          intencion=intencion, confianza=round(confianza, 3), derivado_whatsapp=intencion == "no_entendi"))
    db.commit()
    return AsistenteSalida(intencion=intencion, confianza=round(confianza, 3), respuesta=respuesta,
                           productos=productos, acciones=acciones)
