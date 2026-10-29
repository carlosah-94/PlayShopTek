"""TT-02 · Prueba de carga con Locust: ¿cuántos clientes a la vez aguanta la tienda?

Cada "usuario" de Locust imita a un cliente real: mira el catálogo, busca, filtra
y abre fichas de productos, esperando entre 1 y 3 segundos entre clic y clic.
Solo LEE datos (no compra ni escribe nada), así la prueba no ensucia la base.

Uso (ver la guía TT-02):
  docker compose exec backend locust -f pruebas_carga/locustfile.py --headless -u 30 -r 10 -t 1m \
      --host https://playshoptek-api.onrender.com --html pruebas_carga/reporte_produccion_30.html
"""
import random

from locust import HttpUser, between, task

BUSQUEDAS = ["god of war", "fifa", "mando", "ps4", "spider"]
CATEGORIAS = ["PS5", "PS4", "PS3", "Mandos", "Máquinas"]


class Cliente(HttpUser):
    wait_time = between(1, 3)  # segundos que "piensa" el cliente antes del siguiente clic

    def on_start(self):
        """Al entrar, cada cliente carga el catálogo y se guarda los id de los productos."""
        r = self.client.get("/api/productos", name="Catálogo")
        self.ids = [p["id"] for p in r.json()] if r.ok else list(range(1, 49))  # si falla, usa los 48 del catálogo

    @task(4)  # el número es cuántas veces más seguido pasa: mirar el catálogo es lo más común
    def ver_catalogo(self):
        self.client.get("/api/productos", name="Catálogo")

    @task(3)
    def ver_ficha(self):
        pid = random.choice(self.ids)
        self.client.get(f"/api/productos/{pid}", name="Ficha de producto")
        self.client.get(f"/api/productos/{pid}/parecidos", name="Parecidos (IA · KNN)")

    @task(2)
    def buscar(self):
        self.client.get("/api/productos", params={"q": random.choice(BUSQUEDAS)}, name="Búsqueda")

    @task(1)
    def filtrar(self):
        self.client.get("/api/productos", params={"categoria": random.choice(CATEGORIAS)}, name="Filtro por categoría")
