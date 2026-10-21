"""Las pruebas usan la base definida en DATABASE_URL, ya migrada y con el seed cargado."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def cliente():
    return TestClient(app)


def token(cliente, email, password):
    r = cliente.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def h_dueno(cliente):
    return token(cliente, "angel@playshoptek.pe", "tienda123")


@pytest.fixture(scope="session")
def h_trabajadora(cliente):
    return token(cliente, "linda@playshoptek.pe", "tienda123")


@pytest.fixture(scope="session")
def h_cliente(cliente):
    return token(cliente, "cliente@demo.pe", "demo123")