# api/app/config.py
import logging
import os

logger = logging.getLogger(__name__)

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

        # Refresh tokens
        # Duración del refresh token en días (por defecto 30 días)
        self.REFRESH_TOKEN_EXPIRE_DAYS = int(_get_env("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

        # Reglas de negocio (cooldown de check-in)
        self.CHECKIN_COOLDOWN_SECONDS = int(_get_env("CHECKIN_COOLDOWN_SECONDS", "300"))

        # CORS
        self.CORS_ORIGINS = _get_env("CORS_ORIGINS", "*")

        # En producción CORS debería ser una lista concreta de dominios, no "*".
        # Si sigue abierto en prod, logueamos un aviso claro.
        if self.ENV == "prod" and self.CORS_ORIGINS.strip() == "*":
            logger.warning(
                "[SEGURIDAD] CORS_ORIGINS='*' en entorno PROD — "
                "define una lista de dominios permitidos antes de publicar en stores"
            )

        # -------------------------------------------------
        # Google OAuth
        # -------------------------------------------------
        # Si se configura, se verifica que el campo "aud" del id_token
        # de Google coincide con este CLIENT_ID para evitar token hijacking.
        # Si está vacío, se omite la verificación (compatibilidad con dev).
        self.GOOGLE_CLIENT_ID = _get_env("GOOGLE_CLIENT_ID", "")

        # -------------------------------------------------
        # Resend (envío de emails transaccionales)
        # -------------------------------------------------
        self.RESEND_API_KEY = _get_env("RESEND_API_KEY", "")

        # -------------------------------------------------
        # AdMob SSV (Server Side Verification)
        # -------------------------------------------------
        # URL para obtener las claves públicas con las que verificar
        # la firma de las recompensas de vídeo de AdMob.
        self.ADMOB_SSV_PUBLIC_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"

        # -------------------------------------------------
        # Cloudinary
        # -------------------------------------------------
        # Se aceptan los nombres en inglés y los originales en español
        # por si las variables de Railway se configuraron en español.
        self.CLOUDINARY_CLOUD_NAME = (
            _get_env("CLOUDINARY_CLOUD_NAME")
            or _get_env("NOMBRE_DE_LA_NUBE_CLOUDINARY")
        )
        self.CLOUDINARY_API_KEY = (
            _get_env("CLOUDINARY_API_KEY")
            or _get_env("CLAVE_API_DE_CLOUDINARY")
        )
        self.CLOUDINARY_API_SECRET = _get_env("CLOUDINARY_API_SECRET")

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

REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS
CHECKIN_COOLDOWN_SECONDS = settings.CHECKIN_COOLDOWN_SECONDS
CORS_ORIGINS = settings.CORS_ORIGINS

LOGIN_MAX_ATTEMPTS = settings.LOGIN_MAX_ATTEMPTS
LOGIN_WINDOW_SECONDS = settings.LOGIN_WINDOW_SECONDS
LOGIN_BLOCK_SECONDS = settings.LOGIN_BLOCK_SECONDS
REDIS_SOCKET_TIMEOUT = settings.REDIS_SOCKET_TIMEOUT

GOOGLE_CLIENT_ID = settings.GOOGLE_CLIENT_ID

RESEND_API_KEY = settings.RESEND_API_KEY

ADMOB_SSV_PUBLIC_KEYS_URL = settings.ADMOB_SSV_PUBLIC_KEYS_URL

CLOUDINARY_CLOUD_NAME = settings.CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY = settings.CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET = settings.CLOUDINARY_API_SECRET