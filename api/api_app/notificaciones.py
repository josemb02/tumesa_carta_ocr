# app/notificaciones.py
# -------------------------------------------------------------------
# Servicio de notificaciones push con Expo Push API
# -------------------------------------------------------------------
# Usamos la API de Expo directamente (no Firebase SDK).
# Expo gestiona internamente el envío a APNS (iOS) y FCM (Android).
#
# Fallos silenciosos: si una notificación no se puede enviar,
# simplemente se registra el error en logs — nunca rompemos el
# flujo principal de la petición.
# -------------------------------------------------------------------

import logging
import threading
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from .models import UserDevice

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


# -------------------------------------------------------------------
# Función base: enviar a un token concreto
# -------------------------------------------------------------------
def enviar_notificacion(expo_token: str, titulo: str, mensaje: str, datos: dict | None = None) -> None:
    """
    Envía una notificación push a un token Expo concreto.

    Si falla (red, token inválido, etc.) solo registra el error
    sin propagar la excepción.
    """
    payload = {
        "to": expo_token,
        "title": titulo,
        "body": mensaje,
        "sound": "default",
        "data": datos or {},
    }

    try:
        with httpx.Client(timeout=5.0) as client:
            respuesta = client.post(
                EXPO_PUSH_URL,
                json=payload,
                headers={
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                },
            )
            respuesta.raise_for_status()
    except Exception as exc:
        logger.warning("[notificaciones] Fallo al enviar a %s: %s", expo_token, exc)


# -------------------------------------------------------------------
# Función de alto nivel: notificar a todos los dispositivos de un usuario
# -------------------------------------------------------------------
def enviar_notificacion_a_usuario(
    user_id: UUID | str,
    titulo: str,
    mensaje: str,
    datos: dict | None = None,
    db: Session | None = None,
) -> None:
    """
    Busca todos los tokens registrados del usuario y envía la notificación.

    Parámetros:
    - user_id: UUID del usuario destinatario
    - titulo: título visible de la notificación
    - mensaje: cuerpo de la notificación
    - datos: payload adicional (para navegación en el frontend)
    - db: sesión de base de datos activa
    """
    if db is None:
        logger.warning("[notificaciones] No hay db session para user_id=%s", user_id)
        return

    dispositivos = db.query(UserDevice).filter(
        UserDevice.user_id == user_id
    ).all()

    for dispositivo in dispositivos:
        enviar_notificacion(dispositivo.push_token, titulo, mensaje, datos)


# -------------------------------------------------------------------
# Notificación diferida: aviso cuando el cooldown ha terminado
# -------------------------------------------------------------------
def programar_notificacion_cooldown(tokens: list[str], segundos: int) -> None:
    """
    Programa una notificación que se enviará tras 'segundos' segundos,
    informando al usuario de que ya puede hacer un nuevo check-in.

    Usa un timer de stdlib en un thread daemon — ligero y sin dependencias
    adicionales. Apropiado para notificaciones únicas sin persistencia.
    """
    if not tokens:
        return

    def _enviar():
        for token in tokens:
            enviar_notificacion(
                token,
                titulo="¡Listo para otra! 🍺",
                mensaje="Tu cooldown ha terminado. Ya puedes registrar una nueva cerveza.",
                datos={"tipo": "cooldown"},
            )

    timer = threading.Timer(segundos, _enviar)
    timer.daemon = True
    timer.start()
