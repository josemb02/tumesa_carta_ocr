"""
Aquí centralizo todos los handlers globales de excepciones.

¿Por qué lo hago así?
- Para no tener lógica de errores dentro de main.py
- Para mantener la arquitectura limpia
- Para que el proyecto sea más profesional y escalable
- Para cumplir buenas prácticas de producción segura

Cualquier excepción que ocurra en la aplicación
pasará por aquí.
"""

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging

# Creo un logger específico para la aplicación
logger = logging.getLogger("tumesa")


def register_exception_handlers(app):
    """
    Esta función registra todos los manejadores de excepciones
    en la instancia principal de FastAPI.

    La llamo desde main.py justo después de crear la app.
    """

    # ---------------------------------------------------------
    # 1) Handler para errores de validación (Pydantic)
    # ---------------------------------------------------------
    # Esto ocurre cuando el JSON que envían no cumple el schema.
    # Por ejemplo:
    # - nombre vacío
    # - precio negativo
    # - campo extra no permitido
    # - tipo incorrecto
    # ---------------------------------------------------------

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """
        Devuelvo un 422 controlado y limpio.
        No expongo información interna sensible.
        """

        return JSONResponse(
            status_code=422,
            content={
                "ok": False,
                "error": "JSON inválido",
                "detalles": exc.errors()  # solo detalles de validación
            },
        )

    # ---------------------------------------------------------
    # 2) Handler genérico para cualquier error inesperado
    # ---------------------------------------------------------
    # Esto captura errores no controlados.
    # Nunca devuelvo el stacktrace al cliente (seguridad).
    # Solo lo registro internamente en logs.
    # ---------------------------------------------------------

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        """
        Registro el error internamente (para diagnóstico),
        pero al cliente solo le envío un mensaje genérico.
        """

        logger.exception("Error inesperado en la API")

        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": "Error interno"
            },
        )
