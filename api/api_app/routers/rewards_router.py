# routers/rewards_router.py
# Endpoint para verificar SSV de AdMob y sumar puntos al usuario

import base64
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user
from ..models import User, UserPointsTotal
from ..schemas import RewardVideoRequest
from ..ratelimit import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rewards", tags=["rewards"])

# Caché de claves públicas de AdMob en memoria
_admob_keys_cache: dict = {}


async def _obtener_clave_publica(key_id: str) -> str | None:
    """
    Obtiene la clave pública de AdMob para verificar la firma SSV.
    Cachea las claves en memoria para no hacer una petición por cada vídeo.
    """
    global _admob_keys_cache
    if key_id in _admob_keys_cache:
        return _admob_keys_cache[key_id]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://www.gstatic.com/admob/reward/verifier-keys.json")
            resp.raise_for_status()
            data = resp.json()
            for key in data.get("keys", []):
                _admob_keys_cache[str(key["keyId"])] = key["pem"]
            return _admob_keys_cache.get(key_id)
    except Exception as e:
        logger.error(f"[AdMob SSV] Error obteniendo claves públicas: {e}")
        return None


@router.post("/video", status_code=200)
async def recompensa_video(
    payload: RewardVideoRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Verifica la firma SSV de AdMob y suma 20 puntos al usuario.
    Usa transaction_id para evitar recompensas duplicadas.
    """
    # Rate limit: máximo 10 vídeos por hora por usuario
    rate_limit(key=f"reward_video:{current_user.id}", max_requests=10, window_seconds=3600)

    # Verificar firma SSV con clave pública de AdMob
    clave_pem = await _obtener_clave_publica(payload.key_id)
    if not clave_pem:
        raise HTTPException(status_code=400, detail="Clave AdMob no encontrada")

    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.exceptions import InvalidSignature

        # Mensaje que AdMob firmó (orden exacto según documentación)
        mensaje = (
            f"reward_item={payload.reward_item}"
            f"&reward_amount={payload.reward_amount}"
            f"&transaction_id={payload.transaction_id}"
            f"&user_id={payload.user_id}"
        ).encode("utf-8")

        # Decodificar firma base64url
        firma = base64.urlsafe_b64decode(payload.signature + "==")

        # Verificar con clave pública ECDSA
        clave_publica = serialization.load_pem_public_key(clave_pem.encode())
        clave_publica.verify(firma, mensaje, ec.ECDSA(hashes.SHA256()))

    except InvalidSignature:
        logger.warning(f"[AdMob SSV] Firma inválida — user {current_user.id}")
        raise HTTPException(status_code=400, detail="Firma SSV inválida")
    except Exception as e:
        logger.error(f"[AdMob SSV] Error verificando: {e}")
        raise HTTPException(status_code=400, detail="Error verificando recompensa")

    # Idempotencia: evitar procesar dos veces el mismo transaction_id
    try:
        from ..ratelimit import _get_redis
        r = _get_redis()
        if r:
            clave_tx = f"admob_tx:{payload.transaction_id}"
            if r.get(clave_tx):
                raise HTTPException(status_code=409, detail="Recompensa ya procesada")
            r.setex(clave_tx, 86400 * 30, "1")
    except HTTPException:
        raise
    except Exception:
        pass  # Si Redis no está disponible continuamos

    # Sumar puntos al usuario
    puntos = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == current_user.id
    ).first()

    if puntos:
        puntos.total_points += payload.reward_amount
    else:
        puntos = UserPointsTotal(
            user_id=current_user.id,
            total_points=payload.reward_amount
        )
        db.add(puntos)

    db.commit()
    db.refresh(puntos)

    logger.info(f"[AdMob] +{payload.reward_amount} pts — user {current_user.id}")
    return {"puntos_ganados": payload.reward_amount, "total_puntos": puntos.total_points}
