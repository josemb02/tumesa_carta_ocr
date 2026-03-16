# app/auth.py
# -------------------------------------------------------------------
# Seguridad: Autenticación y Autorización basada en JWT.
# OWASP Top 10 (2025) aplicado:
# - A01 Broken Access Control: protegemos rutas con dependencias.
# - A02 Cryptographic Failures: JWT firmado con secret y algoritmo.
# - A07 Identification and Authentication Failures: validación robusta
#   de token y usuario, respuestas 401/403 correctas.
# -------------------------------------------------------------------

from datetime import datetime, timedelta, timezone
import uuid

import bcrypt
from jose import JWTError, jwt

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User


# -------------------------------------------------------------------
# OAuth2PasswordBearer:
# - Extrae el token del header: Authorization: Bearer <token>
# - tokenUrl indica dónde se obtiene el token (tu endpoint de login).
# -------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def hash_password(password: str) -> str:
    """
    Genera un hash bcrypt seguro a partir de una contraseña en texto plano.

    Seguridad:
    - OWASP (2025): A02 Cryptographic Failures.
    - Nunca se almacena la contraseña en claro.
    """
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """
    Verifica si una contraseña coincide con su hash bcrypt almacenado.

    Seguridad:
    - OWASP (2025): A07 Identification and Authentication Failures.
    - Comparación segura usando bcrypt.checkpw.
    """
    password_bytes = password.encode("utf-8")
    hashed_bytes = hashed_password.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def create_access_token(subject: str, expires_minutes: int) -> str:
    """
    Crea un JWT firmado para autenticar al usuario.

    subject:
    - Se usa el 'sub' como identificador del usuario.
    - En este proyecto es el UUID del usuario en string.

    Seguridad:
    - OWASP (2025): A02 Cryptographic Failures.
    - Se firma con secret + algoritmo.
    - Se añade expiración para limitar impacto si se filtra el token.
    """

    # Se usa datetime con timezone UTC para evitar problemas
    # de fechas naive y dejar el token bien definido.
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

    payload = {
        "sub": subject,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )

    return token


def decode_and_verify_token(token: str) -> dict:
    """
    Decodifica y verifica el JWT.

    Qué comprueba:
    - firma
    - expiración

    Si algo falla, se responde con 401.
    """

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )

        return payload

    except JWTError:
        # Respuesta genérica para no dar pistas técnicas
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )


def _parse_uuid(value: str) -> uuid.UUID:
    """
    Convierte un string a UUID de forma segura.

    Si no es UUID válido -> 401.

    Esto evita:
    - errores internos por ValueError
    - tokens manipulados o mal formados
    """
    try:
        return uuid.UUID(value)

    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """
    Devuelve el usuario autenticado a partir del JWT.

    Flujo:
    1) extrae token del header
    2) verifica firma y expiración
    3) lee el sub
    4) convierte el sub a UUID
    5) busca el usuario en BD
    6) comprueba que siga activo
    7) devuelve el usuario
    """

    payload = decode_and_verify_token(token)

    user_id_str = payload.get("sub")

    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )

    # Se convierte el identificador del token a UUID real
    # para compararlo correctamente con la PK de PostgreSQL.
    user_uuid = _parse_uuid(user_id_str)

    user = db.query(User).filter(User.id == user_uuid).first()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado"
        )

    # Si el usuario está desactivado, no debe poder seguir
    # entrando aunque el token todavía no haya expirado.
    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inactivo"
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Restringe endpoints a usuarios admin.

    Esta función se usa en rutas donde solo debe entrar
    un usuario con rol de administrador.
    """

    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: se requiere rol admin"
        )

    return current_user