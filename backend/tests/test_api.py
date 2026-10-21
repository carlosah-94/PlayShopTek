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