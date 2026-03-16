# app/models.py
# =========================================================
# BeerMap - MODELOS SQLAlchemy
# =========================================================
# Este archivo define los modelos que usa la API y deben
# coincidir con el esquema SQL real de PostgreSQL.
#
# Objetivo:
# - Tener una base de datos coherente con el MVP real
# - Evitar errores de tipos entre SQLAlchemy y PostgreSQL
# - Dejar preparado el backend para grupos, check-ins,
#   ranking, iconos, chat y auditoría
#
# Seguridad / calidad:
# - Se usa UUID para entidades principales
# - Se añaden constraints iguales a los del SQL
# - Esto ayuda a evitar datos basura y estados inconsistentes
# - OWASP A04 / A05:
#   una buena integridad de datos y una configuración clara
#   reducen errores de diseño y fallos por mala configuración
# =========================================================

import uuid

from sqlalchemy import (
    Column,
    String,
    Date,
    DateTime,
    Boolean,
    Integer,
    BigInteger,
    ForeignKey,
    Text,
    Numeric,
    CheckConstraint,
    UniqueConstraint,
    text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


# =========================================================
# USERS
# =========================================================
# Usuario principal de la app.
# Aquí se guardan los datos básicos de autenticación y perfil.
# password_hash puede ser null si un día entras solo con Google/Apple.
# =========================================================

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    email = Column(String(254), unique=True, nullable=True)
    username = Column(String(30), unique=True, nullable=False)
    password_hash = Column(Text, nullable=True)

    # Información básica del perfil.
    # fecha_nacimiento va como Date porque en PostgreSQL
    # la columna real está definida como DATE.
    fecha_nacimiento = Column(Date, nullable=True)
    pais = Column(String(80), nullable=True)
    ciudad = Column(String(120), nullable=True)

    role = Column(String(10), nullable=False, server_default="user")
    is_active = Column(Boolean, nullable=False, server_default=text("true"))

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('user','admin')", name="users_role_chk"),
        CheckConstraint("LENGTH(username) >= 3", name="users_username_chk"),
        CheckConstraint("(email IS NULL OR POSITION('@' IN email) > 1)", name="users_email_chk"),
    )

    # Relaciones
    auth_providers = relationship("UserAuthProvider", back_populates="user")
    devices = relationship("UserDevice", back_populates="user")
    checkins = relationship("Checkin", back_populates="user")


# =========================================================
# USER AUTH PROVIDERS
# =========================================================
# Relación entre usuario y proveedor externo.
# Deja preparado login con Google/Apple sin tocar luego la BD.
# =========================================================

class UserAuthProvider(Base):
    __tablename__ = "user_auth_providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(20), nullable=False)
    provider_user_id = Column(String(128), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("provider IN ('google','apple')", name="auth_provider_chk"),
        UniqueConstraint("provider", "provider_user_id", name="auth_unique"),
    )

    user = relationship("User", back_populates="auth_providers")


# =========================================================
# MAP ICONS
# =========================================================
# Catálogo de iconos disponibles para el mapa.
# Se pueden desbloquear gratis, por puntos o por mínimos de puntos.
# =========================================================

class MapIcon(Base):
    __tablename__ = "map_icons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    key = Column(String(40), nullable=False, unique=True)
    label = Column(String(80), nullable=False)

    price_points = Column(Integer, nullable=False, server_default="0")
    min_points = Column(Integer, nullable=False, server_default="0")
    is_enabled = Column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        CheckConstraint("price_points >= 0", name="icon_price_chk"),
        CheckConstraint("min_points >= 0", name="icon_min_points_chk"),
    )


# =========================================================
# USER ICONS
# =========================================================
# Inventario de iconos desbloqueados por cada usuario.
# =========================================================

class UserIcon(Base):
    __tablename__ = "user_icons"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    icon_id = Column(UUID(as_uuid=True), ForeignKey("map_icons.id", ondelete="RESTRICT"), primary_key=True)

    acquired_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


# =========================================================
# USER SETTINGS
# =========================================================
# Ajustes del usuario. Por ahora solo se usa el icono seleccionado.
# =========================================================

class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    selected_icon_id = Column(UUID(as_uuid=True), ForeignKey("map_icons.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


# =========================================================
# GROUPS
# =========================================================
# Grupo de amigos/colegas.
# join_code sirve para entrar con código.
# =========================================================

class Group(Base):
    __tablename__ = "groups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(80), nullable=False)
    join_code = Column(String(10), nullable=False, unique=True)

    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    members = relationship("GroupMember", back_populates="group")
    messages = relationship("GroupMessage", back_populates="group")


# =========================================================
# GROUP MEMBERS
# =========================================================
# Relación usuario <-> grupo.
# Guarda también el rol dentro del grupo.
# =========================================================

class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)

    role = Column(String(10), nullable=False, server_default="member")
    joined_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('member','admin')", name="group_member_role_chk"),
    )

    group = relationship("Group", back_populates="members")


# =========================================================
# CHECKINS
# =========================================================
# Cada cerveza que toma el usuario.
# Puede ir asociada o no a un grupo.
# Se guarda lat/lng, precio y el icono usado en ese momento.
# =========================================================

class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    icon_id = Column(UUID(as_uuid=True), ForeignKey("map_icons.id", ondelete="SET NULL"), nullable=True)

    lat = Column(Numeric(9, 6), nullable=False)
    lng = Column(Numeric(9, 6), nullable=False)

    precio = Column(Numeric(6, 2), nullable=True)

    note = Column(String(180), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("lat >= -90 AND lat <= 90", name="checkins_lat_chk"),
        CheckConstraint("lng >= -180 AND lng <= 180", name="checkins_lng_chk"),
        CheckConstraint("(precio IS NULL OR precio >= 0)", name="checkins_precio_chk"),
    )

    user = relationship("User", back_populates="checkins")


# =========================================================
# CHECKIN PHOTOS
# =========================================================
# Fotos opcionales del check-in.
# Se guarda también el usuario que sube la foto.
# =========================================================

class CheckinPhoto(Base):
    __tablename__ = "checkin_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    checkin_id = Column(UUID(as_uuid=True), ForeignKey("checkins.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    url = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


# =========================================================
# POINTS LEDGER
# =========================================================
# Ledger de puntos.
# Cada movimiento queda registrado para poder reconstruir el saldo.
# =========================================================

class PointsLedger(Base):
    __tablename__ = "points_ledger"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    delta = Column(Integer, nullable=False)
    reason = Column(String(40), nullable=False)

    ref_type = Column(String(40), nullable=True)
    ref_id = Column(UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "reason IN ('checkin','buy_icon','admin_adjust','purchase')",
            name="points_reason_chk"
        ),
    )


# =========================================================
# GROUP MESSAGES
# =========================================================
# Chat simple del grupo.
# =========================================================

class GroupMessage(Base):
    __tablename__ = "group_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    message = Column(String(500), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    group = relationship("Group", back_populates="messages")


# =========================================================
# USER DEVICES
# =========================================================
# Dispositivos del usuario para notificaciones push.
# Un usuario puede tener varios dispositivos.
# =========================================================

class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    platform = Column(String(10), nullable=False)
    push_token = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("platform IN ('android','ios')", name="device_platform_chk"),
        UniqueConstraint("platform", "push_token", name="device_unique"),
        UniqueConstraint("user_id", "push_token", name="device_user_unique"),
    )

    user = relationship("User", back_populates="devices")


# =========================================================
# AUDIT LOGS
# =========================================================
# Registro de acciones importantes dentro del sistema.
# Permite tener trazabilidad para seguridad y depuración.
# =========================================================

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)

    action = Column(String(80), nullable=False)
    ip = Column(String(45), nullable=True)
    user_agent = Column(String(200), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


# =========================================================
# USER POINTS TOTAL
# =========================================================
# Tabla resumen de puntos por usuario.
# Se usa para rankings rápidos sin tener que sumar
# todo el ledger cada vez.
# =========================================================

class UserPointsTotal(Base):
    __tablename__ = "user_points_total"

    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True
    )

    total_points = Column(
        Integer,
        nullable=False,
        server_default="0"
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now()
    )

    user = relationship("User")