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

from datetime import datetime, timezone, timedelta

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .database import get_db
from .models import User, Checkin, UserPointsTotal, GroupMember
from .schemas import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, AvatarUpdateRequest
from .auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
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
from .routers.icons_router import router as icons_router

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
app.include_router(icons_router)


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

    # Si el login es correcto, generamos access token + refresh token
    token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.JWT_EXPIRE_MINUTES,
    )

    # El refresh token se guarda hasheado en BD
    refresh_token = create_refresh_token(user_id=user.id, db=db)

    write_audit_log(
        db=db,
        action="auth_login_ok",
        request=request,
        user_id=user.id
    )

    return TokenResponse(access_token=token, refresh_token=refresh_token)


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
        "avatar_url": current_user.avatar_url,
    }


# -------------------------------------------------------------------
# AUTH - ME/AVATAR
# -------------------------------------------------------------------
# El frontend sube la imagen directamente a Cloudinary (sin pasar
# por el backend). Este endpoint solo recibe la URL resultante y
# la guarda en la BD.
#
# Seguridad:
# - OWASP A01: protegido con get_current_user
# - OWASP A03: validamos que la URL pertenezca a nuestro cloud
#   para evitar que alguien guarde URLs arbitrarias
# -------------------------------------------------------------------
@app.patch("/auth/me/avatar")
def auth_me_avatar(
    payload: AvatarUpdateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Actualiza la foto de perfil del usuario autenticado.

    Solo acepta URLs de nuestro cloud de Cloudinary.
    El frontend es responsable de subir la imagen directamente
    a Cloudinary antes de llamar a este endpoint.
    """
    # Validamos que la URL provenga de nuestro cloud de Cloudinary.
    # Esto evita que se guarden URLs arbitrarias o de otros servicios.
    CLOUDINARY_PREFIX = "https://res.cloudinary.com/dxfvlrxaw/"
    if not payload.avatar_url.startswith(CLOUDINARY_PREFIX):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La URL de imagen no pertenece al servicio permitido"
        )

    current_user.avatar_url = payload.avatar_url
    current_user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)

    write_audit_log(
        db=db,
        action="avatar_updated",
        request=request,
        user_id=current_user.id
    )

    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "fecha_nacimiento": current_user.fecha_nacimiento,
        "pais": current_user.pais,
        "ciudad": current_user.ciudad,
        "role": current_user.role,
        "avatar_url": current_user.avatar_url,
    }


# -------------------------------------------------------------------
# AUTH - ME/STATS
# -------------------------------------------------------------------
@app.get("/auth/me/stats")
def auth_me_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Devuelve estadísticas de actividad del usuario autenticado.

    Qué incluye:
    - total_checkins: número total de check-ins
    - total_gastado: suma de precios de todos los check-ins
    - total_puntos: puntos acumulados (tabla resumen)
    - total_grupos: grupos a los que pertenece
    - checkins_esta_semana: check-ins de los últimos 7 días
    - checkins_este_mes: check-ins de los últimos 30 días
    - ultimo_checkin: fecha ISO del último check-in (o null si no hay)

    Seguridad:
    - OWASP A01: protegido con get_current_user, solo ve sus propios datos
    """
    ahora = datetime.now(timezone.utc)
    hace_7_dias = ahora - timedelta(days=7)
    hace_30_dias = ahora - timedelta(days=30)

    # Total de check-ins del usuario
    total_checkins = db.query(func.count(Checkin.id)).filter(
        Checkin.user_id == current_user.id
    ).scalar() or 0

    # Suma del precio de todos los check-ins (los que tienen precio)
    total_gastado = db.query(
        func.coalesce(func.sum(Checkin.precio), 0)
    ).filter(
        Checkin.user_id == current_user.id,
        Checkin.precio.isnot(None)
    ).scalar() or 0

    # Puntos totales desde la tabla resumen (evitamos sumar el ledger entero)
    puntos_row = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == current_user.id
    ).first()
    total_puntos = puntos_row.total_points if puntos_row else 0

    # Número de grupos a los que pertenece el usuario
    total_grupos = db.query(func.count(GroupMember.group_id)).filter(
        GroupMember.user_id == current_user.id
    ).scalar() or 0

    # Check-ins de los últimos 7 días
    checkins_esta_semana = db.query(func.count(Checkin.id)).filter(
        Checkin.user_id == current_user.id,
        Checkin.created_at >= hace_7_dias
    ).scalar() or 0

    # Check-ins de los últimos 30 días
    checkins_este_mes = db.query(func.count(Checkin.id)).filter(
        Checkin.user_id == current_user.id,
        Checkin.created_at >= hace_30_dias
    ).scalar() or 0

    # Fecha del último check-in (null si nunca ha hecho ninguno)
    ultimo = db.query(Checkin.created_at).filter(
        Checkin.user_id == current_user.id
    ).order_by(Checkin.created_at.desc()).first()

    ultimo_checkin = ultimo[0].isoformat() if ultimo else None

    return {
        "total_checkins": total_checkins,
        "total_gastado": float(total_gastado),
        "total_puntos": total_puntos,
        "total_grupos": total_grupos,
        "checkins_esta_semana": checkins_esta_semana,
        "checkins_este_mes": checkins_este_mes,
        "ultimo_checkin": ultimo_checkin,
    }


# -------------------------------------------------------------------
# AUTH - REFRESH
# -------------------------------------------------------------------
@app.post("/auth/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Renueva el access token usando un refresh token válido.

    Qué hace:
    - verifica que el refresh token existe, no está revocado y no ha expirado
    - revoca el refresh token usado (rotación: un token solo sirve una vez)
    - emite un nuevo access token y un nuevo refresh token
    - registra la operación en audit log

    Seguridad:
    - OWASP A07: rotación de tokens reduce impacto de filtración
    - OWASP A09: trazabilidad de cada renovación
    """
    # Verificamos el refresh token y obtenemos usuario + registro BD
    user, refresh_record = verify_refresh_token(payload.refresh_token, db)

    # Rotación: revocamos el token usado inmediatamente
    refresh_record.revoked = True
    db.commit()

    # Generamos nuevos tokens
    nuevo_access_token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.JWT_EXPIRE_MINUTES,
    )
    nuevo_refresh_token = create_refresh_token(user_id=user.id, db=db)

    write_audit_log(
        db=db,
        action="auth_refresh_ok",
        request=request,
        user_id=user.id
    )

    return TokenResponse(
        access_token=nuevo_access_token,
        refresh_token=nuevo_refresh_token
    )


# -------------------------------------------------------------------
# AUTH - LOGOUT
# -------------------------------------------------------------------
@app.post("/auth/logout")
def logout(
    payload: RefreshRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Cierra la sesión revocando el refresh token del cliente.

    Qué hace:
    - busca el refresh token en BD y lo marca como revocado
    - si el token no existe, responde igualmente con éxito
      (para no dar pistas sobre tokens válidos)
    - registra la operación en audit log

    Nota:
    - El access token no se puede revocar (es stateless por diseño).
      Seguirá siendo válido hasta que expire (JWT_EXPIRE_MINUTES).
      Por eso se recomienda usar tiempos de expiración cortos.
    """
    revoke_refresh_token(raw_token=payload.refresh_token, db=db)

    write_audit_log(
        db=db,
        action="auth_logout",
        request=request,
        user_id=None
    )

    return {"detail": "Sesión cerrada correctamente"}


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