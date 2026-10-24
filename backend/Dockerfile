FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Entrena el modelo del asistente al construir la imagen (en la nube gratis entrenarlo al
# recibir el primer mensaje tardaba demasiado). Así la API arranca con el modelo listo.
RUN python -m app.ia.asistente

EXPOSE 8000
# 1) crea/actualiza las tablas  2) carga datos de ejemplo si la base está vacía  3) arranca la API
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]