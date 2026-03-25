# app/routers/notifications_router.py
# -------------------------------------------------------------------
# Router de notificaciones push
# -------------------------------------------------------------------
# Un único endpoint: registrar el token push de un dispositivo.
# Se hace upsert para que el mismo usuario pueda tener varios
# dispositivos y para que el token se actualice si cambia.
# -------------------------------------------------------------------

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import User, UserDevice

router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"]
)


class RegisterTokenRequest(BaseModel):
    push_token: str
    platform: str  # "android" | "ios"


@router.post("/register-token", status_code=status.HTTP_204_NO_CONTENT)
def registrar_token_push(
    payload: RegisterTokenRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Registra o actualiza el token push de un dispositivo.

    Comportamiento:
    - Si el (user_id, push_token) ya existe → no hace nada
    - Si el token existe para otro usuario → actualiza el user_id
      (el usuario cambió de cuenta en el mismo dispositivo)
    - Si es nuevo → inserta
    """
    # Busca si este token ya está registrado (sea del mismo u otro usuario)
    existente = db.query(UserDevice).filter(
        UserDevice.push_token == payload.push_token
    ).first()

    if existente is None:
        dispositivo = UserDevice(
            user_id=current_user.id,
            push_token=payload.push_token,
            platform=payload.platform,
        )
        db.add(dispositivo)
        db.commit()
    elif existente.user_id != current_user.id:
        # El token pertenecía a otro usuario (cambio de cuenta)
        existente.user_id = current_user.id
        db.commit()
    # Si ya está registrado para este mismo usuario → no hacer nada
