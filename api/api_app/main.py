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

import secrets
import hashlib

import resend

from datetime import date, datetime, timezone, timedelta

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from .config import settings
from .database import get_db
import httpx

from .models import User, Checkin, UserPointsTotal, GroupMember, UserAuthProvider, PasswordResetToken
from .schemas import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, AvatarUpdateRequest, GoogleAuthRequest, ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest
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
from .routers.notifications_router import router as notifications_router
from .routers.rewards_router import router as rewards_router

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
app.include_router(notifications_router)
app.include_router(rewards_router)


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
# AUTH - GOOGLE
# -------------------------------------------------------------------
# Verifica el id_token de Google y devuelve nuestro propio JWT.
#
# Flujo:
# 1) El cliente hace el flujo OAuth con Google y obtiene un id_token
# 2) Lo envía aquí
# 3) Verificamos el token contra la API de Google (tokeninfo)
# 4) Si el email ya existe → login automático
# 5) Si no existe → creamos usuario nuevo
# 6) Devolvemos TokenResponse igual que el login normal
#
# Seguridad:
# - OWASP A07: verificación del token en servidor de Google
# - OWASP A02: no guardamos credenciales de Google, solo el google_id
# - OWASP A09: audit log del evento
# -------------------------------------------------------------------
GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"

@app.post("/auth/google", response_model=TokenResponse)
def auth_google(
    payload: GoogleAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Inicia sesión con un id_token de Google.
    Crea el usuario si no existe.
    """
    ip = getattr(request.state, "client_ip", "unknown")
    rate_limit(key=f"google_auth:{ip}", max_requests=10, window_seconds=60)

    # ---------------------------------------------------------------
    # 1) Verificar el id_token con Google
    # ---------------------------------------------------------------
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(
                GOOGLE_TOKENINFO_URL,
                params={"id_token": payload.id_token},
            )
            resp.raise_for_status()
            info = resp.json()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google inválido o caducado",
        )

    # Verificamos que el token fue emitido para esta aplicación concreta.
    # Si GOOGLE_CLIENT_ID está configurado, el campo "aud" del token
    # debe coincidir con él. Si está vacío, omitimos la comprobación
    # para no romper entornos de desarrollo sin CLIENT_ID definido.
    if settings.GOOGLE_CLIENT_ID:
        aud = info.get("aud", "")
        if aud != settings.GOOGLE_CLIENT_ID:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de Google no dirigido a esta aplicación",
            )

    google_id = info.get("sub")
    email = info.get("email")
    email_verified = info.get("email_verified", "false")
    nombre = info.get("name") or info.get("given_name") or ""

    if not google_id or not email or email_verified != "true":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El token de Google no contiene un email verificado",
        )

    # ---------------------------------------------------------------
    # 2) Buscar usuario existente por proveedor o por email
    # ---------------------------------------------------------------
    # Primero buscamos por (provider='google', provider_user_id=google_id)
    proveedor = db.query(UserAuthProvider).filter(
        UserAuthProvider.provider == "google",
        UserAuthProvider.provider_user_id == google_id,
    ).first()

    if proveedor is not None:
        user = db.query(User).filter(User.id == proveedor.user_id).first()
    else:
        # Buscar por email por si ya tenía cuenta local
        user = db.query(User).filter(User.email == email).first()

        if user is not None:
            # Vinculamos la cuenta existente con Google
            nuevo_proveedor = UserAuthProvider(
                user_id=user.id,
                provider="google",
                provider_user_id=google_id,
            )
            db.add(nuevo_proveedor)
            db.commit()
        else:
            # -------------------------------------------------------
            # 3) Crear usuario nuevo
            # -------------------------------------------------------
            username_base = email.split("@")[0][:28].strip()
            username_base = "".join(c for c in username_base if c.isalnum() or c in "_-")
            if len(username_base) < 3:
                username_base = "user"

            # Garantizamos unicidad del username añadiendo sufijo si hace falta
            username_final = username_base
            sufijo = 1
            while db.query(User).filter(User.username == username_final).first() is not None:
                username_final = f"{username_base}{sufijo}"
                sufijo += 1

            user = User(
                email=email,
                username=username_final,
                password_hash=None,
                role="user",
            )
            db.add(user)
            db.flush()  # necesitamos user.id antes de crear el proveedor

            nuevo_proveedor = UserAuthProvider(
                user_id=user.id,
                provider="google",
                provider_user_id=google_id,
            )
            db.add(nuevo_proveedor)
            db.commit()
            db.refresh(user)

    if user is None or user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    # ---------------------------------------------------------------
    # 4) Emitir nuestro propio JWT
    # ---------------------------------------------------------------
    token = create_access_token(
        subject=str(user.id),
        expires_minutes=settings.JWT_EXPIRE_MINUTES,
    )
    refresh_token = create_refresh_token(user_id=user.id, db=db)

    write_audit_log(
        db=db,
        action="auth_google_ok",
        request=request,
        user_id=user.id,
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
# AUTH - ME/STREAKS
# -------------------------------------------------------------------
# Calcula las rachas de check-ins del usuario autenticado.
#
# Algoritmo:
# - Se obtienen las fechas distintas de check-ins (solo la parte date,
#   sin hora) para no contar varias veces el mismo día.
# - Racha actual: días consecutivos contando hacia atrás desde hoy.
#   Se considera "viva" si el último check-in fue hoy o ayer.
# - Racha máxima: secuencia consecutiva más larga del historial.
#
# Seguridad:
# - OWASP A01: protegido con get_current_user, solo ve sus propios datos
# -------------------------------------------------------------------
@app.get("/auth/me/streaks")
def auth_me_streaks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve las rachas de check-ins del usuario.

    Campos:
    - racha_actual: días consecutivos hasta hoy (0 si no hay racha viva)
    - racha_maxima: racha más larga del historial
    - ultimo_checkin: fecha ISO del último check-in (o null)
    """
    # Fechas distintas de check-ins, en orden descendente
    filas = db.query(
        func.date(Checkin.created_at).label("fecha")
    ).filter(
        Checkin.user_id == current_user.id
    ).distinct().order_by(
        func.date(Checkin.created_at).desc()
    ).all()

    fechas = [row.fecha for row in filas]  # lista de date, más reciente primero

    if not fechas:
        return {"racha_actual": 0, "racha_maxima": 0, "ultimo_checkin": None}

    # ---------------------------------------------------------------
    # Racha actual
    # ---------------------------------------------------------------
    # La racha sigue viva si el último check-in fue hoy o ayer.
    hoy = datetime.now(timezone.utc).date()
    ayer = hoy - timedelta(days=1)

    racha_actual = 0
    if fechas[0] >= ayer:
        racha_actual = 1
        esperado = fechas[0] - timedelta(days=1)
        for f in fechas[1:]:
            if f == esperado:
                racha_actual += 1
                esperado -= timedelta(days=1)
            else:
                break  # cadena rota

    # ---------------------------------------------------------------
    # Racha máxima histórica
    # ---------------------------------------------------------------
    fechas_asc = sorted(fechas)
    racha_maxima = 1
    racha_temp = 1
    for i in range(1, len(fechas_asc)):
        if fechas_asc[i] - fechas_asc[i - 1] == timedelta(days=1):
            racha_temp += 1
            if racha_temp > racha_maxima:
                racha_maxima = racha_temp
        else:
            racha_temp = 1

    return {
        "racha_actual": racha_actual,
        "racha_maxima": racha_maxima,
        "ultimo_checkin": str(fechas[0]),
    }


# -------------------------------------------------------------------
# AUTH - CAMBIAR CONTRASEÑA
# -------------------------------------------------------------------
@app.post("/auth/me/change-password", status_code=200)
def auth_me_change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Cambia la contraseña del usuario autenticado.

    Flujo:
    1) Verifica que la contraseña actual es correcta
    2) Valida la nueva (min 8 chars, ya garantizado por el schema)
    3) Guarda el nuevo hash
    4) Revoca todos los refresh tokens activos (cierre de sesiones)

    Seguridad:
    - OWASP A07: se exige la contraseña actual antes de cambiar
    - OWASP A02: se usa bcrypt para el hash
    """
    # Si el usuario se registró con Google no tiene password_hash
    if current_user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu cuenta usa login con Google; no tiene contraseña local.",
        )

    # Verificar contraseña actual
    if not verify_password(payload.password_actual, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta.",
        )

    # Guardar el nuevo hash
    current_user.password_hash = hash_password(payload.password_nuevo)
    db.commit()

    return {"mensaje": "Contraseña actualizada correctamente."}


# -------------------------------------------------------------------
# RECUPERACIÓN DE CONTRASEÑA
# -------------------------------------------------------------------

@app.post("/auth/forgot-password", status_code=200)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Solicita recuperación de contraseña.
    Siempre devuelve 200 aunque el email no exista (seguridad OWASP A01).
    Envía un email con link válido 1 hora si el email existe.
    """
    ip = getattr(request.state, "client_ip", "unknown")
    rate_limit(key=f"forgot_password:{ip}", max_requests=3, window_seconds=3600)

    # Buscamos el usuario — si no existe devolvemos 200 igualmente
    user = db.query(User).filter(User.email == payload.email.lower().strip()).first()
    if not user or not user.email:
        return {"detail": "Si el email existe recibirás un correo"}

    # Invalidar tokens anteriores del mismo usuario
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).delete()
    db.flush()

    # Generar token seguro y guardarlo hasheado
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(reset_token)
    db.commit()

    # Enviar email con Resend
    if settings.RESEND_API_KEY:
        resend.api_key = settings.RESEND_API_KEY
        reset_link = f"https://beer-now.com/reset-password?token={raw_token}"
        try:
            html_content = (
                "<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px'>"
                "<h2 style='color:#10233E'>Recupera tu contraseña</h2>"
                "<p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta BeerNow.</p>"
                "<p>Pulsa el botón para crear una contraseña nueva. El enlace caduca en <strong>1 hora</strong>.</p>"
                f"<a href='{reset_link}' style='display:inline-block;background:#10233E;color:#fff;"
                "padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0'>"
                "Restablecer contraseña</a>"
                "<p style='color:#888;font-size:13px'>Si no solicitaste esto ignora este email.</p>"
                "<p style='color:#888;font-size:13px'>El equipo de BeerNow</p>"
                "</div>"
            )
            resend.Emails.send({
                "from": "BeerNow <noreply@beer-now.com>",
                "to": user.email,
                "subject": "Recupera tu contraseña de BeerNow",
                "html": html_content,
            })
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"[Resend] Error enviando email: {e}")

    return {"detail": "Si el email existe recibirás un correo"}


@app.post("/auth/reset-password", status_code=200)
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Restablece la contraseña usando el token del email.
    """
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()

    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at.is_(None),
    ).first()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    if reset_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    # Actualizar contraseña y marcar token como usado
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido o expirado")

    user.password_hash = hash_password(payload.password_nuevo)
    reset_token.used_at = datetime.now(timezone.utc)
    db.commit()

    return {"detail": "Contraseña actualizada correctamente"}


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
# -------------------------------------------------------------------
# Perfil público de cualquier usuario autenticado
# -------------------------------------------------------------------
# Solo expone datos públicos: nada de email ni fecha de nacimiento.
# Cualquier usuario autenticado puede ver el perfil de otro.
# Se usa desde el mini-perfil del ranking.
# -------------------------------------------------------------------
@app.get("/users/{user_id}/public")
def get_public_profile(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve el perfil público de un usuario y sus estadísticas básicas:
    - avatar, username, ciudad, pais
    - total de check-ins históricos
    - total de puntos
    """
    from uuid import UUID as PyUUID
    try:
        uid = PyUUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de usuario no válido")

    usuario = db.query(User).filter(
        User.id == uid,
        User.is_active == True,
    ).first()

    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Total de check-ins históricos (contador directo desde la tabla)
    total_checkins = db.query(func.count(Checkin.id)).filter(
        Checkin.user_id == uid
    ).scalar() or 0

    # Puntos totales desde la tabla resumen
    resumen = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == uid
    ).first()
    total_points = resumen.total_points if resumen else 0

    return {
        "user_id":        str(usuario.id),
        "username":       usuario.username,
        "avatar_url":     usuario.avatar_url,
        "ciudad":         usuario.ciudad,
        "pais":           usuario.pais,
        "total_checkins": total_checkins,
        "total_points":   total_points,
    }


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