# app/routers/groups_router.py
# -------------------------------------------------------------------
# Router de grupos
# -------------------------------------------------------------------
# Este archivo concentra toda la lógica de endpoints relacionada
# con grupos.
#
# Equivalencia mental con Spring Boot:
# - esto sería como tu GroupController
#
# Aquí vamos a gestionar:
# - crear grupo
# - unirse a grupo por código
# - listar mis grupos
# - listar miembros de un grupo
#
# Seguridad:
# - solo usuarios autenticados pueden entrar
# - se usa JWT con get_current_user
# - se registran acciones importantes en audit_logs
# -------------------------------------------------------------------

import random
import string
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Group, GroupMember, User
from ..schemas import CreateGroupRequest, JoinGroupRequest, GroupResponse
from ..auth import get_current_user
from ..audit import write_audit_log


# -------------------------------------------------------------------
# Router de grupos
# -------------------------------------------------------------------
# prefix:
# - todas las rutas de este archivo empezarán por /groups
#
# tags:
# - sirve para organizar Swagger / OpenAPI
# -------------------------------------------------------------------
router = APIRouter(
    prefix="/groups",
    tags=["Groups"]
)


def generar_codigo_union(db: Session, longitud: int = 6) -> str:
    """
    Genera un código corto y único para que otros usuarios
    puedan unirse a un grupo.
    """
    caracteres = string.ascii_uppercase + string.digits

    while True:
        codigo = "".join(random.choice(caracteres) for _ in range(longitud))

        grupo_existente = db.query(Group).filter(Group.join_code == codigo).first()

        if grupo_existente is None:
            return codigo


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def crear_grupo(
    payload: CreateGroupRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea un grupo nuevo.
    """
    nombre_limpio = payload.name.strip()

    grupos_del_usuario = db.query(Group).filter(
        Group.owner_id == current_user.id
    ).count()

    if grupos_del_usuario >= 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Has alcanzado el máximo de grupos permitidos",
        )

    grupo_existente = db.query(Group).filter(
        Group.owner_id == current_user.id,
        Group.name == nombre_limpio
    ).first()

    if grupo_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes un grupo con ese nombre",
        )

    join_code = generar_codigo_union(db)

    grupo = Group(
        name=nombre_limpio,
        join_code=join_code,
        owner_id=current_user.id,
    )

    db.add(grupo)
    db.flush()

    miembro_owner = GroupMember(
        group_id=grupo.id,
        user_id=current_user.id,
        role="admin",
    )

    db.add(miembro_owner)
    db.commit()
    db.refresh(grupo)

    write_audit_log(
        db=db,
        action="group_create",
        request=request,
        user_id=current_user.id
    )

    return GroupResponse(
        id=grupo.id,
        name=grupo.name,
        join_code=grupo.join_code,
    )


@router.post("/join", response_model=GroupResponse)
def unirse_a_grupo(
    payload: JoinGroupRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Une al usuario autenticado a un grupo mediante su join_code.
    """
    codigo_limpio = payload.join_code.strip().upper()

    grupo = db.query(Group).filter(Group.join_code == codigo_limpio).first()

    if grupo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grupo no encontrado",
        )

    relacion_existente = db.query(GroupMember).filter(
        GroupMember.group_id == grupo.id,
        GroupMember.user_id == current_user.id
    ).first()

    if relacion_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya perteneces a este grupo",
        )

    miembro = GroupMember(
        group_id=grupo.id,
        user_id=current_user.id,
        role="member",
    )

    db.add(miembro)
    db.commit()

    write_audit_log(
        db=db,
        action="group_join",
        request=request,
        user_id=current_user.id
    )

    return GroupResponse(
        id=grupo.id,
        name=grupo.name,
        join_code=grupo.join_code,
    )


@router.get("/my", response_model=list[GroupResponse])
def listar_mis_grupos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve todos los grupos a los que pertenece el usuario autenticado.
    """
    grupos = db.query(Group).join(
        GroupMember,
        GroupMember.group_id == Group.id
    ).filter(
        GroupMember.user_id == current_user.id
    ).all()

    respuesta = []

    for grupo in grupos:
        respuesta.append(
            GroupResponse(
                id=grupo.id,
                name=grupo.name,
                join_code=grupo.join_code,
            )
        )

    return respuesta


@router.get("/{group_id}/members")
def listar_miembros_grupo(
    group_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve los miembros de un grupo.
    """
    pertenencia = db.query(GroupMember).filter(
        GroupMember.group_id == group_id,
        GroupMember.user_id == current_user.id
    ).first()

    if pertenencia is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo",
        )

    miembros = db.query(User).join(
        GroupMember,
        GroupMember.user_id == User.id
    ).filter(
        GroupMember.group_id == group_id
    ).all()

    respuesta = []

    for user in miembros:
        respuesta.append({
            "id": user.id,
            "username": user.username
        })

    return respuesta