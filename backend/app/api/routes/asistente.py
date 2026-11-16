"""HU-09 y HU-10: asistente del chat. La IA decide QUÉ quiere el cliente; este archivo decide QUÉ responder.

HU-10 agrega dos intenciones que hacen algo en la tienda: llevar a una sección y agregar al carrito.
Mejora (como el prototipo): entiende plurales y categorías ("¿venden mandos?" -> los mandos, con "Ver todo"),
recomienda según la encuesta de gustos (HU-27) y muestra los servicios del taller.
"""
import re

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import usuario_opcional
from app.api.routes.inicio import cliente_de, compras_del_cliente, recomendados, servicios_del_taller, unidades_vendidas
from app.api.routes.intereses import anotar
from app.api.routes.productos import _consulta_base, a_salida, calificaciones
from app.database import get_db
from app.ia.asistente import clasificar, limpiar
from app.ia.recomendador import CONSOLAS, NOMBRE_CONSOLA, Gustos, compatible, puntuar
from app.models import ChatbotMensaje, Cliente, Producto, Usuario
from app.models.enums import OrigenInteres
from app.schemas import AccionAsistente, AsistenteEntrada, AsistenteSalida, ServicioInicio

router = APIRouter(prefix="/asistente", tags=["Asistente con IA"])

ASESORES = [AccionAsistente(tipo="whatsapp", etiqueta="Asesor 1 · Ángel", destino="51915152886"),
            AccionAsistente(tipo="whatsapp", etiqueta="Asesor 2 · Linda", destino="51999649195")]

RESPUESTAS = {
    "saludo": "¡Hola! Soy el asistente de Play Shop Tek. Puedo buscarte un juego o una consola, "
              "contarte del taller, el horario o cómo pagar. ¿Qué necesitas?",
    "reparacion": "Sí atendemos eso. Estos son nuestros servicios técnicos: el diagnóstico es gratis y el precio final "
                  "lo acuerdas con un asesor por WhatsApp. Luego sigues el avance con tu código de reparación.",
    "rastreo": "Puedes ver cómo va tu equipo con el código que te dimos (por ejemplo R-2062) "
               "y los 4 últimos dígitos de tu celular.",
    "horario_ubicacion": "Estamos en Av. Revolución 1420, Villa El Salvador. Atendemos de lunes a sábado "
                         "de 12:00 a 20:00 y los domingos de 15:00 a 20:00.",
    "pagos_entrega": "En la web pagas con Yape o tarjeta BCP y recoges en la tienda (por ahora no hacemos delivery). "
                     "En la tienda aceptamos efectivo, Yape y transferencia BCP. Las preventas se reservan con S/ 50.",
    "asesor": "Claro, te paso con un asesor por WhatsApp:",
    "recomendar": "Esto es lo más pedido en la tienda. Si creas tu cuenta y me cuentas qué juegas, te recomiendo mejor.",
    "no_entendi": "No estoy seguro de haberte entendido. ¿Te paso con un asesor por WhatsApp?",
    "navegar": "¿A qué sección quieres ir?",
    "agregar_carrito": "¿Qué producto quieres agregar? Dime su nombre, por ejemplo “agrega el FIFA 26”.",
}

# HU-10: palabra que dice el cliente -> sección de la tienda (se revisan en este orden)
SECCIONES = [
    (("pagar", "carrito"), "/carrito", "Carrito"),
    (("oferta", "descuento", "promo"), "/ofertas", "Ofertas"),
    (("compras", "pedidos", "historial"), "/mis-compras", "Mis compras"),
    (("favorito",), "/favoritos", "Favoritos"),
    (("rastre", "seguimiento"), "/rastreo", "Rastrear reparación"),
    (("reparacion", "taller", "servicio tecnico"), "/reparaciones", "Reparaciones"),
    (("gusto", "encuesta", "preferencia"), "/encuesta", "Mis gustos"),
    (("sesion", "cuenta", "login", "registr", "entrar"), "/login", "Iniciar sesión"),
    (("catalogo", "productos"), "/catalogo", "Catálogo"),
    (("tienda", "inicio", "principal"), "/", "Inicio"),
]

# "¿Venden mandos?" / "¿qué consolas tienen?": palabras que piden una categoría entera
CATEGORIAS = {"mando": "Mandos", "consola": "Máquinas", "maquina": "Máquinas"}

# Palabras que no ayudan a encontrar el producto ("¿tienen el gta 5 para ps4?" -> "gta 5")
VACIAS = set("""a al algo algun alguna aun busco cual cuales cuanto cuanta cuesta cuestan de del dame disponible el
en es esta estan hay info juego juegos la las lo los me mi muestrame para pa por precio precios que quiero
sale stock su tienen tiene un una unos venden vende ver y o consola consolas comprar vale valen
agrega agregalo agregame agregar agrego anade anadelo anadir pon ponlo mete echalo carrito si ok dale ese eso
llevo llevarme separalo dos uno compro cuale alguno tiene vendes vende ustede the of""".split())
ROMANOS = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7"}
SINONIMOS = [(r"\bgrand theft auto\b", "gta"), (r"\bcall of duty\b", "cod"), (r"\bcontrol(es)?\b", "mando"),
             (r"\bplaystation\b", "ps"), (r"\bplay\b", "ps"), (r"\bps (\d)\b", r"ps\1"), (r"\bspider man\b", "spiderman")]


def _singular(p: str) -> str:
    """'mandos' -> 'mando', 'audifonos' -> 'audifono' (así "¿venden mandos?" encuentra "Mando DualSense")."""
    return p[:-1] if len(p) >= 5 and p.endswith("s") and not p.endswith("ss") else p


def _palabras(texto: str) -> list[str]:
    t = limpiar(texto)
    for patron, cambio in SINONIMOS:
        t = re.sub(patron, cambio, t)
    return [_singular(ROMANOS.get(p, p)) for p in t.split()]


def categoria_pedida(mensaje: str) -> str | None:
    """Si el cliente pide una categoría entera ("¿venden mandos?"), cuál es."""
    return next((CATEGORIAS[p] for p in _palabras(mensaje) if p in CATEGORIAS), None)


def ver_todo(mensaje: str) -> str | None:
    """Categoría del catálogo para el botón "Ver todo": "mandos" -> Mandos; "juegos de ps2" -> PS2."""
    palabras = _palabras(mensaje)
    plataformas = {p.upper() for p in palabras if re.fullmatch(r"ps[2-5]", p)}
    if "juego" in palabras and len(plataformas) == 1:
        return plataformas.pop()
    return categoria_pedida(mensaje)


def buscar_productos(db: Session, mensaje: str, limite: int = 3, gustos: Gustos | None = None) -> tuple[list, int, bool]:
    """Busca por coincidencia de palabras. Si el cliente dice la plataforma (ps4), filtra por ella; si nombra una
    categoría ("mandos", "consolas"), filtra por ella. Devuelve los mejores y cuántos coinciden en total.
    Con cuenta y encuesta (HU-27), a igual coincidencia muestra primero lo que va con sus gustos.
    El tercer valor dice si es el producto pedido (coinciden TODAS las palabras) o solo algo parecido:
    "the evil within" no es "Resident Evil 4", y "diablo 4" tampoco (que coincida solo el número no cuenta)."""
    todas = _palabras(mensaje)
    solo_juegos = "juego" in todas
    categoria = categoria_pedida(mensaje)
    palabras = [p for p in todas if p not in VACIAS and p not in CATEGORIAS]
    plataformas = {p.upper() for p in palabras if re.fullmatch(r"ps[2-5]", p)}
    claves = [p for p in palabras if p.upper() not in plataformas]
    if not claves and not plataformas and not categoria:
        return [], 0, False
    textos = [c for c in claves if not c.isdigit()]  # los números ya se exigen abajo
    puntajes = []
    for p in db.scalars(_consulta_base().options(selectinload(Producto.modos))):
        if plataformas and p.plataforma not in plataformas:
            continue
        if solo_juegos and not p.categoria.es_juego:
            continue
        if categoria and p.categoria.nombre != categoria:
            continue
        nombre = _palabras(p.nombre)
        if any(c.isdigit() and c not in nombre for c in claves):
            continue  # "gta 6" no es "GTA V": si el número no coincide, no es ese producto
        puntos = sum(1 for c in textos if any(n == c or (len(c) >= 4 and n.startswith(c)) for n in nombre))
        if puntos or not textos:
            puntajes.append((puntos, p.stock > 0 or p.es_preventa, puntuar(p, gustos)[0], p))
    if not puntajes:
        return [], 0, False
    mejor = max(x[0] for x in puntajes)
    iguales = [x for x in puntajes if x[0] == mejor]
    elegidos = sorted(iguales, key=lambda x: (not x[1], -x[2], x[3].id))[:limite]
    notas = calificaciones(db)
    return [a_salida(p, notas) for *_, p in elegidos], len(iguales), mejor == len(textos)


# "Recomiéndame algo de terror", "un mando bueno y barato": lo que pide el mensaje manda sobre la encuesta
GENEROS_PALABRAS = {"accion": "Acción", "soul": "Acción", "historia": "Aventura", "aventura": "Aventura", "carrera": "Carreras", "auto": "Carreras",
                    "deporte": "Deportes", "futbol": "Deportes", "disparo": "Disparos", "shooter": "Disparos",
                    "balacera": "Disparos", "familia": "Familiar", "nino": "Familiar", "niño": "Familiar",
                    "hijo": "Familiar", "sobrino": "Familiar", "pelea": "Pelea", "lucha": "Pelea", "rol": "Rol",
                    "rpg": "Rol", "terror": "Terror", "miedo": "Terror", "zombi": "Terror"}
PERIFERICOS = {"audifono": "audífonos", "teclado": "teclados", "mouse": "mouse", "monitor": "monitores",
               "ram": "memorias RAM", "ssd": "discos SSD"}
BARATO = ("barato", "economico", "calidad precio", "buen precio", "precio")
PLURAL = {"Mandos": "mandos", "Máquinas": "consolas"}


def recomendar_segun_mensaje(db: Session, mensaje: str, usuario: Usuario | None):
    """Recomienda leyendo el mensaje (género, consola, mandos/consolas/periféricos, precio) y la encuesta.
    Devuelve (productos, respuesta, acciones) o None si el mensaje no pide nada en particular."""
    palabras = _palabras(mensaje)
    texto = " ".join(palabras)
    cliente = cliente_de(db, usuario)
    gustos = Gustos.de(cliente.preferencias) if cliente else None
    if gustos and gustos.vacios:
        gustos = None
    generos = {nombre for p in palabras for clave, nombre in GENEROS_PALABRAS.items() if p.startswith(clave)}
    plataforma_msg = next((p.upper() for p in palabras if re.fullmatch(r"ps[2-5]", p)), None)
    consola = plataforma_msg or (CONSOLAS.get(gustos.consola or "") if gustos else None)
    categoria = categoria_pedida(mensaje)
    periferico = next((k for k in PERIFERICOS if any(p.startswith(k) for p in palabras)), None)
    barato = any(b in texto for b in BARATO)
    tope = re.search(r"(?:menos de|hasta|maximo|no mas de)\s*(?:s\s*)?(\d{2,5})", limpiar(mensaje))
    tope = int(tope.group(1)) if tope else None
    if not (generos or plataforma_msg or categoria or periferico or barato or tope):
        return None  # "¿qué me recomiendas?": se usa la encuesta tal cual (ver más abajo)

    if categoria == "Mandos" and not consola:
        return [], ("¿Para qué consola es el mando? Cada consola usa sus propios mandos. "
                    "Escríbeme, por ejemplo: “mando barato para PS4”."), []
    ya_tiene, le_gusta = compras_del_cliente(db, cliente)
    vendidos, notas, elegidos = unidades_vendidas(db), calificaciones(db), []
    for p in db.scalars(_consulta_base().options(selectinload(Producto.modos))):
        if p.stock == 0 or p.es_preventa or p.id in ya_tiene:
            continue
        if periferico:
            if p.categoria.nombre != "PC y periféricos" or periferico not in limpiar(p.nombre):
                continue
        elif categoria:
            if p.categoria.nombre != categoria:
                continue
        elif not p.categoria.es_juego:
            continue  # sin decir qué, se recomiendan juegos
        if not compatible(p, consola):
            continue  # a quien tiene PS4 no le sirven los juegos ni los mandos de PS5
        if categoria == "Máquinas" and consola and p.plataforma < consola:
            continue  # si ya tiene PS4, no se le recomienda una PS3 ("PS3" < "PS4" también como texto)
        nombres = {g.nombre for g in p.generos}
        if generos and p.categoria.es_juego and not generos & nombres:
            continue  # pidió terror: solo terror
        salida = a_salida(p, notas)
        if tope and salida.precio_final > tope:
            continue
        puntos = puntuar(p, gustos, le_gusta)[0] + 4 * len(generos & nombres) + 3 * (p.plataforma == plataforma_msg)
        elegidos.append((salida, puntos, vendidos.get(p.id, 0)))

    if barato or tope:
        elegidos.sort(key=lambda x: (x[0].precio_final, -x[1]))
    else:
        elegidos.sort(key=lambda x: (-x[1], -x[2], x[0].precio_final))
    productos = [x[0] for x in elegidos[:3]]

    que = PERIFERICOS.get(periferico) or PLURAL.get(categoria, "juegos")
    detalle = ""
    if generos:
        detalle += " " + " y ".join("familiares" if g == "Familiar" else "de " + g.lower() for g in sorted(generos))
    if consola and not (periferico or categoria == "Máquinas"):  # la consola solo importa en juegos y mandos
        nombre = NOMBRE_CONSOLA.get(gustos.consola, consola) if gustos and not plataforma_msg else consola
        detalle += f" para {plataforma_msg}" if plataforma_msg else f" para tu {nombre} (según tu encuesta)"
    if tope:
        detalle += f" de hasta S/ {tope}"
    acciones = [AccionAsistente(tipo="ir", etiqueta="Ajustar mis gustos", destino="/encuesta")] if gustos else []
    if not productos:
        return [], f"Ahora no tengo {que}{detalle} con stock. ¿Te paso con un asesor para que lo consiga?", ASESORES
    p = productos[0]
    respuesta = (f"Buscando {que}{detalle}" + (", con el mejor precio" if barato else "")
                 + f": te recomiendo {p.nombre} a S/ {p.precio_final:,.0f}.")
    originales = [x for x in productos[1:] if "generico" not in limpiar(x.nombre)]
    if categoria == "Mandos" and barato and "generico" in limpiar(p.nombre) and originales:
        respuesta += f" Si prefieres el original, {originales[0].nombre} cuesta S/ {originales[0].precio_final:,.0f}."
    elif len(productos) > 1:
        respuesta += " También te muestro otras opciones:"
    return productos, respuesta, acciones


@router.post("", response_model=AsistenteSalida)
def conversar(datos: AsistenteEntrada, db: Session = Depends(get_db), usuario: Usuario | None = Depends(usuario_opcional)):
    """Público. Clasifica el mensaje con el modelo de IA y arma la respuesta según la intención."""
    intencion, confianza = clasificar(datos.mensaje)
    cliente = db.scalar(select(Cliente).where(Cliente.usuario_id == usuario.id)) if usuario else None
    cliente_id = cliente.id if cliente else None
    respuesta, productos, acciones = RESPUESTAS.get(intencion, RESPUESTAS["no_entendi"]), [], []
    servicios: list[ServicioInicio] = []
    gustos = Gustos.de(cliente.preferencias) if cliente else None

    if intencion == "buscar_producto":
        productos, total, exacto = buscar_productos(db, datos.mensaje, gustos=gustos)
        categoria = ver_todo(datos.mensaje)
        buscado = " ".join(p for p in _palabras(datos.mensaje) if p not in VACIAS or p in ("the", "of"))[:80]
        if productos and not exacto:
            # Solo se parece ("the evil within" -> Resident Evil): decirlo claro, mostrar lo parecido y anotarlo para Ángel
            respuesta = (f"No tenemos “{buscado}” por ahora; ya lo anoté para que Ángel sepa que lo buscaste. "
                         "Esto es lo más parecido que hay:")
            anotar(db, buscado, OrigenInteres.chatbot, cliente_id, tuvo_resultados=False)
            acciones = ASESORES
        elif productos and categoria and total > len(productos):
            # "¿Venden mandos?": algunos y el botón para ver todos en el catálogo
            nombre = "Juegos " + categoria if categoria.startswith("PS") else categoria
            respuesta = f"Sí, encontré {total} opciones en {nombre}. Te muestro {len(productos)}; desliza para verlas:"
            acciones = [AccionAsistente(tipo="ir", etiqueta=f"Ver todo en {nombre}", destino=f"/catalogo?categoria={categoria}")]
        elif productos and all(p.stock == 0 and not p.es_preventa for p in productos):
            respuesta = (f"{productos[0].nombre} está agotado por ahora. Pulsa «Avísame cuando llegue» y te escribimos apenas llegue."
                         if len(productos) == 1 else "Esos productos están agotados por ahora. Pide que te avisemos cuando lleguen:")
        elif productos:
            respuesta = f"Encontré {len(productos)} opciones. Desliza para ver todas:" if len(productos) > 1 else f"Sí, tenemos {productos[0].nombre}."
        else:
            # Lo que no tenemos se guarda como búsqueda sin resultado: así Ángel sabe qué traer (HU-11)
            respuesta = "Ahora no lo tenemos, pero ya lo anoté para que Ángel sepa que lo buscaste. ¿Quieres consultar con un asesor?"
            anotar(db, buscado, OrigenInteres.chatbot, cliente_id, tuvo_resultados=False)
            acciones = ASESORES
    elif intencion == "recomendar" and (pedido := recomendar_segun_mensaje(db, datos.mensaje, usuario)) is not None:
        productos, respuesta, acciones = pedido
    elif intencion == "recomendar":
        # HU-27: usa el mismo recomendador que "Recomendado para ti" (encuesta de gustos + compras)
        productos, _, _, perfil = recomendados(db, usuario, 12)
        if "juego" in _palabras(datos.mensaje):  # "recomiéndame un juego": solo juegos
            productos = [p for p in productos if p.categoria.startswith("PS")] or productos
        productos = productos[:3]
        if perfil and productos:
            p = productos[0]
            respuesta = (f"Por lo que respondiste ({perfil[7:]}), te iría bien {p.nombre} a S/ {p.precio_final:,.0f}. "
                         "También te muestro otras opciones:")
            acciones = [AccionAsistente(tipo="ir", etiqueta="Ajustar mis gustos", destino="/encuesta")]
        elif cliente:
            respuesta = "Todavía no sé qué te gusta jugar. Cuéntame en 3 pasos y te recomiendo mejor; mientras, esto es lo más pedido:"
            acciones = [AccionAsistente(tipo="ir", etiqueta="Contarte mis gustos", destino="/encuesta")]
        else:
            acciones = [AccionAsistente(tipo="ir", etiqueta="Crear mi cuenta", destino="/login?crear=1")]
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
        encontrados, _, exacto = buscar_productos(db, datos.mensaje, limite=1)
        if not exacto:
            encontrados = []  # "agrega el diablo 4" no debe agregar Resident Evil 4
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
    elif intencion == "reparacion":
        servicios = servicios_del_taller(db, 6)
        acciones = ASESORES
    elif intencion in ("asesor", "no_entendi"):
        acciones = ASESORES

    # Se guarda cada mensaje (sin datos de pago) para medir el modelo y volver a entrenarlo con casos reales
    db.add(ChatbotMensaje(sesion=datos.sesion, cliente_id=cliente_id, texto=datos.mensaje,
                          intencion=intencion, confianza=round(confianza, 3), derivado_whatsapp=intencion == "no_entendi"))
    db.commit()
    return AsistenteSalida(intencion=intencion, confianza=round(confianza, 3), respuesta=respuesta,
                           productos=productos, acciones=acciones, servicios=servicios)
