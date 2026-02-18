"""
Archivo principal de la API.

Aquí:
- Creo la aplicación FastAPI
- Registro middlewares de seguridad
- Registro handlers globales de excepciones
- Defino los endpoints principales

Este archivo actúa como punto de entrada del backend.

Enfoque de seguridad aplicado (basado en OWASP):

- Validación estricta de entrada (Improper Input Validation)
- Manejo seguro de errores (Improper Error Handling)
- Cabeceras de seguridad (Security Misconfiguration)
- Limitación de recursos (Unrestricted Resource Consumption)
- Logging para trazabilidad (Security Logging & Monitoring)
"""

from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
import json
import logging
import time

from app.database import Base, engine, get_db
from app.models import Menu
from app.schemas import MenuIn


# ---------------------------------------------------------
# Creación de la aplicación FastAPI
# ---------------------------------------------------------
# Título y versión visibles en documentación automática (/docs)
# ---------------------------------------------------------

app = FastAPI(title="TuMesa Carta OCR", version="1.0.0")


# ---------------------------------------------------------
# Configuración básica de logging
# ---------------------------------------------------------
# Uso logging en lugar de prints porque es más profesional.
# OWASP: Security Logging & Monitoring Failures
# Permite:
# - Registrar peticiones
# - Registrar errores
# - Diagnosticar problemas en producción
# ---------------------------------------------------------

logger = logging.getLogger("tumesa")
logging.basicConfig(level=logging.INFO)


# ---------------------------------------------------------
# Evento de arranque (startup)
# ---------------------------------------------------------
# Creo las tablas automáticamente al iniciar la app.
# En producción real usaría Alembic (migraciones),
# pero para este proyecto es suficiente.
# ---------------------------------------------------------

@app.on_event("startup")
def crear_tablas():
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------
# Middleware de logging de peticiones
# ---------------------------------------------------------
# Registra:
# - Método HTTP
# - Ruta
# - Código de estado
# - Tiempo de ejecución
# OWASP: Security Logging & Monitoring
# ---------------------------------------------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):

    inicio = time.time()
    response = await call_next(request)
    duracion_ms = int((time.time() - inicio) * 1000)

    logger.info(
        "%s %s -> %s (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        duracion_ms
    )

    return response


# ---------------------------------------------------------
# Middleware de cabeceras de seguridad (OWASP)
# ---------------------------------------------------------
# OWASP: Security Misconfiguration
# Añade headers defensivos para mitigar:
# - Clickjacking (X-Frame-Options)
# - Content sniffing (X-Content-Type-Options)
# - Fugas de información vía referer
# - Uso no deseado de APIs del navegador
# ---------------------------------------------------------

@app.middleware("http")
async def security_headers(request: Request, call_next):

    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    return response


# ---------------------------------------------------------
# Middleware para limitar tamaño del body (Anti-DoS)
# ---------------------------------------------------------
# OWASP: Unrestricted Resource Consumption
# Evita que alguien envíe un JSON enorme para consumir memoria
# Límite actual: 1MB
# ---------------------------------------------------------

@app.middleware("http")
async def limit_body_size(request: Request, call_next):

    max_bytes = 1024 * 1024  # 1 MB
    content_length = request.headers.get("content-length")

    if content_length is not None:
        try:
            if int(content_length) > max_bytes:
                return JSONResponse(
                    status_code=413,
                    content={"ok": False, "error": "Body demasiado grande"}
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content={"ok": False, "error": "Content-Length inválido"}
            )

    return await call_next(request)


# ---------------------------------------------------------
# Handler global para errores de validación
# ---------------------------------------------------------
# OWASP: Improper Input Validation
# Se ejecuta cuando el JSON no cumple el schema Pydantic.
# Ejemplos:
# - nombre vacío
# - precio negativo
# - campo extra no permitido (extra=forbid)
# ---------------------------------------------------------

@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):

    return JSONResponse(
        status_code=422,
        content={
            "ok": False,
            "error": "JSON inválido",
            "detalles": exc.errors()
        },
    )


# ---------------------------------------------------------
# Handler global para errores inesperados
# ---------------------------------------------------------
# OWASP: Improper Error Handling
# Nunca devuelvo stacktrace ni detalles internos.
# Solo registro el error internamente en logs.
# ---------------------------------------------------------

@app.exception_handler(Exception)
def generic_exception_handler(request: Request, exc: Exception):

    logger.exception("Error inesperado en la API")

    return JSONResponse(
        status_code=500,
        content={
            "ok": False,
            "error": "Error interno"
        },
    )


# ---------------------------------------------------------
# Endpoint de salud
# ---------------------------------------------------------
# Usado por:
# - Docker healthcheck
# - Monitorización
# - Comprobación rápida de disponibilidad
# ---------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------
# Endpoint para guardar menú
# ---------------------------------------------------------
# Recibe:
# - barId por query
# - menu validado por Pydantic en body
#
# OWASP: Injection (mitigación)
# - No construyo SQL manualmente
# - Uso SQLAlchemy ORM (consultas parametrizadas)
# - El input ya viene validado antes de tocar la BD
# ---------------------------------------------------------

@app.post("/menus/guardar")
def guardar_menu(barId: int, menu: MenuIn, db: Session = Depends(get_db)):

    menu_json = {
        "barId": barId,
        "categorias": []
    }

    for categoria_entrada in menu.categorias:

        categoria = {
            "nombre": categoria_entrada.nombre,
            "productos": []
        }

        for producto_entrada in categoria_entrada.productos:

            producto = {
                "nombre": producto_entrada.nombre,
                "precio": producto_entrada.precio,
                "descripcion": producto_entrada.descripcion if producto_entrada.descripcion is not None else "",
                "imagen": producto_entrada.imagen
            }

            categoria["productos"].append(producto)

        menu_json["categorias"].append(categoria)

    nuevo_menu = Menu(
        bar_id=barId,
        menu_json=json.dumps(menu_json, ensure_ascii=False)
    )

    db.add(nuevo_menu)
    db.commit()
    db.refresh(nuevo_menu)

    return {"ok": True, "id": nuevo_menu.id}


# ---------------------------------------------------------
# Endpoint para obtener el último menú de un bar
# ---------------------------------------------------------
# OWASP: Injection (mitigación)
# Uso ORM con filtros parametrizados.
# ---------------------------------------------------------

@app.get("/menus/{barId}")
def obtener_menu(barId: int, db: Session = Depends(get_db)):

    menu = (
        db.query(Menu)
        .filter(Menu.bar_id == barId)
        .order_by(Menu.created_at.desc())
        .first()
    )

    if menu is None:
        return {
            "ok": False,
            "mensaje": "No hay carta guardada para este bar"
        }

    return {
        "ok": True,
        "menu": json.loads(menu.menu_json)
    }
