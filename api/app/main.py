# app/main.py
# -------------------------------------------------------------------
# BeerMap API (FastAPI)
# -------------------------------------------------------------------
# Este archivo crea la aplicación principal y conecta todas las piezas
# comunes del backend:
#
# - middlewares
# - handlers globales de excepciones
# - CORS
# - endpoints de autenticación
# - registro de routers
#
# La idea es dejar aquí la base común del proyecto para no tener que
# repetir seguridad y control de errores en cada endpoint nuevo que
# hagamos después (groups, checkins, chat, ranking, iconos...).
#
# Seguridad (OWASP Top 10 2025):
# - A01 Broken Access Control:
#     * endpoints protegidos con dependencias (get_current_user / require_admin)
# - A02 Cryptographic Failures:
#     * JWT firmado y con expiración
# - A03 Injection:
#     * uso de SQLAlchemy ORM, evitando SQL concatenado manual
# - A05 Security Misconfiguration:
#     * configuración centralizada, CORS por entorno, headers de seguridad
# - A07 Identification and Authentication Failures:
#     * login robusto, respuestas 401/403 correctas y anti fuerza bruta
# - A09 Logging and Monitoring Failures:
#     * audit logs + request_id + logging uniforme
# -------------------------------------------------------------------

from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .database import get_db
from .models import User
from .schemas import RegisterRequest, LoginRequest, TokenResponse
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    require_admin,
)
from .middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from .exceptions import (
    http_exception_handler,
    validation_exception_handler,
    sqlalchemy_exception_handler,
    generic_exception_handler,
)
from .ratelimit import rate_limit
from .audit import write_audit_log

# -------------------------------------------------------------------
# Import de routers
# -------------------------------------------------------------------
# Aquí vamos registrando los bloques funcionales de la API.
# Esto se parece más a la idea de "controllers" separados.
# -------------------------------------------------------------------
from .routers.groups_router import router as groups_router
from .routers.checkins_router import router as checkins_router
from .routers.rankings_router import router as rankings_router
from .routers.chat_router import router as chat_router

# -------------------------------------------------------------------
# Creación de la app principal
# -------------------------------------------------------------------
app = FastAPI(
    title="BeerMap API",
    version="1.0.0",
    description="API segura para BeerMap (práctica de Puesta en Producción Segura).",
)


# -------------------------------------------------------------------
# Registro de middlewares comunes
# -------------------------------------------------------------------
# Estos middlewares se aplican a todas las peticiones:
# - request_id
# - ip del cliente
# - logging básico
# - headers de seguridad
# -------------------------------------------------------------------
app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


# -------------------------------------------------------------------
# Registro de routers
# -------------------------------------------------------------------
# Aquí se conectan los bloques funcionales principales del backend.
# -------------------------------------------------------------------
app.include_router(rankings_router)
app.include_router(checkins_router)
app.include_router(groups_router)
app.include_router(chat_router)


# -------------------------------------------------------------------
# CORS (controlado por variables de entorno)
# -------------------------------------------------------------------
# En desarrollo puede ser "*".
# En producción lo correcto es definir una lista concreta de dominios.
# -------------------------------------------------------------------
cors_origins = []

if settings.CORS_ORIGINS:
    raw = settings.CORS_ORIGINS.strip()

    if raw == "*":
        cors_origins = ["*"]
    else:
        parts = raw.split(",")

        for p in parts:
            origin = p.strip()

            if origin:
                cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else [],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# -------------------------------------------------------------------
# Registro de handlers globales de excepciones
# -------------------------------------------------------------------
# Esto sirve para:
# - devolver errores con formato uniforme
# - no filtrar trazas internas al cliente
# - dejar la API preparada para crecer sin repetir try/except por todas partes
# -------------------------------------------------------------------
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)


# -------------------------------------------------------------------
# HEALTH
# -------------------------------------------------------------------
# Endpoint de salud simple para:
# - healthcheck de Docker
# - comprobación rápida desde Postman / PowerShell
# - monitorización básica
# -------------------------------------------------------------------
@app.get("/health")
def health():
    return {
        "status": "ok",
        "ts": datetime.now(timezone.utc).isoformat()
    }


# -------------------------------------------------------------------
# AUTH - REGISTER
# -------------------------------------------------------------------
@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Registra un usuario nuevo.

    Qué hace:
    - limita intentos por IP para evitar abuso del endpoint
    - comprueba email y username duplicados
    - guarda la contraseña hasheada
    - guarda también los datos básicos del perfil
    - crea un audit log
    - devuelve solo datos seguros del usuario

    Seguridad:
    - OWASP A07:
      evita duplicados y entradas inválidas
    - OWASP A02:
      nunca se guarda password en claro
    - OWASP A09:
      registra la acción en audit_logs
    """
    # Limitamos peticiones de registro por IP para no permitir abuso masivo
    ip = getattr(request.state, "client_ip", "unknown")
    rate_limit(
        key=f"register:{ip}",
        max_requests=5,
        window_seconds=60
    )

    # Limpiamos algunos campos de texto para guardar datos más consistentes.
    username_limpio = payload.username.strip()

    pais_limpio = None
    if payload.pais is not None:
        pais_limpio = payload.pais.strip()

    ciudad_limpia = None
    if payload.ciudad is not None:
        ciudad_limpia = payload.ciudad.strip()

    # Comprobamos si el email ya existe
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    # Comprobamos si el username ya existe
    existing_username = db.query(User).filter(User.username == username_limpio).first()
    if existing_username is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese username",
        )

    # Creamos el usuario guardando solo el hash de la contraseña
    # y los datos básicos del perfil.
    user = User(
        username=username_limpio,
        email=payload.email,
        password_hash=hash_password(payload.password),
        fecha_nacimiento=payload.fecha_nacimiento,
        pais=pais_limpio,
        ciudad=ciudad_limpia,
        role="user",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Dejamos trazabilidad de la acción
    write_audit_log(
        db=db,
        action="auth_register",
        request=request,
        user_id=user.id
    )

    # Nunca devolvemos password_hash
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "fecha_nacimiento": user.fecha_nacimiento,
        "pais": user.pais,
        "ciudad": user.ciudad,
        "role": user.role,
    }


# -------------------------------------------------------------------
# AUTH - LOGIN
# -------------------------------------------------------------------
@app.post("/auth/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Autentica un usuario por email y contraseña.

    Qué hace:
    - limita intentos por IP
    - busca usuario por email
    - valida password con bcrypt
    - genera JWT firmado
    - registra audit log de éxito o fallo

    Seguridad:
    - OWASP A07:
      respuesta genérica si credenciales inválidas
    - OWASP A02:
      JWT firmado + expiración
    - OWASP A09:
      dejamos trazabilidad del login
    """
    ip = getattr(request.state, "client_ip", "unknown")

    # Anti fuerza bruta simple por IP
    rate_limit(
        key=f"login:{ip}",
        max_requests=settings.LOGIN_MAX_ATTEMPTS,
        window_seconds=settings.LOGIN_WINDOW_SECONDS
    )

    user = db.query(User).filter(User.email == payload.email).first()

    # No damos pistas sobre si el email existe o no
    if user is None or user.password_hash is None:
        write_audit_log(
            db=db,
            action="auth_login_failed",
            request=request,
            user_id=None
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Si el usuario está desactivado, no se permite login.
    if user.is_active is False:
        write_audit_log(
            db=db,
            action="auth_login_blocked_inactive",
            request=request,
            user_id=user.id
        )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    ok = verify_password(payload.password, user.password_hash)

    if ok is False:
        write_audit_log(
            db=db,
            action="auth_login_failed",
            request=request,
            user_id=user.id
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )

    # Si el login es correcto, generamos token JWT
    token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.JWT_EXPIRE_MINUTES,
    )

    write_audit_log(
        db=db,
        action="auth_login_ok",
        request=request,
        user_id=user.id
    )

    return TokenResponse(access_token=token)


# -------------------------------------------------------------------
# AUTH - ME
# -------------------------------------------------------------------
# Endpoint protegido para devolver la identidad del usuario autenticado.
# Sirve para comprobar que el token JWT es correcto y saber el rol.
# -------------------------------------------------------------------
@app.get("/auth/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "fecha_nacimiento": current_user.fecha_nacimiento,
        "pais": current_user.pais,
        "ciudad": current_user.ciudad,
        "role": current_user.role,
    }


# -------------------------------------------------------------------
# ADMIN - PING
# -------------------------------------------------------------------
# Endpoint de prueba para comprobar control de rol.
# Solo debe entrar un usuario con role=admin.
# -------------------------------------------------------------------
@app.get("/admin/ping")
def admin_ping(
    request: Request,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    write_audit_log(
        db=db,
        action="admin_ping",
        request=request,
        user_id=admin_user.id
    )

    return {
        "status": "ok",
        "message": "Acceso admin confirmado"
    }