"""Configuración de la aplicación.

Los valores se leen de variables de entorno (archivo .env en desarrollo,
panel de Render en producción). Así el mismo código sirve en ambos lados.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Conexión a PostgreSQL. En Docker el host es "db" (nombre del servicio).
    database_url: str = "postgresql+psycopg://playshoptek:playshoptek@localhost:5433/playshoptek"

    # Token de sesión (JWT)
    jwt_secret: str = "solo-para-desarrollo-cambiala-en-produccion"
    jwt_algoritmo: str = "HS256"
    jwt_minutos: int = 60 * 8  # una jornada de trabajo

    # Orígenes que pueden llamar a la API (el frontend)
    cors_origenes: str = "http://localhost:5173"

    # Contraseñas de las cuentas de prueba (solo desarrollo)
    seed_password_equipo: str = "tienda123"
    seed_password_cliente: str = "demo123"

    @property
    def cors_lista(self) -> list[str]:
        return [o.strip() for o in self.cors_origenes.split(",") if o.strip()]


settings = Settings()