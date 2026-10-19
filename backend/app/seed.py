"""Carga los datos de ejemplo del prototipo en la base de datos.

Uso:  python -m app.seed            (solo si la base está vacía)
      python -m app.seed --reiniciar (borra todo y vuelve a cargar)

Los datos salen de seed_data/prototipo.json, extraído del prototipo de Claude
Design con scripts/extraer_datos_prototipo.js. Las fechas se corren para que
siempre parezcan recientes (lo que en el prototipo era "hace 3 días" sigue
siendo "hace 3 días" hoy).

IMPORTANTE: son datos de EJEMPLO. Cuando Ángel entregue las ventas reales,
se cargarán con otro script y estos se borran.
"""
import json
import re
import sys
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select, text

from app.config import settings
from app.core.security import hash_password
from app.database import Base, SessionLocal
from app.models import (
    AvisoLlegada, Banner, Categoria, CategoriaFalla, Cita, CitaMensaje, Cliente, Condicion, Empleado, Favorito,
    Genero, GrupoInteres, Interes, Notificacion, Oferta, PreferenciaCliente, Producto, ProductoEtiqueta,
    ProductoModo, Reparacion, ReparacionHistorial, Resena, TipoServicio, Usuario, Venta, VentaItem,
)
from app.models.enums import (
    AutorMensaje, Canal, EstadoReparacion, EstadoVenta, GrupoCondicion, MetodoPago, ModoJuego, OrigenInteres,
    OrigenResena, PagoReparacion, Rol,
)

DATOS = json.loads((Path(__file__).parent / "seed_data" / "prototipo.json").read_text(encoding="utf-8"))
DESFASE = date.today() - date.fromisoformat(DATOS["exportado"])


def fecha(iso: str) -> date:
    return date.fromisoformat(iso) + DESFASE


def num_de(txt: str) -> int:
    """Mismo número "al azar pero fijo" que usa el prototipo (numDe)."""
    n = 0
    for c in txt:
        n = (n * 31 + ord(c)) % 997
    return n


CATEGORIAS = ["PS2", "PS3", "PS4", "PS5", "Máquinas", "Mandos", "PC y periféricos"]
CONDICIONES = [  # (texto que ve el cliente, grupo del filtro) — opciones del formulario del prototipo
    ("Nuevo, sellado", GrupoCondicion.nuevo), ("Nueva, sellada", GrupoCondicion.nuevo),
    ("Nuevo", GrupoCondicion.nuevo), ("Nuevo, caja abierta", GrupoCondicion.nuevo),
    ("Usado, como nuevo", GrupoCondicion.usado), ("Usado, completo", GrupoCondicion.usado),
    ("Usado, buen estado", GrupoCondicion.usado), ("Usado, solo disco", GrupoCondicion.usado),
    ("Reacondicionada en taller", GrupoCondicion.reacondicionado), ("Repotenciada en taller", GrupoCondicion.reacondicionado),
    ("Usada, revisada en taller", GrupoCondicion.reacondicionado), ("Reacondicionado en taller", GrupoCondicion.reacondicionado),
]
ESTADO_VENTA = {"Pagado": EstadoVenta.pagado, "Reservado": EstadoVenta.reservado,
                "Listo para recoger": EstadoVenta.listo_para_recoger, "Entregado": EstadoVenta.entregado,
                "Cancelado": EstadoVenta.cancelado}
ESTADO_REP = {"Recibido": EstadoReparacion.recibido, "Diagnosticado": EstadoReparacion.diagnosticado,
              "En reparación": EstadoReparacion.en_reparacion, "Listo para recoger": EstadoReparacion.listo_para_recoger,
              "Entregado": EstadoReparacion.entregado}
ORDEN_REP = list(ESTADO_REP.values())
PAGO_REP = {"Pendiente": PagoReparacion.pendiente, "Yape": PagoReparacion.yape, "En tienda": PagoReparacion.efectivo}
FALLAS = ["Drift de stick", "Sobrecalentamiento", "Batería", "No lee discos", "Gatillos y botones", "No enciende",
          "HDMI dañado", "Mejora de rendimiento", "Limpieza preventiva", "Otras fallas"]

# Mismas 12 líneas que usa el prototipo para generar ventas (para reconstruir el 2.º producto)
ITEMS_VENTA = ["PlayStation 3 Super Slim 500GB", "Mando DualShock 3 Inalámbrico", "PlayStation 4 Slim 1TB",
               "Mando DualShock 4 V2 Negro", "Pro Evolution Soccer 2019 (PS3)", "PlayStation 3 Slim 320GB",
               "GTA V (PS3)", "FIFA 26 (PS5)", "Mando DualSense Blanco", "PlayStation 5 Slim Digital",
               "God of War Ragnarök (PS5)", "Mortal Kombat 1 (PS5)"]

# Reseñas generadas que el prototipo muestra en cada ficha (resenasTodas)
RES_NOMBRES = ["Jordan Zapata", "Katherine Ñahui", "Alexander Mamani", "Sheyla Quiroz", "Luis Quispe", "Carla Sifuentes",
               "Elmer Vilca", "Fiorella Mendoza", "Brayan Chumpitaz", "Jhon Ramírez", "Yesenia Palomino",
               "Cristhian Caruajulca", "Diego Huarcaya", "Ruth Condori", "Anthony Lázaro", "Maricielo Rojas"]
RES_TEXTOS = ["Tal como lo describen. Me lo mostraron funcionando antes de pagar.",
              "Buen precio para Villa El Salvador, no tuve que ir hasta el centro.",
              "Atención rápida por WhatsApp y me guardaron el producto hasta el sábado.",
              "Lo recogí el mismo día. Todo en orden y con boleta.",
              "Llegué sin saber mucho y me explicaron con paciencia cuál me convenía.",
              "Segunda vez que compro aquí. Siempre cumplen con lo que dicen.",
              "El producto bien, solo tuve que esperar un poco porque había cola.",
              "Buena relación precio-calidad. Lo recomiendo a mis amigos del barrio.",
              "Me lo probaron en la tienda antes de llevármelo, eso da confianza.",
              "Precio justo y trato amable. Volveré por más juegos.",
              "Tardaron un poco en responder el WhatsApp, pero luego todo bien.",
              "Excelente estado, se nota que lo revisaron en taller."]
RES_ESTRELLAS = [5, 5, 4, 5, 4, 3, 5, 4, 5, 2, 5, 4]


def condicion_de(p: dict) -> str:
    """Los mandos del prototipo no traen estado: se deduce como lo hace el prototipo (estadoClase)."""
    if p.get("estado"):
        return p["estado"]
    if re.search(r"reacondicion|repotenci|revisad", p.get("desc") or "", re.I):
        return "Reacondicionado en taller"
    return "Nuevo"


def categorias_reparacion(equipo: str, falla: str) -> tuple[str, str]:
    """Mismas reglas del prototipo: tipo de servicio y categoría de la falla."""
    e, f = equipo.lower(), falla.lower()
    tipo = "Mantenimiento de consola"
    if re.search(r"repotenci|ssd|ram\b", f):
        tipo = "Repotenciación de PC"
    elif re.search(r"\bpc\b|placa|laptop", e):
        tipo = "Reparación de PC"
    elif re.search(r"mando|control", e):
        tipo = "Reparación de mandos"
    elif re.search(r"lee discos|lector", f):
        tipo = "Lector de discos"
    elif re.search(r"hdmi|imagen", f):
        tipo = "Puerto HDMI"
    reglas = [(r"drift|stick", "Drift de stick"), (r"sobrecalienta|calienta|se apaga", "Sobrecalentamiento"),
              (r"bater|carga", "Batería"), (r"lee discos|lector", "No lee discos"),
              (r"gatillo|bot[oó]n|\bl2\b|\br2\b", "Gatillos y botones"), (r"no enciende|sin video|no prende", "No enciende"),
              (r"hdmi|imagen", "HDMI dañado"), (r"repotenci|ssd|ram\b|lent", "Mejora de rendimiento"),
              (r"mantenimiento|limpieza", "Limpieza preventiva")]
    return tipo, next((c for r, c in reglas if re.search(r, f)), "Otras fallas")


def cargar(db) -> None:
    hoy = date.today()

    # ── Catálogos fijos ──────────────────────────────────────────────
    generos = {g["k"]: Genero(id=g["k"], nombre=g["l"]) for g in DATOS["generos"]}
    cats = {n: Categoria(nombre=n, es_juego=n.startswith("PS"), orden=i) for i, n in enumerate(CATEGORIAS)}
    conds = {n: Condicion(nombre=n, grupo=g) for n, g in CONDICIONES}
    fallas = {n: CategoriaFalla(nombre=n) for n in FALLAS}
    servicios = {t["nombre"]: TipoServicio(nombre=t["nombre"], detalle=t["detalle"], precio_desde=Decimal(t["desde"]),
                                           tiempo_estimado=t["dias"], icono=t["icono"], activo=t["activo"])
                 for t in DATOS["tipos"]}
    db.add_all([*generos.values(), *cats.values(), *conds.values(), *fallas.values(), *servicios.values()])

    # ── Equipo de la tienda ──────────────────────────────────────────
    pass_equipo = hash_password(settings.seed_password_equipo)
    angel = Empleado(nombre="Ángel Landeo", telefono="915152886", usuario=Usuario(email="angel@playshoptek.pe", rol=Rol.dueno, password_hash=pass_equipo))
    linda = Empleado(nombre="Linda Azumi Quichua Sumari", telefono="999649195", fecha_ingreso=date(2025, 3, 1),
                     usuario=Usuario(email="linda@playshoptek.pe", rol=Rol.trabajadora, password_hash=pass_equipo))
    db.add_all([angel, linda])
    db.flush()
    tecnicos = {"Ángel": angel, "Linda": linda}

    # ── Clientes: uno por persona, sin repetir su nombre en cada venta ──
    pass_cliente = hash_password(settings.seed_password_cliente)
    clientes: dict[str, Cliente] = {}
    telefonos_usados: set[str] = set()

    def telefono_para(nombre: str) -> str:
        n = num_de(nombre) * 97531
        while True:
            tel = "9" + str(10_000_000 + n % 89_999_999)[:8]
            if tel not in telefonos_usados:
                telefonos_usados.add(tel)
                return tel
            n += 7919

    def cliente(nombre: str) -> Cliente:
        if nombre not in clientes:
            if nombre == "Kevin Ticona":  # el único cliente de prueba con cuenta web
                telefonos_usados.add("987112445")
                c = Cliente(nombre=nombre, telefono="987112445", distrito="Villa El Salvador",
                            usuario=Usuario(email="cliente@demo.pe", rol=Rol.cliente, password_hash=pass_cliente))
            else:
                c = Cliente(nombre=nombre, telefono=telefono_para(nombre), distrito="Villa El Salvador")
            db.add(c)
            db.flush()
            clientes[nombre] = c
        return clientes[nombre]

    kevin = cliente("Kevin Ticona")
    pref = PreferenciaCliente(cliente=kevin, consola="PS5", modo_juego=ModoJuego.online)
    pref.generos = [generos["deportes"], generos["accion"]]
    db.add(pref)

    # ── Productos ────────────────────────────────────────────────────
    productos: dict[str, Producto] = {}
    por_nombre: dict[str, Producto] = {}
    for p in DATOS["productos"]:
        inc = p.get("incluye") or {}
        prod = Producto(
            codigo=p["id"], nombre=p["nombre"], categoria=cats[p["categoria"]], subcategoria=p.get("sub"),
            plataforma=p.get("plat"), descripcion=p.get("desc"), precio=Decimal(p["precio"]), stock=p["stock"],
            condicion=conds[condicion_de(p)],
            incluye_caja=inc.get("caja"), incluye_manual=inc.get("manual"), incluye_disco=inc.get("disco"),
            color=p.get("color"), origen=p.get("origen"), trailer_url=p.get("trailer"),
            es_preventa=bool(p.get("preventa")),
            fecha_lanzamiento=fecha(p["lanzamiento"]) if p.get("lanzamiento") else None,
            monto_reserva=Decimal(p["reserva"]) if p.get("reserva") else None,
            stock_lanzamiento=p.get("stockLanz"),
        )
        prod.generos = [generos[g] for g in p.get("generos", []) if g in generos]
        prod.etiquetas = [ProductoEtiqueta(etiqueta=t) for t in dict.fromkeys(p.get("tags", []))]
        prod.modos = [ProductoModo(modo=ModoJuego(m)) for m in p.get("modos", [])]
        if p.get("descPct"):
            prod.ofertas = [Oferta(porcentaje=p["descPct"], dias=p["descDias"], fecha_inicio=fecha(p["descInicio"]))]
        db.add(prod)
        productos[p["id"]] = prod
        por_nombre[p["nombre"]] = prod
    db.flush()
    db.add(Favorito(cliente_id=kevin.id, producto_id=productos["p8"].id))

    # ── Ventas ───────────────────────────────────────────────────────
    for v in DATOS["ventas"]:
        num = int(v["id"].split("-")[1])
        if v.get("items"):
            lineas = [(productos[i["id"]], Decimal(i["precio"]), i["cant"], bool(i.get("preventa"))) for i in v["items"]]
        elif v.get("prodId"):
            lineas = [(productos[v["prodId"]], Decimal(v["total"]), 1, False)]
        else:
            p1 = por_nombre[v["detalle"].replace(" + 1 más", "")]
            lineas = [(p1, p1.precio, 1, False)]
            if v["unidades"] == 2:  # el prototipo agrega items[(i + 4) % 12]
                p2 = por_nombre[ITEMS_VENTA[(1088 - num + 4) % len(ITEMS_VENTA)]]
                lineas.append((p2, p2.precio, 1, False))
        venta = Venta(
            codigo=v["id"], cliente_id=cliente(v["cliente"]).id, canal=Canal(v.get("canal", "web")),
            metodo_pago=MetodoPago(v["metodo"].lower()), estado=ESTADO_VENTA[v["estado"]],
            total=Decimal(v["total"]), fecha=fecha(v["fecha"]),
        )
        venta.items = [VentaItem(producto_id=p.id, nombre_producto=p.nombre, precio_unitario=pr, cantidad=c, es_preventa=pv)
                       for p, pr, c, pv in lineas]
        db.add(venta)

    # ── Reparaciones activas, con su historial de estados ────────────
    reparaciones: dict[str, Reparacion] = {}
    for r in DATOS["reparaciones"]:
        tipo, falla_cat = categorias_reparacion(r["equipo"], r["falla"])
        estado = ESTADO_REP[r["estado"]]
        ingreso = fecha(r["fecha"])
        tecnico = tecnicos[r["tecnica"]]
        rep = Reparacion(
            codigo=r["id"], cliente_id=cliente(r["cliente"]).id, tipo_servicio=servicios[tipo],
            categoria_falla=fallas[falla_cat], equipo=r["equipo"], falla=r["falla"],
            diagnostico=r.get("diagnostico") or None, costo=Decimal(r["costo"]), precio_acordado=r["acordado"],
            estado=estado, pago=PAGO_REP[r["pago"]], duracion_estimada=r["duracion"],
            tecnico_id=tecnico.usuario_id, fecha_ingreso=ingreso,
        )
        base = datetime.combine(ingreso, time(10, 0))
        rep.historial = [ReparacionHistorial(estado=e, cambiado_en=base + timedelta(hours=6 * k), cambiado_por_id=tecnico.usuario_id,
                                             aviso_whatsapp=e == EstadoReparacion.listo_para_recoger)
                         for k, e in enumerate(ORDEN_REP[: ORDEN_REP.index(estado) + 1])]
        db.add(rep)
        reparaciones[r["id"]] = rep

    # ── Historial de 90 días (alimenta el tablero y el mapa de calor) ─
    equipo_tipo = {"Reparación de mandos": "Mando DualShock 4", "Mantenimiento de consola": "PlayStation 4 Slim",
                   "Lector de discos": "PlayStation 4 Slim", "Puerto HDMI": "PlayStation 4 Slim",
                   "Reparación de PC": "PC de escritorio", "Repotenciación de PC": "PC de escritorio"}
    nombres = list(dict.fromkeys(v["cliente"] for v in DATOS["ventas"]))
    for k, h in enumerate(DATOS["repHistorial"], start=1):
        db.add(Reparacion(
            codigo=f"R-{1000 + k}", cliente_id=cliente(nombres[k % len(nombres)]).id,
            tipo_servicio=servicios[h["tipoCat"]], categoria_falla=fallas[h["fallaCat"]],
            equipo=equipo_tipo[h["tipoCat"]], falla=h["fallaCat"], costo=servicios[h["tipoCat"]].precio_desde,
            precio_acordado=True, estado=EstadoReparacion.entregado,
            pago=PagoReparacion.efectivo if k % 3 else PagoReparacion.yape,
            tecnico_id=(angel if k % 2 else linda).usuario_id, fecha_ingreso=fecha(h["fecha"]),
        ))

    # ── Reseñas ──────────────────────────────────────────────────────
    for r in DATOS["resenas"]:  # las 7 reseñas propias del prototipo
        es_prod = r["tipo"] == "producto"
        db.add(Resena(producto_id=por_nombre[r["sobre"]].id if es_prod else None,
                      tipo_servicio_id=None if es_prod else servicios[r["sobre"]].id,
                      nombre_publico=r["cliente"], estrellas=r["estrellas"], texto=r["texto"],
                      origen=OrigenResena.web, fecha=fecha(r["fecha"])))
    for p in productos.values():  # las que el prototipo genera en cada ficha
        k = num_de(p.nombre)
        for i in range(14 + k % 13):
            db.add(Resena(producto_id=p.id, nombre_publico=RES_NOMBRES[(k + i * 5) % len(RES_NOMBRES)],
                          estrellas=RES_ESTRELLAS[(k + i * 7) % len(RES_ESTRELLAS)],
                          texto=RES_TEXTOS[(k + i * 3) % len(RES_TEXTOS)], origen=OrigenResena.web,
                          fecha=hoy - timedelta(days=2 + i * 5 + k % 4)))

    # ── Citas con su chat ────────────────────────────────────────────
    db.flush()
    for c in DATOS["citas"]:
        tipo, _ = categorias_reparacion(c["equipo"], c["falla"])
        f = fecha(c["fecha"])
        hh, mm = map(int, c["hora"].split(":"))
        rep = reparaciones.get(c.get("repId"))
        cita = Cita(cliente_id=cliente(c["cliente"]).id, tipo_servicio_id=servicios[tipo].id, equipo=c["equipo"],
                    falla=c["falla"], fecha=f, hora=time(hh, mm), precio=Decimal(c["precio"]),
                    precio_acordado=c["acordado"], reparacion_id=rep.id if rep else None)
        cita.mensajes = [CitaMensaje(autor=AutorMensaje.cliente if m["de"] == "cliente" else AutorMensaje.tienda, texto=m["txt"],
                                     enviado_en=datetime.combine(f - timedelta(days=1), time(*map(int, m["hora"].split(":")))),
                                     leido=k < len(c["mensajes"]) - c["noLeidos"])
                         for k, m in enumerate(c["mensajes"])]
        db.add(cita)

    # ── Grupos de interés, búsquedas y avisos de llegada ─────────────
    C = ["Kevin Ticona", "Rosa Huamán", "Jhon Ramírez", "Milagros Ccahuana", "Yesenia Palomino", "Brayan Chumpitaz",
         "Fiorella Mendoza", "Cristhian Caruajulca", "Elmer Vilca", "Katherine Ñahui", "Jordan Zapata", "Sheyla Quiroz",
         "Alexander Mamani", "Luis Quispe", "Carla Sifuentes"]
    grupos = [  # textos, clave, nombre, producto, días de búsqueda, orígenes, días de "Avísame", desplazamiento
        (["gta 6", "gta vi", "grand theft auto 6", "gta6 ps5"], "gta6", "GTA VI", None,
         [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 21, 25, 29, 33, 38, 44, 50, 57, 64, 71, 79, 87], ["busqueda", "busqueda", "chatbot"], [1, 3, 5, 9, 14, 20, 31, 45, 60], 0),
        (["black ops 7", "cod bo7", "call of duty 2025", "black ops 7 ps5"], "p:p12", "Call of Duty: Black Ops 7", "p12",
         [2, 4, 7, 9, 13, 17, 22, 28, 35, 42, 50, 61, 70, 84], ["busqueda", "chatbot", "busqueda"], [6, 24], 3),
        (["gran turismo 7", "gt7", "gran turismo ps5"], "p:p9", "Gran Turismo 7", "p9",
         [1, 6, 11, 16, 23, 30, 41, 55], ["busqueda", "busqueda", "chatbot"], [2, 12, 26], 5),
        (["silent hill 2 remake", "silent hill 2"], "silenthill2", "Silent Hill 2 Remake", None, [5, 19, 40, 66], ["busqueda", "chatbot"], [19], 7),
        (["volante ps5", "volante para ps5"], "volante", "Volante para PS5", None, [8, 27, 58], ["busqueda"], [], 9),
        (["mando xbox", "control xbox"], "xbox", "Mando de Xbox", None, [3, 33, 73], ["busqueda", "chatbot"], [], 11),
        (["nintendo switch", "switch 2"], "switch", "Nintendo Switch", None, [15, 48], ["busqueda"], [], 13),
    ]
    for textos, clave, nombre, cod, dias, origenes, avisos, off in grupos:
        prod = productos.get(cod) if cod else None
        db.add(GrupoInteres(clave=clave, nombre=nombre, producto_id=prod.id if prod else None))
        db.flush()  # el grupo debe existir antes que sus búsquedas
        hay = bool(prod and (prod.stock > 0 or prod.es_preventa))
        for i, d in enumerate(dias):
            quien = None if (i + off) % 4 == 3 else cliente(C[(i * 7 + off) % len(C)])
            db.add(Interes(texto=textos[i % len(textos)], origen=OrigenInteres(origenes[i % len(origenes)]),
                           cliente_id=quien.id if quien else None, tuvo_resultados=hay, grupo_clave=clave,
                           fecha=hoy - timedelta(days=d)))
        for i, d in enumerate(avisos):
            db.add(AvisoLlegada(cliente_id=cliente(C[(i * 4 + off + 1) % len(C)]).id, grupo_clave=clave,
                                creado_en=datetime.combine(hoy - timedelta(days=d), time(12))))
        db.flush()

    # ── Banners y notificaciones ─────────────────────────────────────
    db.add_all([
        Banner(titulo="Ofertas de la semana", subtitulo="Mandos, juegos y consolas con precio rebajado por pocos días.",
               destino="ofertas", texto_alternativo="Mandos y juegos en oferta sobre el mostrador", orden=1),
        Banner(titulo="Nuestra tienda", texto_alternativo="Fachada de Play Shop Tek en Villa El Salvador", orden=2),
        Banner(titulo="Tu mando reparado en 30 minutos", subtitulo="Drift, gatillos y batería. El diagnóstico en tienda es gratis.",
               destino="reparaciones", texto_alternativo="Técnico reparando un mando en el taller", orden=3),
        Banner(titulo="Consolas en mostrador", destino="Máquinas", texto_alternativo="Mostrador con consolas PS5, PS4 y PS3", orden=4),
        Banner(titulo="PS3 y PS4 repotenciadas en taller", subtitulo="Limpieza interna, pasta térmica nueva y 48 horas de prueba antes de venderlas.",
               destino="Máquinas", texto_alternativo="Consolas PS3 y PS4 repotenciadas", activo=False, orden=5),
        Notificacion(cliente_id=kevin.id, titulo="¡Tu PC de escritorio está lista para recoger!",
                     detalle="Pasa por Av. Revolución 1420, VES", destino="reparaciones"),
        Notificacion(cliente_id=kevin.id, titulo="Bajó de precio God of War Ragnarök",
                     detalle="Está en tu lista de deseados", destino="deseados"),
    ])
    db.commit()


def main() -> None:
    with SessionLocal() as db:
        if "--reiniciar" in sys.argv:
            tablas = ", ".join(t.name for t in Base.metadata.sorted_tables)
            db.execute(text(f"TRUNCATE {tablas} RESTART IDENTITY CASCADE"))
            db.commit()
        elif db.scalar(select(Usuario.id).limit(1)):
            print("La base ya tiene datos; no se cargó nada. Usa --reiniciar para volver a empezar.")
            return
        cargar(db)
        print("Datos de ejemplo cargados.")


if __name__ == "__main__":
    main()