"""Conexión a la base de datos con SQLAlchemy."""
from collections.abc import Generator

from sqlalchemy import MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

# Nombres fijos para índices y restricciones: así Alembic genera migraciones ordenadas.
NOMBRES = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Molde del que heredarán todas las tablas (paso 5)."""
    metadata = MetaData(naming_convention=NOMBRES)


engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    """Abre una conexión por cada pedido y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()