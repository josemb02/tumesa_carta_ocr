# syntax=docker/dockerfile:1.7
# Dockerfile para la aplicación FastAPI. Utiliza una imagen base de Python 3.12 slim, instala las dependencias en una etapa de construcción y luego copia solo lo necesario a la etapa de ejecución para mantener la imagen final ligera.
# Además, se crea un usuario no-root para ejecutar la aplicación de forma más segura, se exponen los puertos necesarios y se configura un healthcheck para verificar que la aplicación esté funcionando correctamente.
# Para construir la imagen, se puede usar el comando:
# docker build -t tumesa_carta:latest .
# para ejecutar el contenedor:
# docker run -d -p 8000:8000 --name tumesa_carta --env-file .env tumesa_carta:latest

FROM python:3.12-slim AS builder
WORKDIR /build

ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN python -m venv /opt/venv
RUN /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

FROM python:3.12-slim AS runtime

# Usuario no-root
RUN useradd -r -u 10001 appuser

WORKDIR /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=prod

COPY --from=builder /opt/venv /opt/venv

# Copio la app
COPY app ./app

# Copio también tests y templates para que estén disponibles en el contenedor, aunque no se usen en producción. Esto es útil para debugging o futuras pruebas dentro del contenedor.
COPY tests ./tests
COPY templates ./templates

RUN chown -R appuser:appuser /app
USER 10001

EXPOSE 8000
# Configuración de healthcheck para verificar que la aplicación esté funcionando correctamente
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health').read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
