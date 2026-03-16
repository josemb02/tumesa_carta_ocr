# api/app/config.py
import os

# =========================================================
# BeerMap - CONFIG CENTRAL DE LA APLICACIÓN
# =========================================================
# Objetivo:
# - Centralizar configuración por variables de entorno (.env)
# - Evitar secretos en el código
# - Permitir despliegue en distintos entornos sin tocar código
#
# Nota:
# - Se crea un objeto "settings" para que el resto del código haga:
#     from .config import settings
# =========================================================


def _get_env(name: str, default: str = "") -> str:
    """
    Lee una variable de entorno de forma segura.
    Si no existe, devuelve un valor por defecto.
    """
    value = os.getenv(name, default)

    if value is None:
        return default

    return value


class Settings:
    """
    Contenedor de configuración de la aplicación.
    """

    def __init__(self):
        # -------------------------------------------------
        # Entorno de ejecución
        # dev | staging | prod
        # -------------------------------------------------
        self.ENV = _get_env("ENV", "dev").strip().lower()

        # Base de datos
        self.DATABASE_URL = _get_env("DATABASE_URL")

        # Redis
        # Se usa para rate limit y deja la app preparada
        # para escalar mejor que con memoria local.
        self.REDIS_URL = _get_env("REDIS_URL", "redis://redis:6379/0")

        # JWT
        self.JWT_SECRET = _get_env("JWT_SECRET", "CAMBIA_ESTE_SECRET_EN_ENV")
        self.JWT_ALGORITHM = _get_env("JWT_ALGORITHM", "HS256")
        self.JWT_EXPIRE_MINUTES = int(_get_env("JWT_EXPIRE_MINUTES", "60"))

        # Reglas de negocio (cooldown de check-in)
        self.CHECKIN_COOLDOWN_SECONDS = int(_get_env("CHECKIN_COOLDOWN_SECONDS", "300"))

        # CORS
        self.CORS_ORIGINS = _get_env("CORS_ORIGINS", "*")

        # -------------------------------------------------
        # Anti-fuerza bruta / rate limit
        # -------------------------------------------------
        self.LOGIN_MAX_ATTEMPTS = int(_get_env("LOGIN_MAX_ATTEMPTS", "5"))
        self.LOGIN_WINDOW_SECONDS = int(_get_env("LOGIN_WINDOW_SECONDS", "600"))
        self.LOGIN_BLOCK_SECONDS = int(_get_env("LOGIN_BLOCK_SECONDS", "900"))

        # Timeout simple para Redis
        self.REDIS_SOCKET_TIMEOUT = float(_get_env("REDIS_SOCKET_TIMEOUT", "2"))


# Objeto único de configuración para toda la app
settings = Settings()


# ------------------------------------------------------------------
# Compatibilidad hacia atrás:
# Si en otros ficheros ya usabas constantes directas, se exponen.
# ------------------------------------------------------------------
ENV = settings.ENV

DATABASE_URL = settings.DATABASE_URL
REDIS_URL = settings.REDIS_URL

JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.JWT_ALGORITHM
JWT_EXPIRE_MINUTES = settings.JWT_EXPIRE_MINUTES

CHECKIN_COOLDOWN_SECONDS = settings.CHECKIN_COOLDOWN_SECONDS
CORS_ORIGINS = settings.CORS_ORIGINS

LOGIN_MAX_ATTEMPTS = settings.LOGIN_MAX_ATTEMPTS
LOGIN_WINDOW_SECONDS = settings.LOGIN_WINDOW_SECONDS
LOGIN_BLOCK_SECONDS = settings.LOGIN_BLOCK_SECONDS
REDIS_SOCKET_TIMEOUT = settings.REDIS_SOCKET_TIMEOUT