"""HU-17: reseñas verificadas (solo opina quien compró)."""


def test_resena_solo_si_compraste(cliente, h_cliente, h_trabajadora):
    productos = [p for p in cliente.get("/api/productos").json() if p["stock"] >= 1 and not p["es_preventa"]]
    # Un producto del que Kevin todavía no opinó (las pruebas pueden correr varias veces sobre la misma base)
    p = next(x for x in productos
             if cliente.get(f"/api/productos/{x['id']}/puedo-opinar", headers=h_cliente).json()["motivo"] != "ya_opinaste")
    resena = {"estrellas": 5, "texto": "Llegó en perfecto estado y funciona muy bien."}

    preventa = next(x for x in cliente.get("/api/productos").json() if x["es_preventa"])
    assert cliente.post(f"/api/productos/{preventa['id']}/resenas", json=resena, headers=h_cliente).status_code == 403
    assert cliente.post(f"/api/productos/{p['id']}/resenas", json=resena, headers=h_trabajadora).status_code == 403

    compra = {"items": [{"producto_id": p["id"], "cantidad": 1}], "metodo_pago": "yape", "numero_operacion": "12345678"}
    assert cliente.post("/api/ventas", json=compra, headers=h_cliente).status_code == 201
    assert cliente.get(f"/api/productos/{p['id']}/puedo-opinar", headers=h_cliente).json() == {"puede": True, "motivo": None}

    r = cliente.post(f"/api/productos/{p['id']}/resenas", json=resena, headers=h_cliente)
    assert r.status_code == 201, r.text
    nueva = r.json()
    assert nueva["verificada"] is True
    assert cliente.post(f"/api/productos/{p['id']}/resenas", json=resena, headers=h_cliente).status_code == 409  # una sola vez

    respuesta = {"respuesta": "¡Gracias por tu compra, Kevin!"}
    assert cliente.patch(f"/api/resenas/{nueva['id']}/respuesta", json=respuesta, headers=h_cliente).status_code == 403
    assert cliente.patch(f"/api/resenas/{nueva['id']}/respuesta", json=respuesta, headers=h_trabajadora).status_code == 200
    ficha = cliente.get(f"/api/productos/{p['id']}").json()
    vista = next(x for x in ficha["resenas"] if x["id"] == nueva["id"])
    assert vista["verificada"] and vista["respuesta"] == respuesta["respuesta"]
