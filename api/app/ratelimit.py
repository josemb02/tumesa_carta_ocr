# api/app/ratelimit.py
# -------------------------------------------------------------------
# Rate limiting con Redis
# -------------------------------------------------------------------
# Este archivo aplica rate limit por clave usando Redis.
#
# Objetivo:
# - evitar abuso en login y register
# - no depender de memoria local
# - dejar la app preparada para varias instancias de API
#
# Qué hace:
# - guarda timestamps por clave en un sorted set de Redis
# - elimina los que ya están fuera de la ventana
# - comprueba cuántos quedan activos
# - si supera el máximo, devuelve 429
# -------------------------------------------------------------------

import time

from fastapi import HTTPException, status
from redis import Redis
from redis.exceptions import RedisError

from .config import settings


# -------------------------------------------------------------------
# Cliente Redis global
# -------------------------------------------------------------------
# Se reutiliza durante la vida del proceso para no abrir conexión
# nueva en cada petición.
# -------------------------------------------------------------------
_redis_client = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_timeout=settings.REDIS_SOCKET_TIMEOUT,
)


def _now() -> float:
    """
    Devuelve el timestamp actual en segundos.
    """
    return time.time()


def rate_limit(key: str, max_requests: int, window_seconds: int) -> None:
    """
    Aplica rate limit por clave.

    Parámetros:
    - key: por ejemplo "login:IP" o "register:IP"
    - max_requests: máximo de peticiones permitidas en la ventana
    - window_seconds: duración de la ventana temporal

    Flujo:
    1) elimina timestamps antiguos
    2) cuenta peticiones activas
    3) si supera el máximo -> 429
    4) guarda la petición actual
    5) renueva expiración de la clave
    """
    now = _now()
    window_start = now - window_seconds

    try:
        pipeline = _redis_client.pipeline()

        # Se limpia lo que ya está fuera de ventana
        pipeline.zremrangebyscore(key, 0, window_start)

        # Se cuenta cuántas peticiones siguen activas
        pipeline.zcard(key)

        # Se ejecutan ambas operaciones juntas
        _, current_count = pipeline.execute()

        if current_count >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Demasiados intentos. Intenta más tarde."
            )

        # Se guarda la petición actual
        # El miembro lleva timestamp + milisegundos para evitar colisiones
        member = f"{now}-{int(now * 1000)}"
        _redis_client.zadd(key, {member: now})

        # Se deja caducar la clave un poco después de la ventana
        _redis_client.expire(key, window_seconds + 5)

    except RedisError:
        # Si Redis falla, se devuelve 503 para no dejar el rate limit
        # en estado incierto en un despliegue pensado para escalar.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio temporalmente no disponible"
        )