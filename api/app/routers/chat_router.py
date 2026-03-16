# app/routers/chat_router.py
# -------------------------------------------------------------------
# Router de chat
# -------------------------------------------------------------------
# Este archivo concentra la lógica relacionada con el chat de grupo.
#
# Equivalencia mental con Spring Boot:
# - esto sería como tu ChatController
#
# Qué vamos a gestionar aquí:
# - enviar mensaje a un grupo
# - listar mensajes de un grupo
#
# Seguridad:
# - solo usuarios autenticados pueden acceder al chat
# - solo usuarios que pertenezcan al grupo pueden ver o enviar mensajes
# - se registra auditoría en acciones importantes
# -------------------------------------------------------------------

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..audit import write_audit_log
from ..auth import get_current_user
from ..database import get_db
from ..models import Group, GroupMember, GroupMessage, User
from ..schemas import MessageResponse, SendMessageRequest


# -------------------------------------------------------------------
# Router de chat
# -------------------------------------------------------------------
router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


def comprobar_pertenencia_grupo(
    group_id: UUID,
    current_user: User,
    db: Session
):
    """
    Comprueba que:
    1) el grupo exista
    2) el usuario autenticado pertenezca a ese grupo

    Esto evita que un usuario pueda leer o escribir mensajes
    en un grupo ajeno.
    """
    # ---------------------------------------------------------------
    # 1) Se comprueba que el grupo exista
    # ---------------------------------------------------------------
    grupo = db.query(Group).filter(Group.id == group_id).first()

    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado",
        )

    # ---------------------------------------------------------------
    # 2) Se comprueba que el usuario pertenezca al grupo
    #
    # OWASP A01 Broken Access Control
    # Evita acceso a recursos de grupos ajenos.
    # ---------------------------------------------------------------
    pertenencia = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()

    if pertenencia is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo",
        )


@router.post("/group/{group_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def enviar_mensaje_grupo(
    group_id: UUID,
    payload: SendMessageRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Envía un mensaje al chat de un grupo.

    Flujo:
    1) comprueba que el grupo exista
    2) comprueba que el usuario pertenezca al grupo
    3) valida que el mensaje no esté vacío de verdad
    4) crea el mensaje
    5) guarda auditoría
    6) devuelve el mensaje creado

    Seguridad:
    - OWASP A01 Broken Access Control:
      solo miembros del grupo pueden enviar mensajes
    - OWASP A03 Injection:
      se usa SQLAlchemy ORM y no SQL manual
    - OWASP A09 Logging and Monitoring Failures:
      se registra la acción en audit_logs
    """
    # ---------------------------------------------------------------
    # Se valida que el usuario pueda escribir en ese grupo
    # ---------------------------------------------------------------
    comprobar_pertenencia_grupo(
        group_id=group_id,
        current_user=current_user,
        db=db
    )

    # ---------------------------------------------------------------
    # Se limpia el mensaje para evitar guardar solo espacios
    # ---------------------------------------------------------------
    mensaje_limpio = payload.message.strip()

    if mensaje_limpio == "":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El mensaje no puede estar vacío",
        )

    # ---------------------------------------------------------------
    # Se crea el mensaje
    # ---------------------------------------------------------------
    mensaje = GroupMessage(
        group_id=group_id,
        user_id=current_user.id,
        message=mensaje_limpio,
    )

    db.add(mensaje)
    db.commit()
    db.refresh(mensaje)

    # ---------------------------------------------------------------
    # Se registra auditoría
    # ---------------------------------------------------------------
    write_audit_log(
        db=db,
        action="chat_message_send",
        request=request,
        user_id=current_user.id
    )

    # ---------------------------------------------------------------
    # Se devuelve respuesta
    # ---------------------------------------------------------------
    return MessageResponse(
        id=mensaje.id,
        user_id=mensaje.user_id,
        message=mensaje.message,
    )


@router.get("/group/{group_id}", response_model=list[MessageResponse])
def listar_mensajes_grupo(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve los mensajes de un grupo.

    Flujo:
    1) comprueba que el grupo exista
    2) comprueba que el usuario pertenezca al grupo
    3) obtiene los mensajes ordenados del más reciente al más antiguo
    4) devuelve la lista

    Seguridad:
    - OWASP A01 Broken Access Control:
      solo miembros del grupo pueden leer mensajes
    - OWASP A03 Injection:
      se usa SQLAlchemy ORM y no SQL manual
    """
    # ---------------------------------------------------------------
    # Se valida que el usuario pueda leer ese grupo
    # ---------------------------------------------------------------
    comprobar_pertenencia_grupo(
        group_id=group_id,
        current_user=current_user,
        db=db
    )

    # ---------------------------------------------------------------
    # Se buscan los mensajes del grupo
    # ---------------------------------------------------------------
    mensajes = db.query(GroupMessage).filter(
        GroupMessage.group_id == group_id
    ).order_by(
        desc(GroupMessage.created_at)
    ).all()

    respuesta = []

    for mensaje in mensajes:
        respuesta.append(
            MessageResponse(
                id=mensaje.id,
                user_id=mensaje.user_id,
                message=mensaje.message,
            )
        )

    return respuesta