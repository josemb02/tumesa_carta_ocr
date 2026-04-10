# routers/rewards_router.py
# Endpoint SSV de AdMob — AdMob llama a este endpoint directamente
# cuando el usuario completa un vídeo recompensado.
# El frontend NO llama a este endpoint.

import base64
import logging
import httpx
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import UserPointsTotal, User
from ..ratelimit import rate_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/rewards", tags=["rewards"])

# Caché de claves públicas de AdMob en memoria
_admob_keys_cache: dict = {}

# Puntos que se dan por ver un vídeo completo
PUNTOS_POR_VIDEO = 20


async def _obtener_clave_publica(key_id: str) -> str | None:
    """
    Obtiene la clave pública de AdMob para verificar la firma SSV.
    Cachea las claves en memoria para no pedir a Google en cada llamada.
    """
    global _admob_keys_cache
    if key_id in _admob_keys_cache:
        return _admob_keys_cache[key_id]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://www.gstatic.com/admob/reward/verifier-keys.json"
            )
            resp.raise_for_status()
            data = resp.json()
            for key in data.get("keys", []):
                _admob_keys_cache[str(key["keyId"])] = key["pem"]
            return _admob_keys_cache.get(key_id)
    except Exception as e:
        logger.error(f"[AdMob SSV] Error obteniendo claves públicas: {e}")
        return None


@router.get("/admob-ssv", status_code=200)
async def admob_ssv_callback(
    request: Request,
    ad_network: str = Query(default=""),
    ad_unit: str = Query(default=""),
    custom_data: str = Query(default=""),
    key_id: int = Query(default=0),
    reward_amount: int = Query(default=0),
    reward_item: str = Query(default=""),
    signature: str = Query(default=""),
    timestamp: int = Query(default=0),
    transaction_id: str = Query(default=""),
    user_id: str = Query(default=""),
    db: Session = Depends(get_db),
):
    """
    Callback SSV de AdMob. Google llama a este endpoint cuando
    el usuario completa un vídeo recompensado.

    Documentación: https://developers.google.com/admob/android/ssv
    """
    # Si es una llamada de verificación de AdMob (sin parámetros reales), devolver 200
    if not signature or not transaction_id or not user_id:
        return {"status": "ok", "mensaje": "verificación"}

    # Verificar firma SSV con clave pública de AdMob
    clave_pem = await _obtener_clave_publica(str(key_id))
    if not clave_pem:
        logger.error(f"[AdMob SSV] Clave {key_id} no encontrada")
        raise HTTPException(status_code=400, detail="Clave AdMob no encontrada")

    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import ec
        from cryptography.exceptions import InvalidSignature

        # Construir query string original que AdMob firmó (sin signature ni key_id)
        # Orden exacto según documentación de AdMob SSV
        query_sin_firma = (
            f"ad_network={ad_network}&ad_unit={ad_unit}&"
            f"custom_data={custom_data}&"
            f"reward_amount={reward_amount}&reward_item={reward_item}&"
            f"timestamp={timestamp}&transaction_id={transaction_id}&"
            f"user_id={user_id}"
        ).encode("utf-8")

        # Decodificar firma base64url
        padding = "=" * (4 - len(signature) % 4)
        firma = base64.urlsafe_b64decode(signature + padding)

        # Verificar con clave pública ECDSA SHA-256
        clave_publica = serialization.load_pem_public_key(clave_pem.encode())
        clave_publica.verify(firma, query_sin_firma, ec.ECDSA(hashes.SHA256()))

    except InvalidSignature:
        logger.warning(f"[AdMob SSV] Firma inválida — user_id {user_id}")
        raise HTTPException(status_code=400, detail="Firma SSV inválida")
    except Exception as e:
        logger.error(f"[AdMob SSV] Error verificando firma: {e}")
        raise HTTPException(status_code=400, detail="Error verificando recompensa")

    # Idempotencia: evitar procesar dos veces el mismo transaction_id
    try:
        from ..ratelimit import _get_redis
        r = _get_redis()
        if r:
            clave_tx = f"admob_tx:{transaction_id}"
            if r.get(clave_tx):
                # Ya procesado — devolver 200 igualmente (AdMob reintenta si recibe error)
                logger.info(f"[AdMob SSV] transaction_id ya procesado: {transaction_id}")
                return {"status": "ok", "mensaje": "ya procesado"}
            r.setex(clave_tx, 86400 * 30, "1")
    except Exception:
        pass

    # Buscar usuario por user_id (UUID)
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        logger.warning(f"[AdMob SSV] user_id inválido: {user_id}")
        raise HTTPException(status_code=400, detail="user_id inválido")

    usuario = db.query(User).filter(User.id == uid).first()
    if not usuario:
        logger.warning(f"[AdMob SSV] Usuario no encontrado: {user_id}")
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Sumar puntos al usuario
    puntos = db.query(UserPointsTotal).filter(
        UserPointsTotal.user_id == uid
    ).first()

    if puntos:
        puntos.total_points += PUNTOS_POR_VIDEO
    else:
        puntos = UserPointsTotal(
            user_id=uid,
            total_points=PUNTOS_POR_VIDEO
        )
        db.add(puntos)

    db.commit()
    db.refresh(puntos)

    logger.info(
        f"[AdMob SSV] +{PUNTOS_POR_VIDEO} pts — user {user_id} "
        f"— total {puntos.total_points}"
    )

    # AdMob espera 200 OK con cuerpo vacío o simple
    return {"status": "ok"}
