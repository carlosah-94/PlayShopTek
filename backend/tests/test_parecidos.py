"""Pruebas de "productos parecidos" con KNN."""


def test_parecidos_con_knn(cliente):
    juegos = cliente.get("/api/productos", params={"categoria": "PS5"}).json()
    juego = juegos[0]
    r = cliente.get(f"/api/productos/{juego['id']}/parecidos")
    assert r.status_code == 200
    parecidos = r.json()
    assert 1 <= len(parecidos) <= 4
    assert all(p["id"] != juego["id"] for p in parecidos)       # no se recomienda a sí mismo
    assert parecidos[0]["categoria"] == juego["categoria"]      # el más cercano es de su misma categoría
    assert cliente.get("/api/productos/999999/parecidos").json() == []