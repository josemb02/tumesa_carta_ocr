# api/app/middleware.py
# -------------------------------------------------------------------
# Middlewares PRO
# -------------------------------------------------------------------
# Este archivo concentra middlewares reutilizables de toda la API.
#
# Objetivo:
# - Generar un request_id por petición para trazabilidad
# - Registrar logs básicos de request/response
# - Añadir cabeceras de seguridad HTTP
#
# Seguridad:
# - OWASP A05 Security Misconfiguration:
#   añadimos headers seguros por defecto
# - OWASP A09 Logging and Monitoring Failures:
#   dejamos trazabilidad con request_id e información mínima útil
#
# Nota importante:
# - No logeamos body, contraseñas, JWT ni datos sensibles.
# - Solo registramos metadatos básicos de la petición.
# -------------------------------------------------------------------

import time
import uuid
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from .config import settings

logger = logging.getLogger("beermap")


def get_client_ip(request: Request) -> str:
    """
    Devuelve la IP del cliente de la forma más razonable posible.

    Qué hace:
    - Si hay cabecera X-Forwarded-For, usa la primera IP.
    - Si no, usa request.client.host.
    - Si no puede obtenerla, devuelve 'unknown'.

    Esto sirve para:
    - logs
    - auditoría
    - rate limit
    """
    xff = request.headers.get("x-forwarded-for")
    if xff is not None and xff.strip() != "":
        parts = xff.split(",")
        if len(parts) > 0:
            ip = parts[0].strip()
            if ip != "":
                return ip

    if request.client is not None and request.client.host is not None:
        return str(request.client.host)

    return "unknown"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware que añade contexto común a cada petición.

    Qué hace:
    - Genera un request_id único
    - Guarda request_id e IP en request.state
    - Mide tiempo de respuesta
    - Añade X-Request-ID a la respuesta
    - Registra método, path, status y tiempo

    Esto ayuda a:
    - depuración
    - trazabilidad
    - observabilidad
    """
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        client_ip = get_client_ip(request)

        request.state.request_id = request_id
        request.state.client_ip = client_ip

        start = time.time()

        try:
            response: Response = await call_next(request)
        finally:
            elapsed_ms = int((time.time() - start) * 1000)

        # Si la respuesta existe, añadimos request_id
        # Si hubiera una excepción, el handler global se encargará luego
        try:
            response.headers["X-Request-ID"] = request_id
            status_code = response.status_code
        except Exception:
            status_code = 500

        logger.info(
            "request_id=%s ip=%s method=%s path=%s status=%s ms=%s",
            request_id,
            client_ip,
            request.method,
            request.url.path,
            status_code,
            elapsed_ms,
        )

        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware de cabeceras de seguridad HTTP.

    Qué hace:
    - Añade headers básicos recomendables para endurecer respuestas HTTP.

    Seguridad:
    - OWASP A05 Security Misconfiguration
    """
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Evita MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Evita iframes / clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Evita filtrar referrer innecesario
        response.headers["Referrer-Policy"] = "no-referrer"

        # Restringe acceso a capacidades del navegador
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # HSTS: solo se activa en producción, donde hay HTTPS real delante.
        # En desarrollo lo omitimos para no forzar HTTPS en localhost.
        if settings.ENV == "prod":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        # CSP básico: la API solo devuelve JSON, no sirve HTML ni scripts.
        # default-src 'none' es el valor más restrictivo posible.
        response.headers["Content-Security-Policy"] = "default-src 'none'"

        return response