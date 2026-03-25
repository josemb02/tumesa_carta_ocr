from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import date, datetime


# =========================================================
# BeerMap - SCHEMAS (Pydantic)
# =========================================================
# Este archivo define los contratos de datos de la API.
#
# Es decir:
# - qué recibe cada endpoint
# - qué devuelve cada endpoint
#
# Esto es importante porque:
# - valida datos automáticamente
# - evita datos basura
# - documenta la API (OpenAPI / Swagger)
# =========================================================


# =========================================================
# AUTH
# =========================================================

class RegisterRequest(BaseModel):
    """
    Datos necesarios para registrar un usuario.
    """
    # username va con máximo 30 porque en la BD
    # la columna real users.username es VARCHAR(30)
    username: str = Field(min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    # Datos básicos del perfil
    fecha_nacimiento: Optional[date] = None
    pais: str = Field(min_length=2, max_length=80)
    ciudad: str = Field(min_length=2, max_length=80)

    
class LoginRequest(BaseModel):
    """
    Datos necesarios para hacer login.
    """
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """
    Respuesta del endpoint de login y del endpoint de refresh.
    Incluye access_token (corta duración) y refresh_token (larga duración).
    """
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    """
    Datos necesarios para renovar el access token
    o para cerrar sesión revocando el refresh token.
    """
    refresh_token: str


class GoogleAuthRequest(BaseModel):
    """
    id_token de Google obtenido en el cliente tras el flujo OAuth.
    El backend lo verifica contra la API de Google.
    """
    id_token: str


class AvatarUpdateRequest(BaseModel):
    """
    URL pública de Cloudinary con la nueva foto de perfil.
    El frontend sube la imagen directamente a Cloudinary y
    aquí solo enviamos la URL resultante para que el backend
    la guarde en la BD.
    """
    avatar_url: str = Field(min_length=10, max_length=500)


class ChangePasswordRequest(BaseModel):
    """
    Datos para cambiar la contraseña del usuario autenticado.
    Se requiere la contraseña actual para evitar cambios no autorizados.
    """
    password_actual: str = Field(min_length=1, max_length=128)
    password_nuevo: str = Field(min_length=8, max_length=128)


# =========================================================
# GROUPS
# =========================================================

class CreateGroupRequest(BaseModel):
    """
    Crear un grupo nuevo.
    """
    name: str = Field(min_length=3, max_length=80)


class JoinGroupRequest(BaseModel):
    """
    Unirse a un grupo mediante código.
    """
    join_code: str = Field(min_length=4, max_length=10)


class GroupResponse(BaseModel):
    """
    Información básica de un grupo.
    """
    id: UUID
    name: str
    join_code: str


# =========================================================
# CHECKINS
# =========================================================

class CreateCheckinRequest(BaseModel):
    """
    Crear un check-in de cerveza.
    """
    lat: Decimal
    lng: Decimal

    group_id: Optional[UUID] = None
    icon_id: Optional[UUID] = None

    precio: Optional[Decimal] = None

    note: Optional[str] = Field(default=None, max_length=180)

    # URL pública de Cloudinary de la foto del check-in (opcional)
    foto_url: Optional[str] = Field(default=None, max_length=500)

    # Emoji del icono seleccionado (máx. 10 chars para admitir emojis compuestos)
    icon_emoji: Optional[str] = Field(default=None, max_length=10)


class CheckinResponse(BaseModel):
    """
    Respuesta básica del check-in creado.
    """
    id: UUID
    lat: Decimal
    lng: Decimal
    precio: Optional[Decimal]
    note: Optional[str]
    foto_url: Optional[str]
    icon_emoji: Optional[str]


class MapCheckinResponse(BaseModel):
    """
    Check-in simplificado para pintar el mapa del usuario.
    Incluye nota, foto e icono para mostrar el detalle al pulsar un marker.
    """
    id: UUID
    lat: Decimal
    lng: Decimal
    precio: Optional[Decimal]
    note: Optional[str]
    foto_url: Optional[str]
    icon_emoji: Optional[str]


# =========================================================
# GROUP CHAT
# =========================================================

class SendMessageRequest(BaseModel):
    """
    Datos necesarios para enviar un mensaje al grupo.
    """
    message: str = Field(min_length=1, max_length=500)


class MessageResponse(BaseModel):
    """
    Mensaje del chat de grupo.
    Incluye created_at para que el frontend muestre la hora del mensaje.
    """
    id: UUID
    user_id: UUID
    message: str
    created_at: datetime


# =========================================================
# RANKING
# =========================================================

class RankingEntry(BaseModel):
    """
    Entrada individual del ranking.
    Incluye los datos públicos del usuario (avatar, ubicación)
    para que el frontend pueda mostrar fotos y mini-perfiles.
    """
    user_id: UUID
    username: str
    points: int
    avatar_url: Optional[str] = None
    ciudad: Optional[str] = None
    pais: Optional[str] = None