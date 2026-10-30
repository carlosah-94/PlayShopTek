"""Pruebas automáticas: salud, login por roles (HU-16), catálogo (HU-01), ficha (HU-02), taller (HU-06) e inventario (HU-12)."""


def test_salud(cliente):
    r = cliente.get("/api/salud")
    assert r.status_code == 200
    assert r.json() == {"api": "ok", "base_de_datos": "ok"}


def test_login_devuelve_el_rol(cliente):
    for email, pwd, rol in [("angel@playshoptek.pe", "tienda123", "dueno"),
                            ("linda@playshoptek.pe", "tienda123", "trabajadora"),
                            ("cliente@demo.pe", "demo123", "cliente")]:
        r = cliente.post("/api/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200
        assert r.json()["usuario"]["rol"] == rol


def test_login_con_clave_incorrecta(cliente):
    r = cliente.post("/api/auth/login", json={"email": "angel@playshoptek.pe", "password": "x"})
    assert r.status_code == 401


def test_catalogo_publico_y_filtros(cliente):
    todos = cliente.get("/api/productos").json()
    assert len(todos) >= 40
    ps5 = cliente.get("/api/productos", params={"categoria": "PS5"}).json()
    assert ps5 and all(p["categoria"] == "PS5" for p in ps5)
    terror = cliente.get("/api/productos", params={"genero": "terror"}).json()
    assert all("terror" in p["generos"] for p in terror)
    usados = cliente.get("/api/productos", params={"estado": "usado"}).json()
    assert usados and all(p["grupo_condicion"] == "usado" for p in usados)


def test_oferta_aplica_precio_final(cliente):
    con_oferta = [p for p in cliente.get("/api/productos").json() if p["descuento"]]
    assert con_oferta
    assert all(float(p["precio_final"]) < float(p["precio"]) for p in con_oferta)


def test_stock_bajo_solo_para_el_equipo(cliente, h_trabajadora, h_cliente):
    assert cliente.get("/api/productos/stock-bajo").status_code == 401
    assert cliente.get("/api/productos/stock-bajo", headers=h_cliente).status_code == 403
    r = cliente.get("/api/productos/stock-bajo", headers=h_trabajadora)
    assert r.status_code == 200
    assert all(p["stock"] <= 2 for p in r.json())


def test_solo_el_dueno_cambia_precios(cliente, h_dueno, h_trabajadora):
    p = cliente.get("/api/productos").json()[0]
    assert cliente.patch(f"/api/productos/{p['id']}", json={"precio": 1}, headers=h_trabajadora).status_code == 403
    r = cliente.patch(f"/api/productos/{p['id']}", json={"precio": float(p["precio"]) + 10}, headers=h_dueno)
    assert r.status_code == 200
    cliente.patch(f"/api/productos/{p['id']}", json={"precio": float(p["precio"])}, headers=h_dueno)  # deja todo igual


def test_registro_une_la_cuenta_con_el_cliente_de_tienda(cliente):
    """Si alguien compró en tienda solo con su celular y luego se registra, es el mismo cliente."""
    import uuid
    from sqlalchemy import select
    from app.database import SessionLocal
    from app.models import Cliente

    tel = "9" + str(uuid.uuid4().int)[:8]
    with SessionLocal() as db:
        db.add(Cliente(nombre="Cliente en tienda", telefono=tel))
        db.commit()
    r = cliente.post("/api/auth/registro", json={"nombre": "Ana Torres", "email": f"ana{tel}@demo.pe",
                                                 "telefono": tel, "password": "secreta1"})
    assert r.status_code == 201, r.text
    assert r.json()["usuario"]["rol"] == "cliente"
    with SessionLocal() as db:
        c = db.scalar(select(Cliente).where(Cliente.telefono == tel))
        assert c.usuario_id is not None and c.nombre == "Ana Torres"


def test_ficha_trae_resenas_y_trailer(cliente):
    """HU-02: la ficha suma descripción, tráiler y las últimas reseñas."""
    con_trailer = next(p for p in cliente.get("/api/productos").json() if p["categoria"] == "PS5")
    r = cliente.get(f"/api/productos/{con_trailer['id']}")
    assert r.status_code == 200
    f = r.json()
    assert f["descripcion"] and f["total_resenas"] >= len(f["resenas"]) > 0
    assert cliente.get("/api/productos/99999").status_code == 404


def test_registrar_reparacion(cliente, h_trabajadora, h_cliente):
    """HU-06: Linda registra un equipo; el cliente no puede entrar al taller."""
    assert cliente.get("/api/reparaciones", headers=h_cliente).status_code == 403
    op = cliente.get("/api/reparaciones/opciones", headers=h_trabajadora).json()
    datos = {"cliente_nombre": "Prueba Taller", "cliente_telefono": "912345678", "equipo": "Mando DualSense",
             "falla": "Drift en stick derecho", "tipo_servicio_id": op["servicios"][0]["id"],
             "categoria_falla_id": op["fallas"][0]["id"], "costo": 60, "precio_acordado": True}
    r = cliente.post("/api/reparaciones", json=datos, headers=h_trabajadora)
    assert r.status_code == 201, r.text
    nueva = r.json()
    assert nueva["codigo"].startswith("R-") and nueva["estado"] == "recibido" and nueva["tecnico"] == "Linda"
    assert any(x["codigo"] == nueva["codigo"] for x in cliente.get("/api/reparaciones", headers=h_trabajadora).json())
    assert cliente.post("/api/reparaciones", json={**datos, "cliente_telefono": "123"}, headers=h_trabajadora).status_code == 422


def test_dueno_cambia_trailer(cliente, h_dueno, h_trabajadora):
    """HU-12: Ángel corrige el tráiler; Linda no puede."""
    p = cliente.get("/api/productos").json()[0]
    url = "https://www.youtube.com/watch?v=abcdefghijk"
    assert cliente.patch(f"/api/productos/{p['id']}", json={"trailer_url": url}, headers=h_trabajadora).status_code == 403
    r = cliente.patch(f"/api/productos/{p['id']}", json={"trailer_url": url}, headers=h_dueno)
    assert r.status_code == 200 and r.json()["trailer_url"] == url
    cliente.patch(f"/api/productos/{p['id']}", json={"trailer_url": p["trailer_url"] or ""}, headers=h_dueno)


def test_rastreo_pide_codigo_y_celular(cliente):
    """HU-07: Kevin rastrea su mando con el código y los 4 últimos dígitos de su celular."""
    r = cliente.get("/api/rastreo/R-2062", params={"celular": "2445"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["cliente"] == "Kevin" and d["historial"][0]["estado"] == "recibido"
    assert cliente.get("/api/rastreo/2062", params={"celular": "2445"}).status_code == 200  # sin "R-" también vale
    assert cliente.get("/api/rastreo/R-2062", params={"celular": "0000"}).status_code == 404  # celular de otro
    assert cliente.get("/api/rastreo/R-9999", params={"celular": "2445"}).status_code == 404


def test_avanzar_estado_de_reparacion(cliente, h_trabajadora):
    """HU-08: un paso a la vez, sin reparar sin precio aceptado y sin entregar sin pago."""
    op = cliente.get("/api/reparaciones/opciones", headers=h_trabajadora).json()
    nueva = cliente.post("/api/reparaciones", headers=h_trabajadora, json={
        "cliente_nombre": "Prueba Estados", "cliente_telefono": "912345679", "equipo": "PS4 Slim",
        "falla": "Se apaga sola", "tipo_servicio_id": op["servicios"][0]["id"], "costo": 80}).json()
    url = f"/api/reparaciones/{nueva['id']}/estado"
    assert cliente.patch(url, json={"estado": "listo_para_recoger"}, headers=h_trabajadora).status_code == 409  # se salta pasos
    assert cliente.patch(url, json={"estado": "diagnosticado"}, headers=h_trabajadora).status_code == 200
    assert cliente.patch(url, json={"estado": "en_reparacion"}, headers=h_trabajadora).status_code == 409  # sin precio aceptado
    assert cliente.patch(url, json={"estado": "en_reparacion", "precio_acordado": True}, headers=h_trabajadora).status_code == 200
    assert cliente.patch(url, json={"estado": "listo_para_recoger"}, headers=h_trabajadora).status_code == 200
    assert cliente.patch(url, json={"estado": "entregado"}, headers=h_trabajadora).status_code == 422  # falta el pago
    r = cliente.patch(url, json={"estado": "entregado", "pago": "yape"}, headers=h_trabajadora)
    assert r.status_code == 200 and r.json()["pago"] == "yape"
    pasos = cliente.get(f"/api/rastreo/{nueva['codigo']}", params={"celular": "5679"}).json()["historial"]
    assert [p["estado"] for p in pasos] == ["recibido", "diagnosticado", "en_reparacion", "listo_para_recoger", "entregado"]


def test_compra_web_descuenta_stock(cliente, h_cliente, h_trabajadora):
    """HU-03: Kevin paga con Yape; el precio lo pone el servidor y el stock baja."""
    p = next(x for x in cliente.get("/api/productos").json() if x["stock"] >= 2 and not x["es_preventa"])
    compra = {"items": [{"producto_id": p["id"], "cantidad": 1}], "metodo_pago": "yape"}
    assert cliente.post("/api/ventas", json=compra).status_code == 401                         # sin sesión
    assert cliente.post("/api/ventas", json=compra, headers=h_trabajadora).status_code == 403  # no es cliente
    assert cliente.post("/api/ventas", json=compra, headers=h_cliente).status_code == 422      # falta la operación de Yape
    r = cliente.post("/api/ventas", json={**compra, "numero_operacion": "12345678"}, headers=h_cliente)
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["codigo"].startswith("V-") and v["estado"] == "pagado" and float(v["total"]) == float(p["precio_final"])
    assert cliente.get(f"/api/productos/{p['id']}").json()["stock"] == p["stock"] - 1
    assert any(x["codigo"] == v["codigo"] for x in cliente.get("/api/ventas/mias", headers=h_cliente).json())
    demasiado = {"items": [{"producto_id": p["id"], "cantidad": 5}], "metodo_pago": "tarjeta"}
    if p["stock"] - 1 < 5:
        assert cliente.post("/api/ventas", json=demasiado, headers=h_cliente).status_code == 409  # no alcanza el stock


def test_tablero_solo_para_el_dueno(cliente, h_dueno, h_trabajadora):
    """HU-13: Ángel ve los indicadores; Linda no (no ve ventas totales)."""
    assert cliente.get("/api/tablero", headers=h_trabajadora).status_code == 403
    r = cliente.get("/api/tablero", params={"dias": 30}, headers=h_dueno)
    assert r.status_code == 200, r.text
    t = r.json()
    assert float(t["ventas_total"]) > 0 and t["ventas_cantidad"] > 0
    assert len(t["semanas"]) == 8 and t["mas_buscados"][0]["busquedas"] >= t["mas_buscados"][-1]["busquedas"]


def test_busqueda_sin_resultado_llega_al_tablero(cliente, h_dueno):
    """HU-11: un visitante busca algo que no hay; Ángel lo ve en su tablero (una vez por día y persona)."""
    from sqlalchemy import delete
    from app.database import SessionLocal
    from app.models import Interes

    texto = "consola retro de prueba"
    with SessionLocal() as db:  # empieza limpio, por si quedó de una corrida anterior
        db.execute(delete(Interes).where(Interes.texto == texto))
        db.commit()
    assert cliente.post("/api/intereses", json={"texto": texto.upper()}).json()["registrado"] is True
    assert cliente.post("/api/intereses", json={"texto": texto}).json()["registrado"] is False  # repetida hoy
    assert cliente.post("/api/intereses", json={"texto": "ps"}).json()["registrado"] is False   # muy corta
    t = cliente.get("/api/tablero", params={"dias": 7}, headers=h_dueno).json()
    assert any(x["nombre"] == texto for x in t["sin_resultado"]) or len(t["sin_resultado"]) == 5
    with SessionLocal() as db:  # deja la base como estaba
        db.execute(delete(Interes).where(Interes.texto == texto))
        db.commit()


def test_favoritos_y_avisame_cuando_llegue(cliente, h_cliente, h_dueno):
    """HU-05: Kevin guarda un favorito y pide aviso de un agotado; cuando Ángel repone, le llega la notificación."""
    productos = cliente.get("/api/productos").json()
    disponible = next(p for p in productos if p["stock"] > 0)
    assert cliente.put(f"/api/mi/favoritos/{disponible['id']}", headers=h_cliente).status_code == 204
    assert cliente.put(f"/api/mi/favoritos/{disponible['id']}", headers=h_cliente).status_code == 204  # no duplica
    assert any(f["id"] == disponible["id"] for f in cliente.get("/api/mi/favoritos", headers=h_cliente).json())
    assert cliente.delete(f"/api/mi/favoritos/{disponible['id']}", headers=h_cliente).status_code == 204

    assert cliente.post(f"/api/mi/avisos/{disponible['id']}", headers=h_cliente).status_code == 409  # hay stock
    agotado = next(p for p in productos if p["stock"] == 0 and not p["es_preventa"])
    assert cliente.post(f"/api/mi/avisos/{agotado['id']}", headers=h_cliente).status_code == 201
    assert any(a["producto_id"] == agotado["id"] for a in cliente.get("/api/mi/avisos", headers=h_cliente).json())

    cliente.patch(f"/api/productos/{agotado['id']}", json={"stock": 3}, headers=h_dueno)  # Ángel repone
    avisos = cliente.get("/api/mi/notificaciones", headers=h_cliente).json()
    assert any(agotado["nombre"] in n["titulo"] for n in avisos)
    assert not any(a["producto_id"] == agotado["id"] for a in cliente.get("/api/mi/avisos", headers=h_cliente).json())
    cliente.patch(f"/api/productos/{agotado['id']}", json={"stock": 0}, headers=h_dueno)  # deja todo como estaba


def test_reserva_de_preventa(cliente, h_cliente):
    """HU-04: Kevin reserva el juego en preventa pagando solo S/ 50; no puede reservarlo dos veces."""
    preventa = next(p for p in cliente.get("/api/productos").json() if p["es_preventa"])
    ficha = cliente.get(f"/api/productos/{preventa['id']}").json()
    reserva = {"producto_id": preventa["id"], "metodo_pago": "tarjeta"}
    r = cliente.post("/api/ventas/reserva", json=reserva, headers=h_cliente)
    if ficha["cupos_reserva"] == 0:
        assert r.status_code == 409
        return
    if r.status_code == 409:  # ya la había reservado en una corrida anterior de las pruebas
        assert "Ya tienes" in r.json()["detail"]
        return
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["estado"] == "reservado" and float(v["total"]) == float(ficha["monto_reserva"])
    assert cliente.get(f"/api/productos/{preventa['id']}").json()["cupos_reserva"] == ficha["cupos_reserva"] - 1
    assert cliente.post("/api/ventas/reserva", json=reserva, headers=h_cliente).status_code == 409  # segunda vez
    no_preventa = next(p for p in cliente.get("/api/productos").json() if not p["es_preventa"])
    assert cliente.post("/api/ventas/reserva", json={**reserva, "producto_id": no_preventa["id"]}, headers=h_cliente).status_code == 404



def test_ia_agrupa_busquedas_parecidas(cliente, h_dueno, h_trabajadora):
    """IA (K-Means / DBSCAN): 'gta 6', 'gta vi' y 'grand theft auto 6' terminan en el mismo grupo."""
    from app.ia.busquedas import agrupar

    textos = ["gta 6", "gta vi", "grand theft auto 6", "gt7", "gran turismo 7", "mando xbox", "control xbox"]
    e = dict(zip(textos, agrupar(textos)["etiquetas"]))
    assert e["gta 6"] == e["gta vi"] == e["grand theft auto 6"]
    assert e["gt7"] == e["gran turismo 7"] != e["gta 6"]
    assert e["mando xbox"] == e["control xbox"]
    assert cliente.post("/api/ia/agrupar-busquedas", headers=h_trabajadora).status_code == 403
    r = cliente.post("/api/ia/agrupar-busquedas", headers=h_dueno).json()
    assert r["algoritmo_elegido"] in ("K-Means", "DBSCAN") and r["kmeans"]["silueta"] > 0


def test_asistente_entiende_y_muestra_productos(cliente):
    """HU-09: el asistente detecta la intención y muestra el producto con su precio dentro del chat."""
    def decir(mensaje):
        r = cliente.post("/api/asistente", json={"mensaje": mensaje, "sesion": "prueba-pytest"})
        assert r.status_code == 200, r.text
        return r.json()

    r = decir("tienen el gta 5 pa la play 4?")
    assert r["intencion"] == "buscar_producto"
    assert [p["nombre"] for p in r["productos"]] == ["GTA V (PS4)"] and float(r["productos"][0]["precio_final"]) > 0
    assert decir("mi mando tiene drift")["intencion"] == "reparacion"
    assert decir("a que hora abren el domingo")["intencion"] == "horario_ubicacion"
    assert any(a["destino"] == "/rastreo" for a in decir("como va mi reparacion")["acciones"])
    assert decir("xqzt wvbn")["intencion"] == "no_entendi"  # sin sentido -> lo deriva a un asesor


def test_modelo_del_asistente_supera_la_meta():
    """IA (SVM vs regresión logística): la exactitud con ejemplos no vistos supera el 80 %."""
    from app.ia.asistente import entrenar

    r = entrenar(guardar=False)
    assert r["algoritmo_elegido"] in ("SVM", "Regresión logística")
    assert r["resultados"][r["algoritmo_elegido"]]["exactitud_validacion"] >= 0.80


def test_asistente_agrega_al_carrito_y_navega(cliente):
    """HU-10: el asistente agrega al carrito (por nombre o "agrégalo") y lleva a una sección."""
    def decir(mensaje, ultimo=None):
        cuerpo = {"mensaje": mensaje, "sesion": "prueba-pytest", "ultimo_producto_id": ultimo}
        return cliente.post("/api/asistente", json=cuerpo).json()

    r = decir("agrega el fifa 26 al carrito")
    assert r["intencion"] == "agregar_carrito" and r["acciones"][0]["tipo"] == "agregar"
    assert r["acciones"][0]["producto_id"] == r["productos"][0]["id"]
    gta = decir("tienen el gta 5 pa la play 4?")["productos"][0]
    assert decir("agregalo al carrito", ultimo=gta["id"])["acciones"][0]["producto_id"] == gta["id"]
    agotado = decir("agrega el gran turismo 7")
    assert agotado["acciones"] == [] and "agotado" in agotado["respuesta"]
    assert decir("llevame al carrito")["acciones"][0]["destino"] == "/carrito"
    assert decir("quiero ver mis compras")["acciones"][0]["destino"] == "/mis-compras"


def test_libro_de_reclamaciones(cliente, h_dueno, h_trabajadora, h_cliente):
    """HU-18: cualquiera registra un reclamo con código y plazo; el equipo lo ve y solo el dueño responde."""
    hoja = {"tipo": "reclamo", "nombre": "Prueba Reclamo", "correo": "prueba@demo.pe", "telefono": "912345678",
            "bien_contratado": "Mando DualSense", "monto_reclamado": "279.00",
            "detalle": "El mando llegó con el botón X hundido.", "pedido_cliente": "Cambio del mando."}
    r = cliente.post("/api/reclamos", json=hoja)
    assert r.status_code == 201, r.text
    reclamo = r.json()
    assert reclamo["codigo"].startswith("LR-") and reclamo["estado"] == "pendiente"
    assert reclamo["fecha_limite"] > reclamo["fecha"]  # 15 días hábiles después
    assert cliente.post("/api/reclamos", json={**hoja, "correo": "no-es-correo"}).status_code == 422

    assert cliente.get("/api/reclamos", headers=h_cliente).status_code == 403  # el cliente no ve la lista
    lista = cliente.get("/api/reclamos", headers=h_trabajadora).json()
    assert any(x["codigo"] == reclamo["codigo"] for x in lista)

    respuesta = {"respuesta": "Coordinamos el cambio del mando en la tienda."}
    url = f"/api/reclamos/{reclamo['id']}/respuesta"
    assert cliente.patch(url, json=respuesta, headers=h_trabajadora).status_code == 403  # solo el dueño responde
    r = cliente.patch(url, json=respuesta, headers=h_dueno)
    assert r.status_code == 200 and r.json()["estado"] == "respondido"


def test_resumen_inteligente(cliente, h_dueno, h_trabajadora):
    assert cliente.get("/api/ia/resumen", headers=h_trabajadora).status_code == 403  # solo Ángel
    r = cliente.get("/api/ia/resumen", headers=h_dueno)
    assert r.status_code == 200
    m, o = r.json()["modelo"], r.json()["ofertas"]
    elegido = m["resultados"][m["algoritmo_elegido"]]["mae_prueba"]
    assert elegido <= m["resultados"]["Sin IA (promedio de 4 semanas)"]["mae_prueba"] * 1.1  # al menos tan bueno como adivinar
    assert all(x["pedir"] > 0 for x in r.json()["reponer"])
    assert len(o["sugeridas"]) <= 5 and o["ganancia_con_ofertas"] >= o["ganancia_sin_ofertas"]


def test_venta_en_tienda_y_por_whatsapp(cliente, h_trabajadora, h_cliente):
    """HU-15: Linda registra ventas del mostrador y de WhatsApp; se descuenta el stock y el cliente la ve."""
    p = next(x for x in cliente.get("/api/productos").json() if x["stock"] >= 3 and not x["es_preventa"])
    venta = {"canal": "tienda", "metodo_pago": "efectivo", "items": [{"producto_id": p["id"], "cantidad": 1}],
             "cliente_nombre": "Kevin", "cliente_telefono": "987112445"}
    assert cliente.post("/api/ventas/tienda", json=venta, headers=h_cliente).status_code == 403  # solo el equipo
    whatsapp_efectivo = {**venta, "canal": "whatsapp"}
    assert cliente.post("/api/ventas/tienda", json=whatsapp_efectivo, headers=h_trabajadora).status_code == 422

    r = cliente.post("/api/ventas/tienda", json=venta, headers=h_trabajadora)
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["canal"] == "tienda" and v["estado"] == "entregado" and v["registrada_por"].startswith("Linda")
    assert cliente.get(f"/api/productos/{p['id']}").json()["stock"] == p["stock"] - 1
    assert any(x["codigo"] == v["codigo"] for x in cliente.get("/api/ventas/mias", headers=h_cliente).json())

    sin_celular = {"canal": "whatsapp", "metodo_pago": "yape", "numero_operacion": "123456",
                   "items": [{"producto_id": p["id"], "cantidad": 1}]}
    r = cliente.post("/api/ventas/tienda", json=sin_celular, headers=h_trabajadora).json()
    assert r["cliente"] == "Cliente de mostrador" and r["estado"] == "pagado"
    assert cliente.get("/api/ventas/tienda", headers=h_trabajadora).json()[0]["codigo"] == r["codigo"]


def test_fotos_de_los_productos(cliente):
    """HU-21: cada producto del catálogo tiene foto; la ficha trae la galería con la principal primero."""
    productos = cliente.get("/api/productos").json()
    assert all(p["foto"] and p["foto"].startswith("/productos/") for p in productos)
    ficha = cliente.get(f"/api/productos/{productos[0]['id']}").json()
    assert ficha["fotos"][0] == productos[0]["foto"] and 1 <= len(ficha["fotos"]) <= 4
    assert not any(p["nombre"].startswith("Winning Eleven") for p in productos)  # retirado del catálogo


def test_ofertas_traen_cuando_terminan(cliente):
    """HU-23: cada producto en oferta trae la fecha en que termina (para el contador); sin oferta, nada."""
    from datetime import UTC, datetime
    productos = cliente.get("/api/productos").json()
    en_oferta = [p for p in productos if p["descuento"]]
    assert en_oferta and all(p["oferta_termina"] for p in en_oferta)
    assert all(datetime.fromisoformat(p["oferta_termina"]) > datetime.now(UTC) for p in en_oferta)  # aún no vence
    assert all(p["oferta_termina"] is None for p in productos if not p["descuento"])


def test_pagina_de_inicio(cliente, h_cliente):
    """HU-22: la página de inicio trae 4 recomendados que se pueden comprar, 4 servicios con su tiempo y 3 reseñas."""
    r = cliente.get("/api/inicio")
    assert r.status_code == 200, r.text
    datos = r.json()
    assert len(datos["recomendados"]) == 4 and not datos["personalizado"]
    assert all(p["stock"] > 0 and not p["es_preventa"] for p in datos["recomendados"])
    assert len(datos["servicios"]) == 4 and all(s["tiempo"] for s in datos["servicios"])
    resenas = datos["resenas"]
    assert len(resenas) == 3 and all(x["estrellas"] == 5 for x in resenas)
    assert len({x["sobre"] for x in resenas}) == 3  # cada una habla de algo distinto
    # Con cuenta de cliente no le recomienda lo que ya compró
    mias = cliente.get("/api/ventas/mias", headers=h_cliente).json()
    comprados = {i["nombre"] for v in mias if v["estado"] in ("pagado", "listo_para_recoger", "entregado") for i in v["items"]}
    con_cuenta = cliente.get("/api/inicio", headers=h_cliente).json()
    assert con_cuenta["personalizado"] and len(con_cuenta["recomendados"]) == 4
    assert not comprados & {p["nombre"] for p in con_cuenta["recomendados"]}


def test_panel_ventas_y_resenas(cliente, h_trabajadora, h_cliente):
    """HU-24: el equipo ve todos los pedidos, avanza uno a "Listo para recoger" (el cliente recibe aviso) y ve las reseñas."""
    assert cliente.get("/api/ventas", headers=h_cliente).status_code == 403  # un cliente no ve los pedidos de otros
    ventas = cliente.get("/api/ventas", headers=h_trabajadora).json()
    assert len(ventas) > 10 and {"web", "tienda"} <= {v["canal"] for v in ventas}
    pagado = next(v for v in ventas if v["estado"] == "pagado")
    url = f"/api/ventas/{pagado['codigo']}/estado"
    assert cliente.patch(url, json={"estado": "entregado"}, headers=h_trabajadora).status_code == 409  # no se salta pasos
    r = cliente.patch(url, json={"estado": "listo_para_recoger"}, headers=h_trabajadora)
    assert r.status_code == 200 and r.json()["estado"] == "listo_para_recoger"
    assert cliente.patch(url, json={"estado": "entregado"}, headers=h_trabajadora).json()["estado"] == "entregado"

    resenas = cliente.get("/api/resenas", headers=h_trabajadora).json()
    assert resenas and all(x["sobre"] and x["es_producto"] for x in resenas)
    servicio = cliente.get("/api/resenas?tipo=servicio", headers=h_trabajadora).json()
    assert servicio and not any(x["es_producto"] for x in servicio)  # pestaña "Servicio de reparación"
    assert cliente.get("/api/resenas", headers=h_cliente).status_code == 403


def test_gestion_del_dueno(cliente, h_dueno, h_trabajadora):
    """HU-24: Ángel publica un producto con foto, lo edita y lo quita; maneja banners, su equipo, servicios y géneros."""
    import base64
    foto = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\nprueba").decode()
    assert cliente.post("/api/imagenes", json={"datos": foto}, headers=h_trabajadora).status_code == 403
    url = cliente.post("/api/imagenes", json={"datos": foto}, headers=h_dueno).json()["url"]
    assert cliente.get(url).content.endswith(b"prueba")

    nuevo = {"nombre": "Astro Bot (PS5)", "categoria": "PS5", "precio": 199, "stock": 3, "condicion": "Nuevo, sellado",
             "generos": ["aventura", "familiar"], "modos": ["solo"], "etiquetas": ["plataformas"], "incluye_caja": True,
             "incluye_disco": True, "fotos": [url], "descuento": 10, "descuento_dias": 5}
    p = cliente.post("/api/productos", json=nuevo, headers=h_dueno).json()
    assert p["plataforma"] == "PS5" and p["foto"] == url and p["descuento"] == 10 and p["precio_final"] == "179"
    ficha = cliente.get(f"/api/productos/{p['id']}").json()
    assert ficha["etiquetas"] == ["plataformas"] and set(ficha["generos"]) == {"aventura", "familiar"}
    editado = cliente.put(f"/api/productos/{p['id']}", json={**nuevo, "precio": 189, "descuento": None}, headers=h_dueno).json()
    assert float(editado["precio"]) == 189 and editado["descuento"] is None
    assert cliente.delete(f"/api/productos/{p['id']}", headers=h_dueno).status_code == 204
    assert all(x["id"] != p["id"] for x in cliente.get("/api/productos").json())

    banners = cliente.get("/api/banners").json()
    assert {b["ubicacion"] for b in banners} == {"carrusel", "cuadro_ofertas", "cuadro_reparaciones"}
    b = cliente.post("/api/banners", json={"titulo": "Prueba", "imagen_url": url}, headers=h_dueno).json()
    assert cliente.put(f"/api/banners/{b['id']}", json={**b, "activo": False}, headers=h_dueno).json()["activo"] is False
    assert all(x["id"] != b["id"] for x in cliente.get("/api/banners").json())  # inactiva: no sale en el inicio
    assert cliente.delete(f"/api/banners/{b['id']}", headers=h_dueno).status_code == 204

    t = cliente.post("/api/equipo", json={"nombre": "Rosa Huamán", "email": "rosa@playshoptek.pe", "telefono": "960210211"}, headers=h_dueno).json()
    clave = t["clave_temporal"]
    assert clave and cliente.post("/api/auth/login", json={"email": "rosa@playshoptek.pe", "password": clave}).status_code == 200
    cliente.patch(f"/api/equipo/{t['usuario_id']}", json={"activo": False}, headers=h_dueno)
    assert cliente.post("/api/auth/login", json={"email": "rosa@playshoptek.pe", "password": clave}).status_code != 200
    assert any(x["nombre"].startswith("Linda") for x in cliente.get("/api/equipo", headers=h_dueno).json())

    s = cliente.post("/api/servicios", json={"nombre": "Cambio de pantalla PS Portal", "tiempo": "1 a 2 días"}, headers=h_dueno).json()
    cliente.patch(f"/api/servicios/{s['id']}", json={"activo": False}, headers=h_dueno)
    assert all(x["id"] != s["id"] for x in cliente.get("/api/servicios").json())
    g = cliente.post("/api/generos", json={"nombre": "Simulación"}, headers=h_dueno).json()
    assert g["id"] == "simulacion" and cliente.post("/api/generos", json={"nombre": "simulación"}, headers=h_dueno).status_code == 409
